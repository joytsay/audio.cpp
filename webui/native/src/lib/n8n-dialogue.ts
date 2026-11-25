export type DialogueSource = "prompt.csv" | "n8n";

export const DEFAULT_NOTICE_DELAY_SECONDS = 2;

// The last wait phrase each call heard, so consecutive notices differ.
const lastNotice = new Map<string, string>();
export function pickNotice(sessionId: string, phrases: string[], random = Math.random): string {
  const fresh = phrases.filter(phrase => phrase !== lastNotice.get(sessionId));
  const options = fresh.length ? fresh : phrases;
  const phrase = options[Math.floor(random() * options.length)] ?? "";
  if (phrase) {
    lastNotice.delete(sessionId);
    lastNotice.set(sessionId, phrase);
    if (lastNotice.size > 200) lastNotice.delete(lastNotice.keys().next().value!);
  }
  return phrase;
}

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
    // Wait notice: when a caller turn is still running after this many
    // seconds, onNotice receives a phrase saying what is being done
    // (「好的，我幫您查一下庫存，請稍等。」). onNoticeReady gets the same phrase
    // as soon as it is known, so speech can be prepared before it is needed.
    noticeDelaySeconds?: number;
    onNoticeReady?: (phrase: string) => void;
    onNotice?: (phrase: string, signal: AbortSignal) => void | Promise<void>;
    onWorkflow?: (state: "started" | "completed" | "failed") => void;
  } = {},
): Promise<IvrResponse> {
  signal.throwIfAborted();
  options.onWorkflow?.("started");
  const workflowUrl = options.workflowUrl || "/n8n/webhook/ivr-agent";
  const noticeController = new AbortController();
  const noticeSignal = AbortSignal.any([signal, noticeController.signal]);
  let notice: Promise<void> = Promise.resolve();
  let noticeStarted = false;
  if (options.onNotice && !input.start && input.text?.trim()) {
    const configured = options.noticeDelaySeconds;
    const delay = (typeof configured === "number" && configured > 0 && configured <= 60 ? configured : DEFAULT_NOTICE_DELAY_SECONDS) * 1000;
    const phrase = fetch(workflowUrl.replace(/ivr-agent$/, "ivr-intent"), {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({sessionId: input.sessionId, text: input.text}), signal: noticeSignal,
    }).then(response => response.ok ? response.json() : undefined)
      .then(result => {
        const chosen = Array.isArray(result?.phrases) ? pickNotice(input.sessionId, result.phrases.filter((item: unknown) => typeof item === "string")) : "";
        if (chosen && !noticeSignal.aborted) options.onNoticeReady?.(chosen);
        return chosen;
      }).catch(() => "");
    const due = new Promise<void>(resolve => {
      const timer = setTimeout(resolve, delay);
      noticeSignal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, {once: true});
    });
    notice = Promise.all([phrase, due]).then(([text]) => {
      if (!text || noticeSignal.aborted) return;
      noticeStarted = true;
      return options.onNotice!(text, noticeSignal);
    }).catch(() => undefined);
  }
  try {
    const response = await fetch(workflowUrl, {
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
    // A notice already being spoken finishes before the reply; one not yet
    // started is cancelled.
    if (!noticeStarted) noticeController.abort();
    await notice;
    signal.throwIfAborted();
    options.onWorkflow?.("completed");
    return {...result, reply: result.reply.trim()} as IvrResponse;
  } catch (error) {
    noticeController.abort();
    await notice;
    options.onWorkflow?.("failed");
    throw error;
  }
}
