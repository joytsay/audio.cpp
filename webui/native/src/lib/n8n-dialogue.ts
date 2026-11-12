export type DialogueSource = "prompt.csv" | "n8n";

// The agent, MCP client and session memory run inside GeoVision · Workflow.
// Browser and SIP callers share this transport and never run a second LLM loop.
export async function n8nDialogue(
  input: {
    sessionId: string;
    text: string;
    model: string;
    messages: ReadonlyArray<{ role: string; content: string }>;
  },
  signal: AbortSignal,
  options: {
    workflowUrl?: string;
    onTool?: (name: string, state: "started" | "completed" | "failed") => void;
    onWorkflow?: (state: "started" | "completed" | "failed") => void;
  } = {},
): Promise<string> {
  signal.throwIfAborted();
  options.onWorkflow?.("started");
  try {
    const response = await fetch(options.workflowUrl || "/n8n/webhook/ivr-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
    const raw = await response.text();
    let result: any;
    try { result = JSON.parse(raw); } catch { /* Include plain upstream errors below. */ }
    if (!response.ok) {
      const detail = result?.message || result?.error?.message || result?.error || raw;
      const hint = response.status === 404 ? " Publish「GeoVision · Workflow」後重試。" : "";
      throw new Error(`n8n AI Agent workflow failed (${response.status}): ${String(detail).slice(0, 1200)}${hint}`);
    }
    if (typeof result?.reply !== "string" || !result.reply.trim())
      throw new Error("n8n AI Agent returned no reply. Check the GeoVision · Workflow execution for errors.");
    // Webhook responses include completed intermediate steps. These are reported
    // after execution; they are not a live stream of individual tool starts.
    for (const name of Array.isArray(result.tools) ? result.tools : [])
      if (typeof name === "string") options.onTool?.(name, "completed");
    options.onWorkflow?.("completed");
    return result.reply.trim();
  } catch (error) {
    options.onWorkflow?.("failed");
    throw error;
  }
}
