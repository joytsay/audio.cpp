// SOP drafts. Every uploaded document (DOCX, HTML, PDF, Markdown, CSV, XLSX
// or an image) is first tidied into one SOP page, which the user opens and
// checks before it is imported:
//   AGENT PROMPT    the agent's instructions (English)
//   HOTWORDS        names and codes for the ASR context
//   OPENING         AI:/USER: turns: language, identity checks, CHOOSE SCENARIO
//   SCENARIOS       SCENARIO_01: title, its AI:/USER: turns and FIGURE: images
//   KNOWLEDGE BASE  IMAGE:/TABLE:/FILE: links to the page's files
// Only spoken lines and content are Chinese; every structure line is English.
// The local LLM writes fields (JSON) and this module renders the page, so the
// import parser (scenario-files.mjs) always reads the same structure. A
// document that is already a call script (AI:/USER: turns under numbered
// scenarios) keeps its turns verbatim; the LLM writes scenarios only for
// narrative documents. Tables are written as CSV files. Confirming a draft
// imports one scenario, named after the uploaded file: the page with its
// images and tables. Every Chinese line is Traditional Chinese (OpenCC).
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {dialogueTemplate, htmlScenarioText, sopParts} from './scenario-files.mjs';
import {chunks, codes} from './sops.mjs';
import {imageType} from './rag-assets.mjs';
import * as OpenCC from 'opencc-js';

// Simplified → Traditional (Taiwan) characters, leaving Traditional text as
// written: OpenCC's Taiwan table would also turn 台 into 臺 (服務台 → 服務臺), so a
// character the Hong Kong table leaves unchanged is already Traditional and kept.
const toTaiwan = OpenCC.Converter({from: 'cn', to: 'tw'}), toHongKong = OpenCC.Converter({from: 'cn', to: 'hk'});
export function traditional(value) {
  const text = String(value ?? ''), taiwan = toTaiwan(text);
  const original = [...text], tw = [...taiwan], hk = [...toHongKong(text)];
  if (tw.length !== original.length || hk.length !== original.length) return taiwan;
  return original.map((character, index) => hk[index] === character ? character : tw[index]).join('');
}

