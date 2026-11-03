// One-column CSV with one greeting. Quoted fields allow commas and newlines.
export function readGreetingCsv(csv: string): string {
  const match = csv
    .replace(/^\uFEFF/, "")
    .match(/^greeting\r?\n([\s\S]*?)\r?\n?$/);
  if (!match)
    throw new Error(
      "greetings.csv must contain a greeting header and one greeting row.",
    );
  let value = match[1];
  if (value.startsWith('"')) {
    if (!/^"(?:[^"]|"")*"$/.test(value))
      throw new Error("Invalid quoted greeting in greetings.csv.");
    value = value.slice(1, -1).replace(/""/g, '"');
  } else if (/[",\r\n]/.test(value))
    throw new Error("Quote greetings containing commas or newlines.");
  if (!value.trim()) throw new Error("The greeting cannot be empty.");
  return value;
}

export function writeGreetingCsv(greeting: string): string {
  if (!greeting.trim()) throw new Error("The greeting cannot be empty.");
  return `greeting\n"${greeting.replace(/"/g, '""')}"\n`;
}
