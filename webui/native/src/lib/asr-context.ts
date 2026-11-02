import * as ToSimplified from 'opencc-js/t2cn';
import * as ToTraditional from 'opencc-js/cn2t';

const toSimplified = ToSimplified.Converter({ from: 'tw', to: 'cn' });
const toTraditional = ToTraditional.Converter({ from: 'cn', to: 'tw' });

// Nemotron commonly emits Simplified Chinese. Bias both spellings of a user's
// term so Traditional context also competes with its actual decoder tokens.
export function recognitionContext(context: string, family: string): string {
  if (family !== 'nemotron_asr' || !context.trim()) return context;
  const normalized = context.replace(/^technical terms:/i, '').replace(/[，、；]/g, ',');
  const phrases = normalized.split(/[,;\r\n]/.test(normalized) ? /[,;\r\n]/ : /\s+/)
    .map(phrase => phrase.trim()).filter(Boolean);
  const variants = phrases.flatMap(phrase => [phrase, toSimplified(phrase), toTraditional(phrase)]);
  return [...new Set(variants)].join('\n');
}
