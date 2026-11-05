import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(new URL("../package.json", import.meta.url));
const { buildSync } = require("esbuild");
const compiled = buildSync({
  entryPoints: [
    fileURLToPath(new URL("../src/lib/transcript.ts", import.meta.url)),
  ],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const {
  traditionalTranscript,
  traditionalTranscriptionResponse,
  isTranscriptionPath,
  normalizeTranscript,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`
);
assert.equal(
  traditionalTranscript("请帮我转接车辆检查哨，台积电 X光机，维修 FAN 2个。"),
  "請幫我轉接車輛檢查哨，臺積電 X光機，維修 FAN 2個。",
);
assert.equal(
  traditionalTranscript("F15P1H4K-GEX-EF-03 SN:14778725 6460MF GeoVision IVR"),
  "F15P1H4K-GEX-EF-03 SN:14778725 6460MF GeoVision IVR",
);
const original = {
  text: "头发干燥",
  segments: [{ text: "车辆" }],
  timing: { rtf: 0.2 },
  language: "zh",
  model: "测试模型",
};
const converted = traditionalTranscriptionResponse(original);
assert.equal(converted.text, "頭髮乾燥");
assert.equal(converted.segments[0].text, "車輛");
assert.equal(original.text, "头发干燥");
assert.deepEqual(converted.timing, { rtf: 0.2 });
assert.equal(converted.model, "测试模型");
assert.equal(
  traditionalTranscriptionResponse({ text_output: { text: "大厅" } })
    .text_output.text,
  "大廳",
);
assert.equal(isTranscriptionPath("/v1/audio/transcriptions/details"), true);
assert.equal(isTranscriptionPath("audio/transcriptions?format=json"), true);
assert.equal(isTranscriptionPath("chat/completions"), false);
console.log(
  "PASS dictionary transcription conversion, phrases, segments, identifiers and response metadata",
);

const hotwords =
  "Technical terms: F15P1/2_ME, F15P1H4K-GEX-EF-03, F15P1H4K-GEX-EF-04, 20BD156AOANNANCU";
assert.equal(
  normalizeTranscript("二零二六年六月二日下午十四點"),
  "2026年6月2日下午14:00",
);
assert.equal(
  normalizeTranscript("二零一零\n  年十二月三日電容值六四六零MF"),
  "2010年12月3日電容值6460MF",
);
assert.equal(
  normalizeTranscript(
    "SN一四八六五四一二製造日期，二零一零年十二月十五日電容值六七八零MF",
  ),
  "SN14865412製造日期，2010年12月15日電容值6780MF",
);
assert.equal(
  normalizeTranscript(
    "F一五P一二ME，F一五P一H四K GEX-EF零三五年一維，更換FAN二個",
    hotwords,
  ),
  "F15P1/2_ME，F15P1H4K-GEX-EF-03五年一維，更換FAN2個",
);
assert.equal(
  normalizeTranscript("F一五P一H四K GEX-EF零四五年一維", hotwords),
  "F15P1H4K-GEX-EF-04五年一維",
);
assert.equal(
  normalizeTranscript("备註：二零BD一五六AOAANNCU", hotwords),
  "備註：20BD156AOAANNCU",
  "do not invent missing/different letters from a hotword",
);
assert.equal(
  normalizeTranscript("F一五P一二ME"),
  "F15P12ME",
  "separators require a matching hotword",
);
assert.equal(
  normalizeTranscript("API一樣，GPU一開始，五年一維，一起確認。"),
  "API一樣，GPU一開始，五年一維，一起確認。",
);
assert.equal(
  normalizeTranscript("SN：零零一二，電容值六點五MF，上午九點三十分"),
  "SN：0012，電容值6.5MF，上午09:30",
);
assert.equal(
  normalizeTranscript("A一二", "A-12,A/12"),
  "A12",
  "ambiguous hotwords must not guess separators",
);
assert.equal(
  normalizeTranscript("二零BD一五六AOANNANCU，O零一"),
  "20BD156AOANNANCU，O01",
  "O and 0 remain distinct",
);
assert.equal(
  normalizeTranscript("下午二十五點"),
  "下午二十五點",
  "invalid times remain visible for correction",
);
assert.equal(
  traditionalTranscriptionResponse({
    partial_text_snapshot: { text: "二零二六年六月二日" },
  }).partial_text_snapshot.text,
  "2026年6月2日",
);
const normalized = normalizeTranscript(
  "F一五P一二ME，二零二六年六月二日下午十四點",
  hotwords,
);
assert.equal(
  normalizeTranscript(normalized, hotwords),
  normalized,
  "normalization is idempotent",
);
console.log(
  "PASS dates/times, serials/units, leading zeros, code separators from hotwords, unchanged maintenance terms/prose, and Traditional assistant text",
);