const fail = (message, status = 400) => Object.assign(new Error(message), {status});
const clean = text => String(text ?? '').replace(/[ \t\r\f\v]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
const maxBytes = 10 * 1024 * 1024;
const keepDrafts = 20;
export const draftExtensions = new Set(['.docx', '.html', '.htm', '.png', '.jpg', '.jpeg', '.gif', '.md', '.markdown', '.csv', '.xlsx', '.pdf']);
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif']);
const isDraftId = id => typeof id === 'string' && /^[a-f0-9]{24}$/.test(id);

// The opening used when a document has none: language, three identity
// questions and the service menu. USER lines are example answers.
export const defaultOpening = [
  {role: 'AI', text: '請先選語言：中文 1、英文2'},
  {role: 'AI', text: '請進行身分驗證：請問此電話持有人名字是?'},
  {role: 'USER', text: '王怡文'},
  {role: 'AI', text: '請說出您員工編號後3碼?'},
  {role: 'USER', text: '847'},
  {role: 'AI', text: '請說出您直屬主管名字?'},
  {role: 'USER', text: '黃培熏'},
  {role: 'AI', text: '請問您要回報什麼內容?'},
  {role: 'USER', text: '工單回報'},
];

// ── The page ───────────────────────────────────────────────────────────────
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
export const fileHref = name => `files/${encodeURIComponent(name)}`;
const scenarioLabel = index => `SCENARIO_${String(index + 1).padStart(2, '0')}`;
const style = `body{font:15px/1.6 system-ui,"Noto Sans TC",sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;color:#1d1d1f}
header{background:#fff6dc;border:1px solid #e8d48a;border-radius:6px;padding:.6rem .9rem;font-size:13px}
h2{margin-top:2rem;border-bottom:1px solid #ccc;font-size:17px;letter-spacing:.04em}h3{font-size:15px;margin:1.4rem 0 .4rem}
p{margin:.2rem 0}.marker{font-weight:600;color:#7a5b00;margin:.6rem 0}.turn b{display:inline-block;min-width:3.2em}
.user b{color:#0b5cad}.ai b{color:#1b7a3c}img{max-width:100%;border:1px solid #ddd;margin:.3rem 0}
li{margin:.4rem 0}li img{max-width:240px;display:block}pre{white-space:pre-wrap;font:inherit;margin:0}`;

export function renderSopPage({name, prompt, hotwords, opening, scenarios, knowledge}) {
  const turn = item => `<p class="turn ${item.role.toLowerCase()}"><b>${item.role}:</b> ${escape(item.text).replace(/\n/g, '<br>')}</p>`;
  // CHOOSE SCENARIO precedes the service menu: the opening's last AI line.
  const menu = opening.findLastIndex(item => item.role === 'AI');
  const openingHtml = opening.map((item, index) =>
    (index === menu && opening.filter(other => other.role === 'AI').length > 1 ? '<p class="marker">CHOOSE SCENARIO</p>\n' : '') + turn(item));
  const scenarioHtml = scenarios.map((scenario, index) => [
    `<h3>${scenarioLabel(index)}: ${escape(scenario.title)}</h3>`,
    ...scenario.turns.map(turn),
    ...(scenario.figures ?? []).map(figure => `<p class="marker">FIGURE: ${escape(figure)}</p>\n<img src="${fileHref(figure)}" alt="${escape(figure)}">`),
  ].join('\n'));
  const item = entry => `<li>${entry.kind}: <a href="${fileHref(entry.name)}">${escape(entry.name)}</a>` +
    (entry.kind === 'IMAGE' ? `<br><img src="${fileHref(entry.name)}" alt="${escape(entry.name)}">` : '') +
    (entry.note ? ` · ${escape(entry.note)}` : '') + '</li>';
  return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(name)}</title><style>${style}</style></head><body>
<header>Draft SOP. Check every part, then press Confirm in the demo page to import it. To fix it, save this page, edit it and upload it again.</header>
<h1>${escape(name)}</h1>
<section id="agent-prompt"><h2>AGENT PROMPT</h2>
<pre>${escape(prompt)}</pre></section>
<section id="hotwords"><h2>HOTWORDS</h2>
<p>${escape(hotwords.join(', '))}</p></section>
<section id="opening"><h2>OPENING</h2>
${openingHtml.join('\n')}</section>
<section id="scenarios"><h2>SCENARIOS</h2>
${scenarioHtml.join('\n') || '<p>(none)</p>'}</section>
<section id="knowledge-base"><h2>KNOWLEDGE BASE</h2>
<ul>
${knowledge.map(item).join('\n')}
</ul></section>
</body></html>
`;
}

// The agent prompt: English instructions; names and titles stay as written.
export function agentPrompt({name, opening, scenarios, tables}) {
  const questions = opening.filter(turn => turn.role === 'AI');
  return [
    `You are the phone voice assistant for "${name}".`,
    'Every call must follow this SOP in order:',
    `1. OPENING: start every call with the OPENING. Say its ${questions.length} AI lines in order, beginning with the language choice, ` +
      'and wait for the caller\'s answer to each question before the next one. Do not skip or reorder them.',
    '2. CHOOSE SCENARIO: after the opening, ask the service question (the last OPENING line) and let the caller choose one scenario, by its number or its title.',
    '3. SCENARIO: follow the chosen scenario\'s AI lines in order, using the details the caller gives. When it ends, ask whether the caller needs anything else.',
    `Scenarios: ${scenarios.map((scenario, index) => `${index + 1}. ${scenario.title}`).join('; ') || 'none'}.`,
    `Facts (names, numbers, codes, steps) come only from this SOP: its scenarios, figures and KNOWLEDGE BASE${tables.length ? ` tables (${tables.join(', ')})` : ''}. ` +
      'Never invent them; if something is not there, say so.',
    'Reply in the language the caller chose in the opening (Traditional Chinese as used in Taiwan, or English), in one or two short spoken sentences. If a request is unclear, ask the caller again.',
  ].join('\n');
}

// ── Helpers ────────────────────────────────────────────────────────────────
const csvCell = value => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
export const toCsv = (headers, rows) => [headers, ...rows.map(fields => headers.map(header => String(fields[header] ?? '')))]
  .map(row => row.map(csvCell).join(',')).join('\n') + '\n';
const safeName = name => String(name).normalize('NFC').replace(/[\\/\x00-\x1f:*?"<>|#%]/g, '_').trim().slice(-120) || 'file';
const extensionOf = bytes => ({png: '.png', jpeg: '.jpg', gif: '.gif', webp: '.webp'})[imageType(bytes)] ?? '';
const roleOf = role => role === 'assistant' ? 'AI' : 'USER';
// Markdown read as plain lines.
export const markdownText = text => text.split(/\r?\n/).map(line => line
  .replace(/^\s{0,3}#{1,6}\s*/, '').replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*|__|`/g, '').replace(/^\s*\|?\s*:?-{3,}.*$/, '')).join('\n');

