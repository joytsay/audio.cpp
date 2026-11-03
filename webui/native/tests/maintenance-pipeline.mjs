import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { maintenanceScenarioSteps as steps, maintenanceSpeechText } from '../src/lib/maintenance-scenario.ts';

const require = createRequire(process.env.UI_BROWSER_TOOLS
  ? path.resolve(process.env.UI_BROWSER_TOOLS, 'package.json') : import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.UI_BROWSER_EXECUTABLE ? { executablePath: process.env.UI_BROWSER_EXECUTABLE } : {}),
  args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  const chats = [];
  const speech = [];
  const writes = [];
  let failNext = false;
  const originalPrompt = '原本的接線設定，請保留。';
  const originalHotwords = 'context\n"original terminology"\n';
  page.on('pageerror', error => errors.push(error.message));
  const wav = Buffer.alloc(44 + 3200);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
  await page.route(url => url.pathname.startsWith('/v1/') || url.port === '8082', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.method() === 'POST' ? request.postDataJSON() : {};
    if (request.method() === 'POST') writes.push(url.pathname);
    let json = {};
    if (url.pathname === '/models' || url.port === '8082' && url.pathname === '/v1/models')
      json = { data: [{ id: 'fixture-instruct' }] };
    else if (url.pathname === '/v1/models') json = { data: [
      { id: 'qwen3-asr', family: 'qwen3_asr', task: 'asr' },
      { id: 'kokoro-tts', family: 'kokoro_tts', task: 'tts' }
    ] };
    if (url.pathname === '/v1/ui/models/package-sizes') json = { data: [], state: 'complete' };
    if (url.pathname === '/v1/ui/models-root') json = { models_root: '/fixture/models' };
    if (url.pathname === '/v1/ui/voices') json = { voices: [] };
    if (url.pathname === '/v1/ui/prompt') json = { content: originalPrompt };
    if (url.pathname === '/v1/ui/hotword') json = { content: originalHotwords };
    if (url.pathname === '/v1/chat/completions') {
      chats.push(body);
      if (failNext) {
        failNext = false;
        return route.fulfill({ status: 503, json: { error: { message: 'Fixture LLM unavailable' } } });
      }
      const index = body.messages.filter(message => message.role === 'user').length - 1;
      json = { choices: [{ message: { content: steps[index].expected } }] };
    }
    if (url.pathname === '/v1/audio/speech') {
      speech.push(body);
      return route.fulfill({ contentType: 'audio/wav', body: wav });
    }
    return route.fulfill({ json });
  });
  await page.goto(process.env.UI_BASE_URL || 'http://127.0.0.1:4173/#/pipeline');
  await page.getByText('情境 2：現場維修保養後的語音回報', { exact: true }).click();
  const start = page.getByRole('button', { name: '開始文字模擬', exact: true });
  await start.click();
  const scenario = page.locator('.maintenance-scenario');
  assert.equal(await page.getByLabel('Message', { exact: true }).inputValue(), steps[0].message);
  assert.equal(await page.getByLabel('播放 AI 語音', { exact: true }).isChecked(), false);
  for (let index = 0; index < steps.length; ++index) {
    if (index > 0) {
      await scenario.getByRole('button', { name: '填入本輪測試文字', exact: true }).click();
      await page.getByLabel('播放 AI 語音', { exact: true }).check();
    }
    await page.getByRole('button', { name: 'Send text', exact: true }).click();
    await page.waitForFunction(expected => document.querySelectorAll('.conversation-turn').length === expected &&
      Array.from(document.querySelectorAll('.conversation-turn .field-help')).some(node => node.textContent === 'Pipeline complete.'), index + 1);
    await page.getByRole('button', { name: '重新開始文字模擬', exact: true }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('.maintenance-scenario > button')?.disabled);
    const turn = page.locator('.conversation-turn').nth(index);
    assert.equal((await turn.locator('.assistant > p').innerText()).trim(), steps[index].expected);
    const messages = chats[index].messages;
    assert.equal(messages.length, 2 + index * 2, 'each turn must retain all previous messages');
    assert.equal(messages.at(-1).content, steps[index].message);
    for (let previous = 0; previous < index; ++previous) {
      assert.equal(messages[1 + previous * 2].content, steps[previous].message);
      assert.equal(messages[2 + previous * 2].content, steps[previous].expected);
    }
    assert.match(messages[0].content, /不會實際儲存或送出工單/);
  }
  assert.equal(speech.length, 2);
  assert.equal(speech[0].input, maintenanceSpeechText(steps[1].expected));
  assert.equal(speech[1].input, maintenanceSpeechText(steps[2].expected));
  assert.doesNotMatch(speech[0].input, /\d/);
  assert.match(await scenario.innerText(), /三輪測試訊息已送出/);
  assert.equal(await scenario.getByRole('button', { name: '填入本輪測試文字', exact: true }).isDisabled(), true);
  assert.equal(writes.some(path => /ui\/(prompt|hotword)/.test(path)), false, 'demo must not persist settings to server');
  console.log('PASS: three turns retain history, exact identifiers and paired notes; TTS is normalized separately');

  await page.getByRole('button', { name: 'New conversation', exact: true }).click();
  assert.equal(await page.locator('.conversation-turn').count(), 0);
  assert.equal(await page.getByLabel('System prompt (prompt.csv)', { exact: true }).inputValue(), originalPrompt);
  assert.equal(await page.getByLabel('Context prompt (hotwords)', { exact: true }).inputValue(), 'original terminology');
  await page.getByText('情境 2：現場維修保養後的語音回報', { exact: true }).click();
  await page.getByRole('button', { name: '開始文字模擬', exact: true }).click();
  failNext = true;
  await page.getByRole('button', { name: 'Send text', exact: true }).click();
  await page.getByText('Fixture LLM unavailable', { exact: true }).first().waitFor();
  assert.match(await scenario.innerText(), /第 1 \/ 3 輪/);
  await scenario.getByRole('button', { name: '填入本輪測試文字', exact: true }).click();
  await page.getByRole('button', { name: 'Send text', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.conversation-turn .assistant').length === 1);
  assert.equal(chats.at(-1).messages.length, 2, 'failed request and previous demo must not contaminate history');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: process.env.UI_SCREENSHOT || '/tmp/maintenance-pipeline.png', fullPage: true });
  console.log('PASS: leaving restores prior settings; a failed LLM request does not advance the script or pollute history');
} finally {
  await browser.close();
}
