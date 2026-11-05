import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(new URL("../package.json", import.meta.url));
const { buildSync } = require("esbuild");
const compiled = buildSync({
  entryPoints: [
    fileURLToPath(new URL("../src/lib/maintenance-report.ts", import.meta.url)),
  ],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { maintenanceTranscript, maintenanceReply } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`
);
const first =
  "我要回報工單，二零二六年六月二日下午十四點，臺積電F一五P一二ME VFD備品與維修，F一五P一H四K GEX-EF零三五年一維更換強排，FAN二個界面FAN六個，F一五P一H四K GEX-EF零四五年一維更換強排FAN二個界面FAN四個。";
const second =
  "正確，請幫我備註：二零BD一五六AOAANNCU，SN一四七七八七二五製造日期，二零一零年十二月三日電容值六四六零MF，二零BD一五六AOAANNCU，SN一四八六五四一二製造日期，二零一零年十二月十五日電容值六七八零MF。";
const text1 = maintenanceTranscript(first);
assert.equal(
  text1,
  `我要回報工單，2026年6月2日下午14:00台積電F15P1/2_ME VFD備品與維修。
F15P1H4K-GEX-EF-03 五年一維，更換強排FAN 2個、間面FAN 6個。
F15P1H4K-GEX-EF-04 五年一維，更換強排FAN 2個、間面FAN 4個。`,
);
assert.equal(maintenanceTranscript(text1), text1, "formatting is idempotent");
const text2 = maintenanceTranscript(second);
assert.equal(
  text2,
  "正確，請幫我備註：20BD156AOAANNCU，SN：14778725製造日期：2010年12月3日電容值：6460MF，20BD156AOAANNCU，SN：14865412製造日期：2010年12月15日電容值：6780MF。",
);
const history = [
  { role: "assistant", content: "範例 SN：99999999 電容值：9999MF" },
  { role: "user", content: text1 },
];
const reply1 = maintenanceReply(text1, history);
assert.equal(
  reply1,
  `${text1.split("\n").slice(1).join("\n\n")}\n\n以上是否正確。`,
);
assert.ok(!reply1.includes("SN") && !reply1.includes("製造日期"));
assert.equal(
  maintenanceReply(text2, history),
  `20BD156AOAANNCU有兩個，分別為

SN：14778725 製造日期：2010年12月3日 電容值：6460MF

SN：14865412 製造日期：2010年12月15日 電容值：6780MF

以上是否正確。`,
);
assert.equal(
  maintenanceReply("正確起機測試正常。", history),
  "好的，工單：F15P1/2_ME VFD備品與維修，已輸入完成，謝謝。",
);
const changed = maintenanceTranscript(
  second
    .replace("一四七七八七二五", "零零一二三四五六")
    .replace("六四六零", "九八七六")
    .replace("十二月三日", "一月二日"),
);
assert.match(
  maintenanceReply(changed, history),
  /SN：00123456 製造日期：2010年1月2日 電容值：9876MF/,
);
assert.ok(
  !maintenanceReply(changed, history).includes("14778725"),
  "sample serials cannot leak into real readback",
);
const incomplete = maintenanceTranscript(
  "正確，請幫我備註：ABC123 SN一二三四 製造日期二零一零年十二月三日",
);
assert.match(maintenanceReply(incomplete, history), /請確認每筆/);
assert.ok(!maintenanceReply(incomplete, history).includes("MF"));
assert.match(maintenanceReply("正確起機測試正常。", []), /請提供工單名稱/);
assert.equal(maintenanceReply("請問現在幾點？", []), undefined);
console.log(
  "PASS exact reported ASR samples, dates/codes/counts, field-only readbacks, paired notes, no example leakage, changed facts, missing fields, completion and idempotence",
);

const equipmentOnly = maintenanceTranscript(
  "F一五P一H四K GEX-EF零三五年一維更換強排FN二個界面FN六個。",
);
assert.equal(
  equipmentOnly,
  "F15P1H4K-GEX-EF-03 五年一維，更換強排FAN 2個、間面FAN 6個。",
);
assert.equal(maintenanceTranscript(equipmentOnly), equipmentOnly);