// An uploaded file set: one or more documents, or images alone.
export function validateDraftUpload(input) {
  if (!Array.isArray(input?.files) || input.files.length < 1 || input.files.length > 8) throw fail('Choose 1–8 files');
  let total = 0;
  const files = input.files.map(file => {
    const extension = path.extname(String(file?.name ?? '')).toLowerCase();
    if (typeof file?.name !== 'string' || !file.name.trim() || file.name.length > 200 || /[\\/\x00-\x1f]/.test(file.name) || !draftExtensions.has(extension))
      throw fail('Upload DOCX, HTML, PDF, Markdown, CSV, XLSX, PNG, JPEG or GIF files');
    if (typeof file.data !== 'string' || file.data.length > Math.ceil(maxBytes / 3) * 4) throw fail('Files must total 10 MiB or less', 413);
    const bytes = Buffer.from(file.data, 'base64');
    if (!bytes.length || bytes.toString('base64') !== file.data) throw fail(`Invalid or empty file data: ${file.name}`);
    total += bytes.length;
    if (total > maxBytes) throw fail('Files must total 10 MiB or less', 413);
    if (imageExtensions.has(extension) && !imageType(bytes)) throw fail(`Invalid image data: ${file.name}`);
    return {name: file.name, extension, bytes};
  });
  return files;
}

