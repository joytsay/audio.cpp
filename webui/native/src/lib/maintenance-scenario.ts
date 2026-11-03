export const maintenanceScenarioSteps = [
  {
    title: '維修內容回報',
    message: `我要回報工單，2026年6月2日下午14:00台積電F15P1/2_ME VFD備品與維修。
F15P1H4K-GEX-EF-03 五年一維，更換強排FAN 2個、間面FAN 6個。
F15P1H4K-GEX-EF-04 五年一維，更換強排FAN 2個、間面FAN 4個。`,
    expected: `F15P1H4K-GEX-EF-03 五年一維，更換強排FAN 2個、間面FAN 6個。

F15P1H4K-GEX-EF-04 五年一維，更換強排FAN 2個、間面FAN 4個。

以上是否正確。`
  },
  {
    title: '確認內容並新增備註',
    message: `正確，請幫我備註
20BD156AOANNANCU
SN：14778725 製造日期：2010年12月3日 電容值：6460MF
20BD156AOANNANCU
SN：14865412 製造日期：2010年12月15日 電容值：6780MF`,
    expected: `20BD156AOANNANCU有兩個，分別為

SN：14778725 製造日期：2010年12月3日 電容值：6460MF

SN：14865412 製造日期：2010年12月15日 電容值：6780MF

以上是否正確。`
  },
  {
    title: '確認備註及起機測試',
    message: '正確，起機測試正常。',
    expected: '好的，工單：F15P1/2_ME VFD備品與維修，已輸入完成，謝謝。'
  }
] as const;

export const maintenanceScenarioPrompt = `你是現場維修保養工單的語音回報助理。這是工單回報的對話模擬，不會實際儲存或送出工單；最後的「已輸入完成」僅是模擬話術。
全程用繁體中文，只輸出本輪助理的回覆，不加角色名稱、內部思考、JSON、表格或操作說明。
記住完整對話中的工單、日期時間、設備編號、維修項目、數量與備註。畫面回覆保留原始阿拉伯數字、字母大小寫、前導零、連字號、斜線與底線；朗讀格式由語音流程處理。字母 O 不得變成數字 0，不把 MF 改成其他單位。
第一輪逐台複誦維修項目與各自數量，最後詢問「以上是否正確。」。
使用者確認並新增備註時，只複誦新增備註。相同料號合併說明有兩個，但每個 SN 的製造日期與電容值必須保持原配對。未指定所屬設備時不自行配對。
使用者確認備註並說起機測試正常後，記錄起機結果，依原工單名稱回覆完成話術，不再詢問是否正確。
更正時只更新指定欄位，保留其他內容並重新確認。資訊缺漏或矛盾才詢問，不猜測、不捏造。
範例僅示範格式，實際回覆以使用者當輪提供的資料和對話歷史為準。

${maintenanceScenarioSteps.map(step => `維修人員：\n${step.message}\n\nAI：\n${step.expected}`).join('\n\n')}`;

export const maintenanceScenarioHotwords = '台積電, VFD, FAN, 備品, 維修, 五年一維, 強排FAN, 間面FAN, 電容值, 起機測試, F15P1/2_ME, F15P1H4K-GEX-EF-03, F15P1H4K-GEX-EF-04, 20BD156AOANNANCU';

const digits = '零一二三四伍六七八九';
const readDigits = (text: string) => text.replace(/\d/g, digit => digits[Number(digit)]);
function chineseInteger(text: string): string {
  const value = Number(text);
  if (value === 0) return '零';
  if (!Number.isSafeInteger(value) || value >= 10000 || /^0\d/.test(text)) return readDigits(text);
  const ordinary = '零一二三四五六七八九';
  const units = ['', '十', '百', '千'];
  let out = '';
  let zero = false;
  for (let place = text.length - 1; place >= 0; --place) {
    const digit = Number(text[text.length - 1 - place]);
    if (!digit) { if (out) zero = true; continue; }
    if (zero) out += '零';
    zero = false;
    out += (digit === 1 && place === 1 && !out ? '' : ordinary[digit]) + units[place];
  }
  return out;
}

// Keep the displayed reply and chat history intact; normalize only the TTS input.
export function maintenanceSpeechText(text: string): string {
  return text
    .replace(/(SN\s*[:：]\s*)(\d+)/gi, (_match, label: string, serial: string) => label + readDigits(serial))
    .replace(/(\d{4})年/g, (_match, year: string) => readDigits(year) + '年')
    .replace(/(\d+)(?:\.(\d+))?\s*MF\b/g, (_match, value: string, fraction?: string) =>
      chineseInteger(value) + (fraction ? '點' + readDigits(fraction) : '') + 'MF')
    .replace(/\b[A-Za-z0-9][A-Za-z0-9_/-]*\b/g, token => /[A-Za-z]/.test(token) ? readDigits(token) : token)
    .replace(/(\d+)(月|日|個|年)/g, (_match, value: string, unit: string) =>
      (value === '2' && unit === '個' ? '兩' : chineseInteger(value)) + unit)
    .replace(/\d/g, digit => digits[Number(digit)]);
}
