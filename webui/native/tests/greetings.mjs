import assert from "node:assert/strict";
import { readGreetingCsv, writeGreetingCsv } from "../src/lib/greetings.ts";
for (const text of [
  "您好，這裡是 GeoVision IVR。",
  'Hello, "caller"!\nHow can I help?',
  "a\r\nb",
]) {
  assert.equal(readGreetingCsv(writeGreetingCsv(text)), text);
}
assert.equal(readGreetingCsv('\uFEFFgreeting\r\n"Hello"\r\n'), "Hello");
for (const csv of [
  "wrong\nHello\n",
  'greeting\n"unterminated\n',
  "greeting\nHello,world\n",
  'greeting\n""\n',
]) {
  assert.throws(() => readGreetingCsv(csv));
}
assert.throws(() => writeGreetingCsv("   "));
console.log(
  "PASS greetings CSV escaping, multiline, BOM/CRLF, malformed/empty input",
);
