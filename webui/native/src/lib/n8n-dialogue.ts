export type DialogueSource = "prompt.csv" | "n8n";

export type IvrResponse = {
  reply: string;
  stage: "opening" | "menu" | "scenario";
  status: string;
  language: "zh" | "en";
  awaitingLanguage: boolean;
  scenario: {number: number; title: string} | null;
  work_order?: {order_id: string; pending: boolean};
};

// GeoVision · Workflow forwards each call turn to the knowledge service's IVR
// engine, which holds the call state (opening, 情境 routing, dialogue history)
// and grounds every reply in the uploaded HTML call script. Browser and SIP
// callers share this client and send only the session ID and caller text.
export async function ivrDialogue(
  input: {sessionId: string; text?: string; start?: boolean; scenarioId?: string},
  signal: AbortSignal,
  options: {
    workflowUrl?: string;
    onWorkflow?: (state: "started" | "completed" | "failed") => void;
  } = {},
): Promise<IvrResponse> {
  signal.throwIfAborted();
  options.onWorkflow?.("started");
  try {
    const response = await fetch(options.workflowUrl || "/n8n/webhook/ivr-agent", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(input),
      signal,
    });
    const raw = await response.text();
    let result: any;
    try { result = JSON.parse(raw); } catch { /* Report the plain upstream error below. */ }
    if (!response.ok) {
      const detail = result?.message || result?.error?.message || result?.error || raw;
      const hint = response.status === 404 ? " Publish「GeoVision · Workflow」後重試。" : "";
      throw new Error(`IVR workflow failed (${response.status}): ${String(detail).slice(0, 1200)}${hint}`);
    }
    if (typeof result?.reply !== "string" || !result.reply.trim())
      throw new Error("The IVR workflow returned no reply. Check the GeoVision · Workflow execution for errors.");
    signal.throwIfAborted();
    options.onWorkflow?.("completed");
    return {...result, reply: result.reply.trim()} as IvrResponse;
  } catch (error) {
    options.onWorkflow?.("failed");
    throw error;
  }
}
