import { normalizeTranscript } from "./transcript";
import { maintenanceScenarioHotwords } from "./maintenance-scenario";

const equipment = /([A-Za-z0-9][A-Za-z0-9_/-]*\d[A-Za-z0-9_/-]*)\s*五年一維/g;
const trim = (text: string) =>
  text.replace(/^[\s，,。:：]+|[\s，,。:：]+$/g, "");

// Scenario terminology and formatting only. Never repair missing letters or digits.
export function maintenanceTranscript(text: string, hotwords = ""): string {
  let result = normalizeTranscript(
    text,
    `${maintenanceScenarioHotwords},${hotwords}`,
  )
    .replace(/臺積電/g, "台積電")
    .replace(/(\d{2}:\d{2})[，,]\s*(?=台積電)/g, "$1")
    .replace(/強排[，,\s]+(?=FAN)/gi, "強排")
    .replace(/(強排|間面|界面)[，,\s]*FN(?=\s*\d+\s*個|\b)/gi, "$1FAN")
    .replace(/界面\s*FAN/gi, "間面FAN")
    .replace(/\bFAN\s*(\d+)\s*個/gi, "FAN $1個")
    .replace(/\bSN\s*[:：]?\s*(\d+)/gi, "SN：$1")
    .replace(/製造日期\s*[，,:：]?\s*/g, "製造日期：")
    .replace(/電容值\s*[:：]?\s*/g, "電容值：");
  const items = [...result.matchAll(equipment)];
  if (items.length) {
    const header = trim(result.slice(0, items[0].index));
    const lines = header ? [header + "。"] : [];
    items.forEach((item, index) => {
      const detail = trim(
        result.slice(item.index! + item[0].length, items[index + 1]?.index),
      );
      lines.push(
        `${item[1]} 五年一維，${detail.replace(/(FAN \d+個)[\s，,]*(?=間面FAN)/g, "$1、")}。`,
      );
    });
    result = lines.join("\n");
  }
  return result;
}

function workOrder(text: string): string | undefined {
  if (!/回報工單/.test(text)) return;
  const header = text.split("\n")[0];
  // The reported title, excluding the preceding date/customer. No example defaults.
  return header.match(
    /([A-Za-z0-9][A-Za-z0-9_/-]*\s+VFD[^。\n]*?(?:備品與維修|維修))/i,
  )?.[1];
}

// Readbacks use user messages exclusively. Example prompts and assistant prose
// are deliberately excluded from the source of maintenance facts.
export function maintenanceReply(
  current: string,
  history: ReadonlyArray<{ role: string; content: string }>,
): string | undefined {
  if (/回報工單/.test(current)) {
    const items = current.split("\n").filter((line) => /五年一維/.test(line));
    if (items.length) return items.join("\n\n") + "\n\n以上是否正確。";
    return `已收到：${current}\n\n請補充設備編號、維修項目及數量。`;
  }
  if (/備註/.test(current)) {
    const records = [
      ...current.matchAll(
        /([A-Za-z0-9][A-Za-z0-9_/-]*)\s*[，,。:：]*\s*SN：(\d+)\s*[，,。]*\s*製造日期：(\d{4}年\d{1,2}月\d{1,2}日)\s*[，,。]*\s*電容值：(\d+(?:\.\d+)?MF)/gi,
      ),
    ];
    // Only group when every supplied SN has all its fields; never silently omit
    // an incomplete record or merge conflicting values.
    if (
      records.length &&
      records.length === [...current.matchAll(/SN：/g)].length
    ) {
      const groups = new Map<string, string[]>();
      for (const [, part, sn, date, capacitance] of records) {
        const rows = groups.get(part) || [];
        rows.push(`SN：${sn} 製造日期：${date} 電容值：${capacitance}`);
        groups.set(part, rows);
      }
      return (
        [...groups]
          .map(
            ([part, rows]) =>
              `${part}有${rows.length === 2 ? "兩" : rows.length}個，分別為\n\n${rows.join("\n\n")}`,
          )
          .join("\n\n") + "\n\n以上是否正確。"
      );
    }
    return `本輪備註：\n${current.replace(/^正確[，,\s]*請幫我備註[：:，,\s]*/, "")}\n\n請確認每筆料號、SN、製造日期及電容值是否完整。`;
  }
  if (/正確/.test(current) && /起機測試正常/.test(current)) {
    const latest = [...history]
      .reverse()
      .find(
        (message) =>
          message.role === "user" && /回報工單/.test(message.content),
      );
    const title = latest && workOrder(latest.content);
    return title
      ? `好的，工單：${title}，已輸入完成，謝謝。`
      : "起機測試正常，已記錄。請提供工單名稱以完成回報。";
  }
  return undefined;
}
