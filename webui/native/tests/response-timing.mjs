import assert from "node:assert/strict";
import { reportedRtf, rtfLabel } from "../src/lib/response-timing.ts";
assert.equal(reportedRtf({ timing: { rtf: 0.024241 } }), 0.024241);
assert.equal(reportedRtf({ timings: { rtf: 0.8 } }), 0.8);
assert.equal(reportedRtf({ rtf: 0 }), 0);
assert.equal(reportedRtf({ result: { timing: { rtf: 1.2 } } }), 1.2);
for (const response of [
  null,
  {},
  { timings: { predicted_per_second: 45 } },
  { timing: { rtf: null } },
  { rtf: -1 },
  { rtf: Infinity },
  { rtf: NaN },
  { rtf: "0.2" },
])
  assert.equal(reportedRtf(response), null);
assert.equal(rtfLabel(0), "0.0000");
assert.equal(rtfLabel(0.024241), "0.0242");
for (const missing of [undefined, null, -1, NaN, Infinity])
  assert.equal(rtfLabel(missing), "—");
console.log(
  "PASS reported RTF extraction, zero values, nested timing, missing/invalid metrics, and formatting",
);
