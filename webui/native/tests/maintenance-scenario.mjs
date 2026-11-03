import assert from 'node:assert/strict';
import { maintenanceScenarioSteps as steps, maintenanceScenarioPrompt, maintenanceSpeechText } from '../src/lib/maintenance-scenario.ts';

assert.equal(steps.length, 3);
assert.match(steps[0].message, /F15P1H4K-GEX-EF-03.*FAN 2個、間面FAN 6個/);
assert.match(steps[0].message, /F15P1H4K-GEX-EF-04.*FAN 2個、間面FAN 4個/);
assert.match(steps[1].expected, /14778725 製造日期：2010年12月3日 電容值：6460MF/);
assert.match(steps[1].expected, /14865412 製造日期：2010年12月15日 電容值：6780MF/);
assert.match(steps[2].expected, /F15P1\/2_ME VFD備品與維修，已輸入完成/);
for (const step of steps) {
  assert.ok(maintenanceScenarioPrompt.includes(step.message));
  assert.ok(maintenanceScenarioPrompt.includes(step.expected));
  assert.doesNotMatch(maintenanceSpeechText(step.expected), /\d/);
}
assert.equal(maintenanceSpeechText('F15P1H4K-GEX-EF-03'), 'F一伍P一H四K-GEX-EF-零三');
assert.equal(maintenanceSpeechText('20BD156AOANNANCU'), '二零BD一伍六AOANNANCU');
assert.equal(maintenanceSpeechText('SN：14778725'), 'SN：一四七七八七二伍');
assert.equal(maintenanceSpeechText('2010年12月15日 6460MF'), '二零一零年十二月十五日 六千四百六十MF');
assert.equal(maintenanceSpeechText('6780MF 2個'), '六千七百八十MF 兩個');
assert.equal(maintenanceSpeechText('6000MF 6006MF'), '六千MF 六千零六MF');
assert.equal(steps[1].expected.includes('14778725'), true, 'TTS conversion must not mutate the stored/displayed reply');
console.log('PASS: scenario values, SN/date/capacitor pairing, completion, and separate TTS normalization');
