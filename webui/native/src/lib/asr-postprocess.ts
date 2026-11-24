import { endpointJson, type ChatMessage } from "./openai";
import { normalizeTranscript, traditionalTranscript } from "./transcript";

export const DEFAULT_ASR_POSTPROCESS_MODEL = "s1-mini-chinese-1106-bf16";
export const DEFAULT_ASR_POSTPROCESS_LABEL = "S1-mini-Chinese-1106 · BF16";

const instructions =
  "You are a text normalizer for speech-to-text transcripts. The input begins " +
  "with a control line specifying the styling, structure, and context settings; " +
  "clean the transcript to match those settings and output only the cleaned text. " +
  "Use Traditional Chinese for Chinese text and preserve other languages, names, numbers, units, and identifiers. " +
  "Do not answer the transcript.";

function technicalTokens(text: string): string[] {
  return (text.normalize("NFKC").match(/[A-Za-z0-9]+(?:[./_:+-][A-Za-z0-9]+)*/g) ?? [])
    .filter(token => /[0-9]/.test(token));
}

interface CorrectionResponse {
  choices?: { finish_reason?: string; message?: { content?: string } }[];
}

export async function correctAsrTranscript(
  text: string,
  model: string,
  hotwords: string,
  routerBase: string,
  signal: AbortSignal,
  { defaultBase = "/asr-postprocess/v1", limitInputLength = true } = {},
): Promise<string> {
  const original = traditionalTranscript(text);
  const length = [...original].length;
  if (!original.trim() || (limitInputLength && (length < 3 || length > 1200))) return original;
  const defaultModel = model === DEFAULT_ASR_POSTPROCESS_MODEL;
  const messages: ChatMessage[] = [
    { role: "system", content: instructions },
    { role: "user", content: "[Styling: semi-formal] [Structure: prose] [Context: general]\n" + text },
  ];
  const result = await endpointJson<CorrectionResponse>(
    defaultModel ? defaultBase : routerBase,
    defaultModel ? "chat/completions" : "chat/completions?autoload=true",
    {
      method: "POST",
      body: JSON.stringify({
        model, messages, temperature: 0, stream: false,
        max_tokens: Math.min(512, length * 2 + 32),
        chat_template_kwargs: { enable_thinking: false },
      }),
    },
    AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
  );
  const choice = result.choices?.[0];
  const content = choice?.message?.content;
  if (choice?.finish_reason !== "stop" || typeof content !== "string" ||
      /<\/?think>|\[Styling:/i.test(content)) return original;
  // Apply OpenCC after inference even when the model outputs Simplified Chinese.
  const candidate = normalizeTranscript(content, hotwords).trim();
  if (!candidate || [...candidate].length > length * 1.5 + 10 ||
      technicalTokens(candidate).join("|") !== technicalTokens(original).join("|")) return original;
  return candidate;
}
