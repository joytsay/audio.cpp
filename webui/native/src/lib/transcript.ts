import {
  normalizeSpokenNumbers,
  restoreTechnicalIdentifiers,
} from "./transcript-numbers";
import * as ToTraditional from "opencc-js/cn2t";

// OpenCC's local dictionaries include phrase mappings (for ambiguous characters).
// No network or generative translation: identifiers, Latin text and digits stay intact.
const convert = ToTraditional.Converter({ from: "cn", to: "tw" });
export function traditionalTranscript(text: string): string {
  return convert(text);
}

export function normalizeTranscript(text: string, context = ""): string {
  return restoreTechnicalIdentifiers(
    normalizeSpokenNumbers(traditionalTranscript(text)),
    context,
  );
}

export function traditionalTranscriptionResponse<T>(response: T): T {
  if (!response || typeof response !== "object") return response;
  const result = { ...response } as Record<string, unknown>;
  for (const field of ["text", "transcript", "word"]) {
    if (typeof result[field] === "string")
      result[field] = normalizeTranscript(result[field] as string);
  }
  for (const field of ["segments", "words", "utterances"]) {
    if (Array.isArray(result[field]))
      result[field] = result[field].map(traditionalTranscriptionResponse);
  }
  for (const field of [
    "text_output",
    "partial_text",
    "partial_text_snapshot",
  ]) {
    if (result[field] && typeof result[field] === "object")
      result[field] = traditionalTranscriptionResponse(result[field]);
  }
  return result as T;
}

export function isTranscriptionPath(path: string): boolean {
  return /(?:^|\/)audio\/transcriptions(?:\/details)?(?:\?|$)/.test(path);
}
