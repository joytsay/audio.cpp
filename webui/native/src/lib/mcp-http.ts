export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

// Streamable HTTP only. The workflow uses MCP Server Trigger v2 (not its
// legacy /sse transport or n8n's instance-administration MCP endpoint).
export class McpHttpClient {
  instructions = "";
  private id = 0;
  private session = "";
  private protocol = "2025-03-26";
  constructor(private url: string, private signal: AbortSignal) {}

  private async send(method: string, params?: unknown, notification = false): Promise<any> {
    this.signal.throwIfAborted();
    const id = notification ? undefined : ++this.id;
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": this.protocol,
        ...(this.session ? { "Mcp-Session-Id": this.session } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", ...(notification ? {} : { id }), method, ...(params === undefined ? {} : { params }) }),
      signal: this.signal,
    });
    if (!response.ok)
      throw new Error(`n8n MCP ${method} failed (${response.status}). Publish the GeoVision · MCP workflow.`);
    const session = response.headers.get("Mcp-Session-Id");
    if (session) this.session = session;
    if (notification) {
      await response.body?.cancel();
      return;
    }
    let message: any;
    if (response.headers.get("Content-Type")?.includes("text/event-stream")) {
      if (!response.body) throw new Error("n8n MCP returned no response stream.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "", data: string[] = [], bytes = 0;
      try {
        search: for (;;) {
          const part = await reader.read();
          bytes += part.value?.length || 0;
          if (bytes > 2 * 1024 * 1024) throw new Error("n8n MCP response exceeds 2 MiB.");
          pending += decoder.decode(part.value, { stream: !part.done });
          if (part.done) pending += "\n\n";
          let end: number;
          while ((end = pending.indexOf("\n")) >= 0) {
            const line = pending.slice(0, end).replace(/\r$/, "");
            pending = pending.slice(end + 1);
            if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
            if (line || !data.length) continue;
            const candidate = JSON.parse(data.join("\n"));
            data = [];
            if (candidate.id === id) { message = candidate; break search; }
          }
          if (part.done) break;
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    } else {
      const body = await response.text();
      if (body.length > 2 * 1024 * 1024) throw new Error("n8n MCP response exceeds 2 MiB.");
      message = JSON.parse(body);
    }
    if (!message || message.jsonrpc !== "2.0" || message.id !== id)
      throw new Error("n8n MCP returned a missing or mismatched JSON-RPC response.");
    if (message.error) throw new Error(`n8n MCP: ${message.error.message || "Protocol error"}`);
    if (!("result" in message)) throw new Error("n8n MCP returned no result.");
    return message.result;
  }

  async connect(): Promise<void> {
    const result = await this.send("initialize", {
      protocolVersion: this.protocol,
      capabilities: {},
      clientInfo: { name: "audio.cpp-voice-assistant", version: "1.0" },
    });
    if (!result?.capabilities?.tools || typeof result.protocolVersion !== "string")
      throw new Error("n8n MCP server does not advertise tools.");
    this.protocol = result.protocolVersion;
    this.instructions = typeof result.instructions === "string" ? result.instructions : "";
    await this.send("notifications/initialized", undefined, true);
  }

  async tools(): Promise<McpTool[]> {
    const tools: McpTool[] = [];
    let cursor: string | undefined;
    const cursors = new Set<string>();
    for (let page = 0; page < 16; page++) {
      const result = await this.send("tools/list", cursor ? { cursor } : {});
      if (!Array.isArray(result?.tools)) throw new Error("n8n MCP returned an invalid tool list.");
      for (const tool of result.tools) {
        if (!tool || typeof tool.name !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(tool.name) || tool.inputSchema?.type !== "object")
          throw new Error("n8n MCP advertised an invalid tool schema.");
        if (tools.some(existing => existing.name === tool.name)) throw new Error("n8n MCP advertised duplicate tools.");
        tools.push(tool);
      }
      if (tools.length > 128) throw new Error("n8n MCP advertised too many tools.");
      if (!result.nextCursor) return tools;
      cursor = String(result.nextCursor);
      if (cursors.has(cursor)) throw new Error("n8n MCP repeated a tool-list cursor.");
      cursors.add(cursor);
    }
    throw new Error("n8n MCP tool-list pagination exceeded its limit.");
  }

  call(name: string, args: Record<string, unknown>): Promise<any> {
    return this.send("tools/call", { name, arguments: args });
  }

  async close(): Promise<void> {
    if (!this.session) return;
    await fetch(this.url, {
      method: "DELETE",
      headers: { "Mcp-Session-Id": this.session, "MCP-Protocol-Version": this.protocol },
      signal: AbortSignal.timeout(1500),
    }).catch(() => undefined);
  }
}
