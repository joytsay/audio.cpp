import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.UI_BROWSER_TOOLS
  ? path.resolve(process.env.UI_BROWSER_TOOLS, 'package.json') : import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.UI_BROWSER_EXECUTABLE ? { executablePath: process.env.UI_BROWSER_EXECUTABLE } : {}),
  args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = [];
  let localFileExists = false;
  let pathApiUnavailable = false;
  let activeRoot = '/fixture/models';
  const checkedPaths = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/health', route => route.fulfill({ json: {
    status: 'ok', backend: 'cpu', models: 0, ui: true, ui_management: true
  } }));
  await page.route('**/v1/**', route => {
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : {};
    const url = new URL(route.request().url());
    let json = { data: [], voices: [] };
    if (url.pathname === '/v1/ui/models-root') {
      if (route.request().method() === 'POST') activeRoot = body.path || '/fixture/models';
      json = { models_root: activeRoot, default_models_root: '/fixture/models', is_default: activeRoot === '/fixture/models' };
    }
    if (url.pathname === '/v1/ui/models/package-sizes') json = {
      state: 'complete', data: [{ id: 'audio8_tts_preview_0_6b_q8_0', installed: false, size_bytes: 100, state: 'ok' }]
    };
    if (url.pathname === '/v1/ui/path-status') {
      const isAudio8 = String(body.path).includes('audio8-asr-0.1b-q8_0.gguf');
      if (isAudio8) {
        checkedPaths.push(body.path);
        if (pathApiUnavailable) return route.fulfill({ status: 503, json: { error: { message: 'Fixture path service unavailable' } } });
      }
      const exists = !isAudio8 || localFileExists && String(body.path).startsWith('/fixture/models/');
      json = { exists, file: exists, directory: false };
    }
    return route.fulfill({ json });
  });
  await page.goto(process.env.UI_BASE_URL || 'http://127.0.0.1:4173/');
  await page.getByRole('button', { name: 'Models', exact: true }).click();
  await page.getByLabel('Search models', { exact: true }).fill('Audio8');
  const asr = page.locator('.model-row').filter({ hasText: 'Audio8 ASR 0.1B' });
  const tts = page.locator('.model-row').filter({ hasText: 'Audio8 TTS Preview' });
  await asr.waitFor();
  await tts.waitFor();
  await asr.getByText('Local file missing', { exact: true }).waitFor();
  assert.ok(checkedPaths.includes('/fixture/models/Audio8-ASR-0.1B-GGUF/audio8-asr-0.1b-q8_0.gguf'));
  assert.equal(await asr.getByRole('button', { name: 'Download', exact: true }).count(), 0);
  assert.match(await asr.getByRole('link', { name: 'Setup guide' }).getAttribute('href'), /docs\/models\/audio8_asr\.md$/);
  assert.equal(await tts.getByRole('button', { name: 'Download', exact: true }).count(), 1);
  const installation = page.getByLabel('Installation status', { exact: true });
  await installation.selectOption('missing');
  await asr.waitFor();
  await installation.selectOption('all');
  localFileExists = true; // Simulate conversion finishing while the page stays open.
  await page.getByRole('button', { name: 'Refresh local models', exact: true }).click();
  await asr.getByText('✓ Local file found', { exact: true }).waitFor();
  await installation.selectOption('installed');
  await asr.waitFor();
  assert.equal(await tts.count(), 0);
  await installation.selectOption('missing');
  await tts.waitFor();
  assert.equal(await asr.count(), 0);
  await installation.selectOption('all');
  pathApiUnavailable = true;
  await page.getByRole('button', { name: 'Refresh local models', exact: true }).click();
  await asr.getByText('Status unavailable', { exact: true }).waitFor();
  pathApiUnavailable = false;
  await page.getByRole('button', { name: 'Refresh local models', exact: true }).click();
  await asr.getByText('✓ Local file found', { exact: true }).waitFor();
  await page.locator('.folder-settings > summary').click();
  await page.getByLabel('Models folder path', { exact: true }).fill('/different/models');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await asr.getByText('Local file missing', { exact: true }).waitFor();
  assert.ok(checkedPaths.includes('/different/models/Audio8-ASR-0.1B-GGUF/audio8-asr-0.1b-q8_0.gguf'));
  await page.getByRole('button', { name: 'Use default', exact: true }).click();
  await asr.getByText('✓ Local file found', { exact: true }).waitFor();
  await asr.getByRole('button', { name: 'Open in Studio', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#model')?.value === 'audio8-asr');
  const selected = await page.locator('#model option:checked').innerText();
  assert.match(selected, /Audio8 ASR 0.1B/);
  await page.getByText('offline transcription', { exact: false }).first().waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: local file detection, conversion refresh, installed/missing filters, API failure, models-root changes, and Studio selection; TTS downloads unchanged');
} finally {
  await browser.close();
}
