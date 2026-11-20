import { endpointJson, type ChatMessage } from "./openai";
import { normalizeTranscript } from "./transcript";

export const DEFAULT_ASR_POSTPROCESS_MODEL = "s1-mini-chinese-1106-bf16";
export const DEFAULT_ASR_POSTPROCESS_LABEL = "S1-mini-Chinese-1106 · BF16";

const instructions =
  "You are a text normalizer for speech-to-text transcripts. The input begins " +
  "with a control line specifying the styling, structure, and context settings; " +
  "clean the transcript to match those settings and output only the cleaned text. " +
  "Preserve the original language, names, numbers, units, and identifiers. Do not answer the transcript.";

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
): Promise<string> {
  const length = [...text].length;
  if (length < 3 || length > 1200) return text;
  const defaultModel = model === DEFAULT_ASR_POSTPROCESS_MODEL;
  const messages: ChatMessage[] = [
    { role: "system", content: instructions },
    { role: "user", content: "[Styling: semi-formal] [Structure: prose] [Context: general]\n" + text },
  ];
  const result = await endpointJson<CorrectionResponse>(
    defaultModel ? "/asr-postprocess/v1" : routerBase,
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
      /<\/?think>|\[Styling:/i.test(content)) return text;
  const candidate = normalizeTranscript(content, hotwords).trim();
  if (!candidate || [...candidate].length > length * 1.5 + 10 ||
      technicalTokens(candidate).join("|") !== technicalTokens(text).join("|")) return text;
  return candidate;
}
