const digitValues: Record<string, string> = {
  零: "0",
  〇: "0",
  "○": "0",
  一: "1",
  壹: "1",
  二: "2",
  兩: "2",
  貳: "2",
  三: "3",
  參: "3",
  四: "4",
  肆: "4",
  五: "5",
  伍: "5",
  六: "6",
  陸: "6",
  七: "7",
  柒: "7",
  八: "8",
  捌: "8",
  九: "9",
  玖: "9",
};
const units: Record<string, number> = {
  十: 10,
  拾: 10,
  百: 100,
  佰: 100,
  千: 1000,
  仟: 1000,
  萬: 10000,
  億: 100000000,
};
const digits = Object.keys(digitValues).join("");
const numberChars = digits + Object.keys(units).join("");
const numberPattern = `[${numberChars}]+`;

export function chineseNumber(text: string): string | undefined {
  const value = text.replace(/\s/g, "");
  if (!value) return undefined;
  if ([...value].every((char) => digitValues[char] !== undefined))
    return [...value].map((char) => digitValues[char]).join(""); // Preserve leading zeros and long serials.
  let total = 0,
    section = 0,
    number = 0;
  for (const char of value) {
    if (digitValues[char] !== undefined) {
      number = number * 10 + Number(digitValues[char]);
      continue;
    }
    const unit = units[char];
    if (!unit) return undefined;
    if (unit === 100000000) {
      total = (total + section + number || 1) * unit;
      section = 0;
    } else if (unit === 10000) {
      total += (section + number || 1) * unit;
      section = 0;
    } else section += (number || 1) * unit;
    number = 0;
  }
  const result = total + section + number;
  return Number.isSafeInteger(result) ? String(result) : undefined;
}

