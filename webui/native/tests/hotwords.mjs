import assert from 'node:assert/strict';
import { readHotwordsCsv, writeHotwordsCsv } from '../src/lib/hotwords.ts';
for (const value of ['', 'X光機', 'Technical terms: 台積電, FAN', 'Names: "Jane Smith"\nF15P1/2_ME, 20BD156AOANNANCU'])
  assert.equal(readHotwordsCsv(writeHotwordsCsv(value)), value);
assert.equal(readHotwordsCsv('\uFEFFcontext\r\n"台積電, X光機"\r\n'), '台積電, X光機');
assert.throws(() => readHotwordsCsv('context\nX,Y\n'));
assert.throws(() => readHotwordsCsv('wrong\nX\n'));
console.log('PASS hotwords CSV defaults, Unicode, quoted commas/newlines, empty context, validation');
