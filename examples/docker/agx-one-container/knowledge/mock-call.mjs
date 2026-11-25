// The caller's side of an HTML call script, for the demo's mock call, and the
// fresh values a test run speaks in place of the script's own.

const spoken = text => String(text ?? '').replace(/\s+/g, ' ')
  .replace(/(?<=[\p{Script=Han}　-〿＀-￯]) (?=[\p{Script=Han}　-〿＀-￯])/gu, '').trim();

// Opening answers: the digit the script's own language prompt offers for
// 中文, then the script's caller answers without the last one (the menu
// answer). Per 情境 its caller lines; an outbound 情境 is selected by its title.
export function mockCallScript(template = []) {
  const opening = template.find(section => !Number.isInteger(section.number))?.turns ?? [];
  const prompt = opening.find(turn => turn.role === 'assistant' && /語言|language/i.test(turn.text));
  const digit = prompt && spoken(prompt.text).normalize('NFKC').match(/中文\s*(\d)/)?.[1];
  const answers = opening.filter(turn => turn.role === 'caller').map(turn => spoken(turn.text)).filter(Boolean).slice(0, -1);
  return {
    opening: [...(digit ? [digit] : []), ...answers],
    sections: template.filter(section => Number.isInteger(section.number) && section.turns?.length).map(section => {
      const outbound = section.turns[0].role === 'assistant';
      const lines = section.turns.filter(turn => turn.role === 'caller').map(turn => spoken(turn.text)).filter(Boolean);
      return {number: section.number, title: section.title, outbound, lines: outbound ? [section.title, ...lines] : lines};
    }),
  };
}

// Codes and digits a line must keep when only its names are changed.
export const lineSignature = line => (String(line).normalize('NFKC').match(/[A-Za-z0-9]+/g) ?? []).join(' ');

// The scale a score answers, from the AI's question (以1-5為評分 → [1, 5]).
export function scoreScale(text) {
  const match = String(text ?? '').normalize('NFKC').match(/(\d+)\s*[-~–到至]\s*(\d+)/);
  if (!match) return undefined;
  const [lo, hi] = [Number(match[1]), Number(match[2])].sort((a, b) => a - b);
  return hi - lo >= 1 && hi - lo <= 100 ? [lo, hi] : undefined;
}

const pick = (random, lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
const pad = (value, size) => String(value).padStart(size, '0');
function digitsLike(digits, random) {
  let out = '';
  // A leading digit stays non-zero (so 2個 never becomes 0個).
  for (let i = 0; i < digits.length; i++) out += i === 0 && digits[0] !== '0' ? pick(random, 1, 9) : pick(random, 0, 9);
  return out;
}

// Every number the caller says gets a random value of the same length and
// format: dates stay valid dates, times valid times (on the same side of
// noon), a bare score stays on its scale. Codes are kept: tokens with a letter
// before a digit, joined by - _ / , or with four or more letters after the
// digits (PF753, F15P1H4K-GEX-EF-03, 1756ESMCAP), and a number after "Code".
// Readings with a short unit (480V, 60HZ, 6460MF, 2個) are numbers.
export function varyNumbers(line, {scale, random = Math.random} = {}) {
  const text = String(line);
  const bare = text.trim().match(/^\d+$/);
  if (bare && scale) {
    const [lo, hi] = scale;
    let value = pick(random, lo, hi);
    if (hi > lo && String(value) === bare[0]) value = value === hi ? lo : value + 1;
    return String(value);
  }
  return text.replace(/(\d{4})年(\d{1,2})月(\d{1,2})日|(\d{1,2})([:：])(\d{2})|[A-Za-z0-9][A-Za-z0-9_/.\-]*/g,
    (match, year, month, day, hour, colon, minute, offset) => {
      if (year) return `${pick(random, Number(year) - 1, Number(year) + 1)}年${pick(random, 1, 12)}月${pick(random, 1, 28)}日`;
      if (hour) {
        const afternoon = Number(hour) >= 12;
        const value = afternoon ? pick(random, 12, 17) : pick(random, 8, 11);
        return `${hour.length === 2 ? pad(value, 2) : value}${colon}${pad(pick(random, 0, 3) * 15, 2)}`;
      }
      if (!/\d/.test(match)) return match;
      const code = /[A-Za-z]\d/.test(match) && /^[A-Za-z]/.test(match) || /[_/\-]/.test(match) ||
        /\d[A-Za-z]{4,}/.test(match) || /\d[A-Za-z]+\d/.test(match) ||
        /code\s*[:：]?\s*$/i.test(text.slice(Math.max(0, offset - 12), offset));
      return code ? match : match.replace(/\d+/g, digits => digitsLike(digits, random));
    });
}
