import * as ToTraditional from 'opencc-js/cn2t';

// OpenCC's local dictionaries include phrase mappings (for ambiguous characters).
// No network or generative translation: identifiers, Latin text and digits stay intact.
const convert = ToTraditional.Converter({ from: 'cn', to: 'tw' });
export function traditionalTranscript(text: string): string {
  return convert(text);
}

export function traditionalTranscriptionResponse<T>(response: T): T {
  if (!response || typeof response !== 'object') return response;
  const result = { ...response } as Record<string, unknown>;
  for (const field of ['text', 'transcript', 'word']) {
    if (typeof result[field] === 'string') result[field] = traditionalTranscript(result[field] as string);
  }
  for (const field of ['segments', 'words', 'utterances']) {
    if (Array.isArray(result[field])) result[field] = result[field].map(traditionalTranscriptionResponse);
  }
  if (result.text_output && typeof result.text_output === 'object') {
    result.text_output = traditionalTranscriptionResponse(result.text_output);
  }
  return result as T;
}

export function isTranscriptionPath(path: string): boolean {
  return /(?:^|\/)audio\/transcriptions(?:\/details)?(?:\?|$)/.test(path);
}