export function normalizeSpokenNumbers(text: string): string {
  let result = text.replace(
    new RegExp(`(${numberPattern})\\s*年`, "g"),
    (match, year: string) => {
      const number = chineseNumber(year);
      return number && /^[1-9]\d{3}$/.test(number) ? `${number}年` : match;
    },
  );
  const dateNumber = `(?:${numberPattern}|\\d{1,2})`;
  const read = (value: string) =>
    /^\d+$/.test(value) ? value : chineseNumber(value);
  result = result.replace(
    new RegExp(`(${dateNumber})\\s*月\\s*(${dateNumber})\\s*(日|號)`, "g"),
    (match, month: string, day: string, unit: string) => {
      const m = Number(read(month)),
        d = Number(read(day));
      return m >= 1 && m <= 12 && d >= 1 && d <= 31
        ? `${m}月${d}${unit}`
        : match;
    },
  );
  result = result.replace(
    new RegExp(`(${numberPattern})\\s*月`, "g"),
    (match, month: string) => {
      const value = Number(chineseNumber(month));
      return value >= 1 && value <= 12 ? `${value}月` : match;
    },
  );
  result = result.replace(
    new RegExp(
      `((?:S/N|SN|序號|序列號|電容值)[\\s:：]*)(${numberPattern})(?:點([${digits}]+))?(?![${numberChars}點])`,
      "gi",
    ),
    (match, prefix: string, value: string, fraction: string | undefined) => {
      const number = chineseNumber(value),
        decimal = fraction ? chineseNumber(fraction) : undefined;
      return number === undefined
        ? match
        : prefix + number + (decimal !== undefined ? "." + decimal : "");
    },
  );
  // Numeric field/unit contexts only: keep ordinary prose and 五年一維 unchanged.
  result = result.replace(
    new RegExp(
      `(?<![${numberChars}點])(${numberPattern})(?:點([${digits}]+))?\\s*(MF|mF|μF|uF|V|A|kW|kV|Hz|mm|cm|kg|rpm|個|台|臺|組|件|支|顆|套)(?![A-Za-z])`,
      "gi",
    ),
    (match, value: string, fraction: string | undefined, unit: string) => {
      const number = chineseNumber(value),
        decimal = fraction ? chineseNumber(fraction) : undefined;
      return number === undefined
        ? match
        : number + (decimal !== undefined ? "." + decimal : "") + unit;
    },
  );
  const timePattern = `(上午|下午|晚上|早上|中午|凌晨|傍晚|\\d{1,2}月\\d{1,2}(?:日|號))\\s*(${dateNumber})\\s*(?:點|時)(?:\\s*(?:(${dateNumber})分|(半)))?(?:\\s*(${dateNumber})秒)?`;
  result = result.replace(
    new RegExp(timePattern, "g"),
    (
      match,
      prefix: string,
      hour: string,
      minute: string | undefined,
      half: string | undefined,
      second: string | undefined,
    ) => {
      const h = Number(read(hour)),
        m = half ? 30 : minute ? Number(read(minute)) : 0,
        s = second ? Number(read(second)) : 0;
      if (
        ![h, m, s].every(Number.isInteger) ||
        h < 0 ||
        h > 23 ||
        m < 0 ||
        m > 59 ||
        s < 0 ||
        s > 59
      )
        return match;
      return (
        prefix +
        String(h).padStart(2, "0") +
        ":" +
        String(m).padStart(2, "0") +
        (second ? ":" + String(s).padStart(2, "0") : "")
      );
    },
  );
  // ASR can insert spaces between a short identifier prefix and spoken digits.
  // Rejoin only multi-digit runs, leaving prose such as A 一樣 untouched.
  result = result.replace(
    new RegExp(`(?<![A-Za-z0-9])([A-Za-z]{1,2})[ \t]+([0-9${digits}](?:[ \t]*[0-9${digits}])+)`, "g"),
    (_match, prefix: string, value: string) => prefix + value.replace(/[ \t]/g, ""),
  );
  // Without this boundary, EF零三五年一維 would incorrectly become EF035年一維.
  return result
    .split(/(五\s*年\s*一\s*維)/)
    .map((part) =>
      /^五\s*年\s*一\s*維$/.test(part)
        ? part
        : part.replace(
            new RegExp(`[A-Za-z0-9_/${numberChars}-]+`, "g"),
            (token) => {
              if (
                !/[A-Za-z]/.test(token) ||
                !new RegExp(`[${numberChars}]`).test(token)
              )
                return token;
              // Avoid changing prose such as API一樣 or GPU一開始. Codes have a short
              // letter prefix, multiple digits, separators, or an internal letter/digit run.
              const chinese = token.match(new RegExp(numberPattern, "g")) || [];
              const code =
                new RegExp(`^[${numberChars}]`).test(token) ||
                new RegExp(`^[A-Z]{1,2}[${numberChars}]+$`).test(token) ||
                /[0-9_/-]/.test(token) ||
                chinese.some((run) => run.length >= 2) ||
                chinese.length >= 2;
              return code
                ? token.replace(
                    new RegExp(numberPattern, "g"),
                    (run) => chineseNumber(run) ?? run,
                  )
                : token;
            },
          ),
    )
    .join("");
}

// Restore separators/case only when the entire identifier matches exactly one
// supplied hotword. Never repair missing letters, digits, or O/0 by guessing.
export function restoreTechnicalIdentifiers(
  text: string,
  context: string,
): string {
  const canonical = new Map<string, string | null>();
  for (const term of context
    .replace(/^technical terms:\s*/i, "")
    .split(/[,，、;；\r\n]+/)
    .map((term) => term.trim())) {
    if (
      !/^[A-Za-z0-9][A-Za-z0-9_/-]*$/.test(term) ||
      !/[A-Za-z]/.test(term) ||
      !/\d/.test(term)
    )
      continue;
    const key = term.replace(/[_/-]/g, "").toUpperCase();
    if (canonical.has(key) && canonical.get(key) !== term)
      canonical.set(key, null);
    else if (!canonical.has(key)) canonical.set(key, term);
  }
  let result = text;
  for (const [key, term] of [...canonical].sort(
    ([a], [b]) => b.length - a.length,
  )) {
    if (!term) continue;
    const pattern = `(?<![A-Za-z0-9])${[...key].join("[\\s_/-]*")}(?![A-Za-z0-9])`;
    result = result.replace(new RegExp(pattern, "gi"), () => term);
  }
  return result;
}
