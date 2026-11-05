// Two logical lines per request, with a length ceiling for unbroken paragraphs.
// Keep equipment IDs, serials, dates and spoken digit runs together.
export function splitSpeechText(text: string, maxChars = 120): string[] {
  const lines: string[] = [];
  for (const line of text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)) {
    const tokens =
      line.match(
        /[A-Za-z0-9零〇一二兩三四五六七八九伍][A-Za-z0-9零〇一二兩三四五六七八九伍_/:：.\-]*|./gu,
      ) || [];
    let pending = "",
      lastBreak = 0;
    for (const token of tokens) {
      if ([...(pending + token)].length > maxChars && pending) {
        const cut = lastBreak || pending.length;
        const part = pending.slice(0, cut).trim();
        if (part) lines.push(part);
        pending = pending.slice(cut).trimStart();
        lastBreak = 0;
        if ([...(pending + token)].length > maxChars && pending) {
          lines.push(pending.trim());
          pending = "";
        }
      }
      pending += token;
      if (/[，,。！？!?；;\s]$/u.test(token)) lastBreak = pending.length;
    }
    if (pending.trim()) lines.push(pending.trim());
  }
  const groups: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let group = lines[i];
    if (
      i + 1 < lines.length &&
      [...(group + "\n" + lines[i + 1])].length <= maxChars
    )
      group += "\n" + lines[++i];
    groups.push(group);
  }
  return groups;
}
