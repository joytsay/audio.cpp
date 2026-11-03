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
  const downloads = [];
  const loads = [];
  const repo = 'bartowski/LiquidAI_LFM2.5-1.2B-Instruct-GGUF';
  const file = 'LiquidAI_LFM2.5-1.2B-Instruct-Q4_K_M.gguf';
  const modelRef = `${repo}:Q4_K_M`;
  let registered = false;
  let loaded = false;
  let resolveDownload;
  const downloadStarted = new Promise(resolve => { resolveDownload = resolve; });
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/health', route => route.fulfill({ json: { status: 'ok', ui: true, ui_management: true, models: 0 } }));
  await page.route(url => url.pathname.startsWith('/v1/') || url.port === '8082', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.method() === 'POST' ? request.postDataJSON() : {};
    let json = { data: [], voices: [] };
    if (url.port === '8082') {
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      if (url.pathname === '/models/sse') {
        await downloadStarted;
        return route.fulfill({ contentType: 'text/event-stream', headers: cors,
          body: 'event: download_finished\ndata: {"event":"download_finished","data":{"message":"Download finished"}}\n\n' });
      }
      if (url.pathname === '/models' && request.method() === 'POST') {
        downloads.push(body);
        registered = true;
        resolveDownload();
        json = { success: true };
      } else if (url.pathname === '/models/load') {
        loads.push(body);
        loaded = true;
        json = { success: true };
      } else if (url.pathname === '/models') json = { data: [
        { id: 'bartowski/Qwen2.5-3B-Instruct-GGUF:Q4_K_M', loaded: true },
        ...(registered ? [{ id: modelRef, loaded }] : [])
      ] };
    }
    if (url.pathname === '/v1/ui/models-root') json = { models_root: '/fixture/models', default_models_root: '/fixture/models', is_default: true };
    if (url.pathname === '/v1/ui/models/package-sizes') json = { state: 'complete', data: [{ id: 'fixture', installed: false }] };
    if (url.pathname === '/v1/ui/path-status') json = { exists: false, file: false, directory: false };
    return route.fulfill({ json, headers: cors });
  });
  await page.goto(process.env.UI_BASE_URL || 'http://127.0.0.1:4173/');
  await page.getByRole('button', { name: 'LLM', exact: true }).click();
  await page.getByLabel('Model preset', { exact: true }).selectOption('lfm25-instruct');
  assert.equal(await page.getByLabel('Hugging Face repository', { exact: true }).inputValue(), repo);
  assert.equal(await page.getByLabel('Quantization', { exact: true }).inputValue(), 'Q4_K_M');
  assert.equal(await page.getByLabel('GGUF filename', { exact: true }).inputValue(), file);
  assert.equal(await page.getByRole('link', { name: 'Direct GGUF', exact: true }).getAttribute('href'),
    `https://huggingface.co/${repo}/resolve/main/${file}?download=true`);
  await page.getByRole('button', { name: 'Download in llama.cpp', exact: true }).click();
  await page.waitForFunction(ref => [...document.querySelectorAll('select option')].some(option => option.value === ref), modelRef);
  assert.deepEqual(downloads, [{ model: modelRef }]);
  await page.getByLabel('Loaded model', { exact: true }).selectOption(modelRef);
  await page.getByRole('button', { name: 'Load model', exact: true }).click();
  await page.getByRole('button', { name: 'Loaded in VRAM', exact: true }).waitFor();
  assert.deepEqual(loads, [{ model: modelRef }]);
  await page.reload();
  await page.getByRole('button', { name: 'LLM', exact: true }).click();
  assert.equal(await page.getByLabel('Model preset', { exact: true }).inputValue(), 'lfm25-instruct');
  assert.equal(await page.getByLabel('GGUF filename', { exact: true }).inputValue(), file);
  await page.getByLabel('Model preset', { exact: true }).selectOption('qwen25');
  assert.equal(await page.getByLabel('Hugging Face repository', { exact: true }).inputValue(), 'bartowski/Qwen2.5-3B-Instruct-GGUF');
  assert.equal(await page.getByLabel('GGUF filename', { exact: true }).inputValue(), 'Qwen2.5-3B-Instruct-Q4_K_M.gguf');
  await page.getByLabel('Hugging Face repository', { exact: true }).fill('custom/repo');
  assert.equal(await page.getByLabel('Model preset', { exact: true }).inputValue(), '');
  await page.getByRole('heading', { name: 'llama.cpp', exact: true }).click();
  await page.evaluate(() => localStorage.setItem('audiocpp.llama.settings', JSON.stringify({
    repo: 'bartowski/Vortecks_LFM3-1.7B-Heretic-Abliterated-GGUF', quant: 'Q4_K_M',
    ggufFile: 'Vortecks_LFM3-1.7B-Heretic-Abliterated-Q4_K_M.gguf'
  })));
  await page.reload();
  await page.getByRole('button', { name: 'LLM', exact: true }).click();
  assert.equal(await page.getByLabel('Model preset', { exact: true }).inputValue(), 'lfm25-instruct');
  assert.equal(await page.getByLabel('GGUF filename', { exact: true }).inputValue(), file);
  assert.deepEqual(errors, []);
  console.log('PASS: LFM2.5 preset, exact GGUF link, download/load requests, saved selection, old-preset migration, Qwen preset, and custom editing');
} finally { await browser.close(); }
