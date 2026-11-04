// One context column. CSV quoting preserves commas, quotes and multiline terms.
export function readHotwordsCsv(csv: string): string {
  const match = csv
    .replace(/^\uFEFF/, "")
    .match(/^(?:context|hotwords)\r?\n([\s\S]*?)\r?\n?$/);
  if (!match)
    throw new Error(
      "hotwords.csv must have a context header and one context row.",
    );
  let value = match[1];
  if (value.startsWith('"')) {
    if (!/^"(?:[^"]|"")*"$/.test(value))
      throw new Error("Invalid quoted context in hotwords.csv.");
    value = value.slice(1, -1).replace(/""/g, '"');
  } else if (/[",\r\n]/.test(value))
    throw new Error("Quote context containing commas or newlines.");
  return value;
}
export function writeHotwordsCsv(context: string): string {
  return `context\n"${context.replace(/"/g, '""')}"\n`;
}