// ── The store ──────────────────────────────────────────────────────────────
// read(file, upload): text, tables ({name, headers, rows}) and images
// ({name, bytes}) of a DOCX, PDF, Markdown, CSV or XLSX file (server.mjs).
// ocr(bytes): {text, rows} of one image.
export function createSopDrafts({
  root = path.join(process.env.KNOWLEDGE_DATA_ROOT || '/data', 'sop-drafts'), read, ocr,
  llmUrl = process.env.IVR_LLM_URL || 'http://voice-ai:8082/v1',
  model = process.env.IVR_LLM_MODEL || 'bartowski/LiquidAI_LFM2.5-1.2B-Instruct-GGUF:Q4_K_M',
  fetchImpl = fetch, log = console.log, maxParts = 12,
} = {}) {
  let queue = Promise.resolve();
  const dir = id => path.join(root, id);

  async function llm(messages, schema, {maxTokens = 1200} = {}) {
    const response = await fetchImpl(`${llmUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(300_000),
      body: JSON.stringify({model, messages, temperature: 0.1, max_tokens: maxTokens, stream: false,
        response_format: {type: 'json_schema', json_schema: {name: 'sop_page', schema}}}),
    });
    if (!response.ok) throw fail(`SOP tidy LLM HTTP ${response.status}`, 502);
    const content = (await response.json()).choices?.[0]?.message?.content ?? '';
    try { return JSON.parse(content); } catch { throw fail('SOP tidy LLM returned invalid JSON', 502); }
  }

  async function record(id) {
    if (!isDraftId(id)) throw fail('Invalid SOP draft ID');
    try { return JSON.parse(await fs.readFile(path.join(dir(id), 'draft.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') throw fail('SOP draft not found', 404); throw error; }
  }
  async function save(draft) {
    const target = path.join(dir(draft.id), 'draft.json'), temp = `${target}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(draft), {mode: 0o600});
    await fs.rename(temp, target);
    return draft;
  }
  const summary = draft => ({...draft, url: `sop-drafts/${draft.id}/draft.html`});

  // Scenarios, one LLM call per ~1500 characters of text and one per table
  // (its columns and sample rows).
  async function writeScenarios(name, text, tables = []) {
    const parts = [...chunks(text, 1500).filter(part => part.trim().length >= 40).slice(0, maxParts),
      ...tables.slice(0, 4).map(table => `表格：${table.name}（共 ${table.rows.length} 列）\n欄位：${table.headers.join('、')}\n範例資料：\n` +
        table.rows.slice(0, 6).map(fields => table.headers.map(header => `${header}：${fields[header] ?? ''}`).join('；')).join('\n'))];
    const scenarios = [], titles = new Set();
    for (const [index, part] of parts.entries()) {
      const result = await llm([
        {role: 'system', content: 'You design SOPs for a phone voice assistant. Write every title and spoken line in Traditional Chinese as used in Taiwan (繁體中文), never Simplified Chinese. Use only facts stated in the document.'},
        {role: 'user', content: `Document: ${name}\nPart ${index + 1} of ${parts.length}:\n${part}\n\n` +
          'Write up to 2 scenarios a phone caller could need from this part.\n' +
          'title: a short name for the scenario, 2 to 12 characters (for example 工單回報 or 零件庫存查詢).\n' +
          'turns: 2 to 8 alternating lines. role USER is the caller, role AI is the voice assistant. ' +
          'The AI states the facts of this part exactly: names, numbers, codes, dates and steps.\n' +
          'For a table, write lookups: the caller names one row (for example by a name or a code from the sample data) and the AI answers with that row\'s values.\n' +
          'Return no scenarios when nothing in this part is something a caller would ask about.'},
      ], {
        type: 'object', required: ['scenarios'],
        properties: {scenarios: {type: 'array', maxItems: 2, items: {type: 'object', required: ['title', 'turns'], properties: {
          title: {type: 'string', maxLength: 24},
          turns: {type: 'array', minItems: 2, maxItems: 8, items: {type: 'object', required: ['role', 'text'], properties: {
            role: {type: 'string', enum: ['USER', 'AI']}, text: {type: 'string', maxLength: 300}}}},
        }}}},
      }).catch(error => { log(`[sop-drafts] ${name} part ${index + 1}: ${error.message}`); return {scenarios: []}; });
      for (const scenario of result.scenarios ?? []) {
        const title = traditional(clean(scenario.title)).replace(/^(?:情境|scenario)[\s_]*\d*\s*[:：]?\s*/i, '');
        const turns = (scenario.turns ?? []).map(turn => ({role: turn.role === 'AI' ? 'AI' : 'USER', text: traditional(clean(turn.text))})).filter(turn => turn.text);
        if (!title || titles.has(title) || !turns.some(turn => turn.role === 'AI') || !turns.some(turn => turn.role === 'USER')) continue;
        titles.add(title);
        scenarios.push({title, turns});
      }
      log(`[sop-drafts] ${name}: part ${index + 1}/${parts.length}, ${scenarios.length} scenarios`);
    }
    return scenarios.slice(0, 12);
  }

  // Hotwords: names and terms the LLM picks; kept only if in the document.
  async function writeHotwords(name, text) {
    const result = await llm([
      {role: 'system', content: 'You pick ASR hotwords for a phone voice assistant.'},
      {role: 'user', content: `Document: ${name}\nExcerpt:\n${text.slice(0, 3000)}\n\n` +
        'hotwords: up to 20 names and terms from the document that a speech recognizer may miss (people, companies, products, model codes), copied exactly.'},
    ], {type: 'object', required: ['hotwords'], properties: {hotwords: {type: 'array', maxItems: 20, items: {type: 'string', maxLength: 30}}}},
    {maxTokens: 400}).catch(error => { log(`[sop-drafts] ${name} hotwords: ${error.message}`); return {hotwords: []}; });
    return (result.hotwords ?? []).map(term => traditional(clean(term)));
  }

  async function write(id, uploads) {
    const files = path.join(dir(id), 'files');
    await fs.mkdir(files, {recursive: true});
    const used = new Set();
    const store = async (name, bytes) => {
      let stored = safeName(name);
      const {name: stem, ext} = path.parse(stored);
      for (let n = 2; used.has(stored.toLowerCase()); n++) stored = `${stem}_${n}${ext}`;
      used.add(stored.toLowerCase());
      await fs.writeFile(path.join(files, stored), bytes, {mode: 0o600});
      return stored;
    };
    const documents = uploads.filter(upload => !imageExtensions.has(upload.extension));
    const imageUploads = uploads.filter(upload => imageExtensions.has(upload.extension));
    const name = path.parse(documents[0]?.name ?? uploads[0].name).name.trim() || 'SOP';
    const texts = [], tables = [], images = [], originals = [], figures = new Map();
    const companions = new Map();
    // Images uploaded with an HTML script are its figures; alone, they are read by OCR.
    const html = documents.some(upload => /^\.html?$/.test(upload.extension));
    for (const upload of imageUploads) {
      const stored = await store(upload.name, upload.bytes);
      images.push(stored);
      companions.set(upload.name, stored);
      if (html) continue;
      const {text, rows} = await ocr(upload.bytes).catch(error => { log(`[sop-drafts] OCR ${upload.name}: ${error.message}`); return {}; });
      if (rows?.length > 1) tables.push({name: path.parse(upload.name).name, headers: rows[0], rows: rows.slice(1).map(cells => Object.fromEntries(rows[0].map((header, i) => [header, cells[i] ?? ''])))});
      if (text?.trim()) texts.push(`【${upload.name}】\n${text.trim()}`);
    }
    for (const upload of documents) {
      if (/^\.html?$/.test(upload.extension)) {
        const found = [];
        texts.push(htmlScenarioText(new TextDecoder('utf-8', {fatal: true}).decode(upload.bytes), found));
        for (const [index, image] of found.entries()) {
          let stored;
          if (/^data:image\//i.test(image.src)) {
            const bytes = Buffer.from(image.src.replace(/^data:[^,]*,/, ''), 'base64');
            if (!extensionOf(bytes)) continue;
            stored = await store(`${path.parse(upload.name).name}_圖${index + 1}${extensionOf(bytes)}`, bytes);
            images.push(stored);
          } else {
            let source = '';
            try { source = decodeURIComponent(image.src).split('/').at(-1); } catch { /* not a file name */ }
            stored = companions.get(source);
          }
          const number = Number(image.section.match(/^情境\s*(\d+)/)?.[1]);
          if (stored && number) figures.set(number, [...(figures.get(number) ?? []), stored]);
        }
      } else {
        const result = await read(upload);
        if (result.text?.trim()) texts.push(result.text);
        tables.push(...result.tables ?? []);
        for (const image of result.images ?? []) images.push(await store(image.name, image.bytes));
      }
      if (upload.extension !== '.csv') originals.push(await store(upload.name, upload.bytes));
    }
    const tableFiles = [];
    for (const table of tables.filter(table => table.headers.length && table.rows.length))
      tableFiles.push({...table, file: await store(`${table.name}.csv`, Buffer.from(toCsv(table.headers, table.rows)))});

    // Everything on the page is Traditional Chinese, the tables too.
    for (const table of tableFiles) {
      table.headers = table.headers.map(traditional);
      table.rows = table.rows.map(fields => Object.fromEntries(Object.entries(fields).map(([key, value]) => [traditional(key), traditional(value)])));
      await fs.writeFile(path.join(files, table.file), toCsv(table.headers, table.rows), {mode: 0o600});
    }
    const text = traditional(texts.join('\n\n'));
    // A call script keeps its own turns; any other document is written by the LLM.
    const template = dialogueTemplate(text);
    const numbered = template.filter(section => Number.isInteger(section.number));
    let opening = defaultOpening, scenarios;
    if (numbered.length) {
      const turns = section => section.turns.map(turn => ({role: roleOf(turn.role), text: clean(turn.text)})).filter(turn => turn.text);
      const authored = turns(template.find(section => !Number.isInteger(section.number)) ?? {turns: []});
      if (authored.some(turn => turn.role === 'AI')) opening = authored;
      scenarios = numbered.map(section => ({title: clean(section.title), turns: turns(section), figures: figures.get(section.number) ?? []}));
    } else {
      scenarios = await writeScenarios(name, text, tableFiles);
    }
    if (opening === defaultOpening && scenarios[0])
      opening = [...defaultOpening.slice(0, -1), {role: 'USER', text: scenarios[0].title}];
    if (!scenarios.length) throw fail('No scenarios could be written from these files');

    // A page tidied before keeps its prompt and hotwords.
    // A page tidied before keeps its prompt and hotwords; otherwise the prompt
    // is written from the page itself, so it is always English and complete.
    const page = sopParts(text) ?? {prompt: agentPrompt({name, opening, scenarios, tables: tableFiles.map(table => table.file)}),
      hotwords: await writeHotwords(name, text)};
    const allText = [text, ...scenarios.flatMap(scenario => scenario.turns.map(turn => turn.text))].join('\n');
    const normalized = allText.normalize('NFKC');
    const hotwords = [...new Set([...page.hotwords.filter(term => term && normalized.includes(term.normalize('NFKC'))), ...codes(allText)])].slice(0, 40);
    const prompt = traditional(page.prompt || agentPrompt({name, opening, scenarios, tables: tableFiles.map(table => table.file)}));

    const figureNames = new Set(scenarios.flatMap(scenario => scenario.figures ?? []));
    const knowledge = [
      ...images.map(image => ({kind: 'IMAGE', name: image, ...(figureNames.has(image) ? {note: 'figure'} : {})})),
      ...tableFiles.map(table => ({kind: 'TABLE', name: table.file, note: `${table.rows.length} rows`})),
      ...originals.map(original => ({kind: 'FILE', name: original, note: 'uploaded original'})),
    ];
    const pageName = `${name}.html`;
    await fs.writeFile(path.join(dir(id), 'draft.html'), renderSopPage({name, prompt, hotwords, opening, scenarios, knowledge}), {mode: 0o600});
    // The demo lists the scenario under the uploaded file's name.
    const title = (documents[0] ?? uploads[0]).name;
    return {name, title, page: scenarios.length ? pageName : undefined, scenarios: scenarios.map(scenario => scenario.title),
      hotwords: hotwords.length, hotwordList: hotwords, figures: [...figureNames], images, tables: tableFiles.map(table => table.file), files: originals};
  }

  // Keep the newest drafts only.
  async function prune() {
    let entries = [];
    try { entries = (await fs.readdir(root, {withFileTypes: true})).filter(entry => entry.isDirectory() && isDraftId(entry.name)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const dated = await Promise.all(entries.map(async entry => ({id: entry.name, at: (await fs.stat(dir(entry.name))).mtimeMs})));
    for (const {id} of dated.sort((a, b) => b.at - a.at).slice(keepDrafts)) await fs.rm(dir(id), {recursive: true, force: true});
  }

  return {
    // Answers at once; the page is written in the background (minutes for a long document).
    async create(input) {
      const uploads = validateDraftUpload(input);
      await prune();
      const id = randomBytes(12).toString('hex');
      await fs.mkdir(dir(id), {recursive: true});
      const draft = await save({id, status: 'writing', createdAt: new Date().toISOString(), uploads: uploads.map(upload => upload.name)});
      const job = queue.then(async () => {
        const started = Date.now();
        try {
          const written = await write(id, uploads);
          await save({...draft, ...written, status: 'ready', writtenAt: new Date().toISOString()});
          log(`[sop-drafts] ${written.name}: ${written.scenarios.length} scenarios, ${written.tables.length} tables in ${Math.round((Date.now() - started) / 1000)} s`);
        } catch (error) {
          log(`[sop-drafts] ${uploads[0].name}: ${error.message}`);
          await save({...draft, status: 'failed', error: error.message}).catch(() => {});
        }
      });
      queue = job.catch(() => {});
      return summary(draft);
    },
    async get(id) { return summary(await record(id)); },
    async remove(id) { await record(id); await fs.rm(dir(id), {recursive: true, force: true}); return {id, removed: true}; },
    // The page or one of its files: {bytes, name}.
    async file(id, name) {
      const draft = await record(id);
      if (draft.status !== 'ready') throw fail('The SOP draft is not ready', 409);
      if (name === 'draft.html') return {bytes: await fs.readFile(path.join(dir(id), 'draft.html')), name};
      const stored = path.basename(name);
      if (stored !== name || !stored || stored.startsWith('.')) throw fail('Invalid file name');
      try { return {bytes: await fs.readFile(path.join(dir(id), 'files', stored)), name: stored}; }
      catch (error) { if (error.code === 'ENOENT') throw fail('File not found', 404); throw error; }
    },
    // What Confirm imports: one scenario, the page with its tables and
    // images (figures first) within the import's 7 images, 8 attachments and 10 MiB.
    async bundle(id) {
      const draft = await record(id);
      if (draft.status !== 'ready') throw fail('The SOP draft is not ready', 409);
      const read64 = async name => (await fs.readFile(path.join(dir(id), 'files', name))).toString('base64');
      if (!draft.page) throw fail('The SOP draft has no scenarios to import', 409);
      const page = await fs.readFile(path.join(dir(id), 'draft.html'));
      const attachments = [];
      let size = page.length, images = 0;
      for (const name of [...draft.tables, ...new Set([...draft.figures, ...draft.images])]) {
        const {size: bytes} = await fs.stat(path.join(dir(id), 'files', name));
        const table = /\.csv$/i.test(name);
        if (attachments.length >= 8 || (!table && images >= 7) || size + bytes > maxBytes) {
          if (table) throw fail(`The SOP draft's tables exceed the import limits: ${name}`, 413);
          continue;
        }
        size += bytes;
        if (!table) images++;
        attachments.push({name, data: await read64(name)});
      }
      const documents = [{name: draft.page, title: draft.title ?? draft.page, data: page.toString('base64'), ...(attachments.length ? {attachments} : {})}];
      return {id, name: draft.name, documents};
    },
  };
}
