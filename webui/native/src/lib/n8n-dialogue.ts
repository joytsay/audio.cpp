export type DialogueSource = "prompt.csv" | "n8n";

export const N8N_LOOKUP_NOTICE = "查詢中，請稍後。";

// Classify only the wait announcement here; the workflow remains authoritative
// for retrieval/save routing. Never announce a save as a lookup.
export function isN8nLookup(text: string, messages: ReadonlyArray<{role: string; content: string}> = []): boolean {
  if (/回報工單|回报工单|新增工單|新增工单|增加工單|增加工单|建立工單/.test(text) && !/查詢|查询|如何|怎麼|怎么|流程|規則|规则|[？?]/.test(text)) return false;
  if (/查詢|查询|查一下|查找|找出|列出|最新|最舊|最旧|最早|工單內容|工单内容|明細|明细|詳情|详情|幾個|几个|多少|呢[？?。\s]*$|SOP|流程|規則|规则|如何|怎麼|怎么|是什麼|是什么|在哪|哪裡|哪里|\b(?:where|what|which|how|lookup|search|find|latest|oldest)\b/i.test(text)) return true;
  const period = /^(?:(?:[\d零〇一二三四五六七八九十]+年)?[\d零〇一二三四五六七八九十]+月|\d{4}-\d{2}|這個月|这个月|本月|上個月|上个月)(?:的|呢|[。？?\s])*$/u;
  const history = messages.filter(m=>m.role === "user");
  if (history.at(-1)?.content === text) history.pop();
  const previous = history.at(-1)?.content;
  if (period.test(text.trim()) && previous) return isN8nLookup(previous, history.slice(0,-1));
  // The workflow retrieves knowledge for ordinary questions too, not only
  // phrases containing 查詢/最新. Suppress filler while collecting report details.
  return !history.some(m => /回報工單|回报工单|新增工單|新增工单|增加工單|增加工单|建立工單/.test(m.content));
}

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
    onProgress?: (text: string, signal: AbortSignal) => void | Promise<void>;
    onWorkflow?: (state: "started" | "completed" | "failed") => void;
  } = {},
): Promise<string> {
  signal.throwIfAborted();
  options.onWorkflow?.("started");
  const noticeController = new AbortController();
  const noticeSignal = AbortSignal.any([signal, noticeController.signal]);
  let notice: Promise<void> = Promise.resolve();
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const request = fetch(options.workflowUrl || "/n8n/webhook/ivr-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
    if (options.onProgress && isN8nLookup(input.text, input.messages))
      noticeTimer = setTimeout(() => {
        if (!noticeSignal.aborted) notice = Promise.resolve().then(()=>options.onProgress!(N8N_LOOKUP_NOTICE, noticeSignal)).catch(()=>undefined);
      }, 5000);
    const response = await request;
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
    clearTimeout(noticeTimer);
    await notice;
    signal.throwIfAborted();
    options.onWorkflow?.("completed");
    return result.reply.trim();
  } catch (error) {
    clearTimeout(noticeTimer);
    noticeController.abort();
    await notice;
    options.onWorkflow?.("failed");
    throw error;
  }
}
