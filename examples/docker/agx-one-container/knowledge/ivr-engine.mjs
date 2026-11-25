// Scenario-driven IVR call engine.
//
// The uploaded HTML call script is the only source of dialogue behaviour:
// the opening prompts are spoken verbatim, each 情境 section's example
// dialogue and figures ground the model, and one session record per call is
// the single source of truth for where the call is. Browser and SIP callers
// only send {sessionId, text}.
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {htmlScenarioText} from './scenario-files.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const run = promisify(execFile);

const fail = (message, status = 400) => Object.assign(new Error(message), {status});
const sha = value => createHash('sha256').update(value).digest('hex');
const sessionPattern = /^[A-Za-z0-9_.:-]{1,128}$/;
const sessionTtlMs = 2 * 60 * 60 * 1000;
const maxHistory = 40;
const maxTranscript = 1000;
// Columns of the call_sessions table that are not opening answers (n8n adds id, createdAt, updatedAt).
const callColumns = ['session_id', 'channel', 'date', 'time', 'opening', 'conversation', 'conversation_duration'];
const reservedColumns = new Set([...callColumns, 'id', 'createdat', 'updatedat']);
const columnPattern = /^[a-z][a-z0-9_]{0,39}$/;
const clock = seconds => [seconds / 3600, seconds / 60 % 60, seconds % 60].map(value => String(Math.floor(value)).padStart(2, '0')).join(':');

const zhDigits = {'零': '0', '〇': '0', '○': '0', '一': '1', '幺': '1', '壹': '1', '二': '2', '兩': '2', '两': '2', '貳': '2',
  '三': '3', '參': '3', '四': '4', '肆': '4', '五': '5', '伍': '5', '六': '6', '陸': '6', '七': '7', '柒': '7',
  '八': '8', '捌': '8', '九': '9', '玖': '9'};
const enDigits = {zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7',
  eight: '8', nine: '9'};
export function spokenDigits(text) {
  const normalized = text.normalize('NFKC').toLowerCase()
    .replace(/zero|oh|one|two|three|four|five|six|seven|eight|nine/g, word => enDigits[word]);
  return [...normalized].map(char => zhDigits[char] ?? char).join('').replace(/\D/g, '');
}

const hanShare = text => (text.match(/\p{Script=Han}/gu)?.length ?? 0) / Math.max(1, text.replace(/\s/g, '').length);
const compact = text => text.normalize('NFKC').toLowerCase().replace(/[\s，,。.！!？?、：:；;「」"'()（）]/g, '');

// Hesitations and fillers ("嗯嗯", "呃那個", "uh") never select an option.
export function isFiller(text) {
  const value = compact(text).replace(/嗯|呃|啊|阿|欸|誒|喔|哦|噢|唉|那個|這個|就是|然後|或者|um+|uh+|er+|hmm+|ok|okay|好|對/g, '');
  return !value;
}

export function chooseLanguage(text) {
  const value = compact(text).replace(/^(?:我要|我想|請|選擇?|使用|用|按)/, '');
  if (/^(?:2|二|兩|two|英文|英語|english)/.test(value) || /^(?:英文|english)/.test(value)) return 'en';
  if (/^(?:1|一|壹|one|中文|國語|华语|華語|chinese|mandarin)/.test(value)) return 'zh';
  return null;
}

// Explicit scenario selection: "情境 3", "scenario three", or a bare number.
export function explicitSection(text, sections, {bare = true} = {}) {
  const value = text.normalize('NFKC').trim();
  const token = value.match(/(?:情境|scenario)\s*(\d{1,3}|[一二三四五六七八九十])/i)?.[1] ??
    (bare ? value.match(/^(?:第)?\s*(\d{1,3}|[一二三四五六七八九])\s*(?:號|个|個)?[。.!！\s]*$/)?.[1] : undefined);
  if (token === undefined) return undefined;
  const number = /^\d+$/.test(token) ? Number(token) : '一二三四五六七八九十'.indexOf(token) + 1;
  return sections.find(section => section.number === number);
}

// A caller who says the section title (e.g. "工單回報") selects it directly.
export function namedSection(text, sections) {
  const value = compact(text);
  if (value.length < 2) return undefined;
  const matches = sections.filter(section => {
    const title = compact(section.title);
    return value.includes(title) || (value.length >= 4 && title.includes(value));
  });
  return matches.length === 1 ? matches[0] : undefined;
}

function turnText(turn) {
  // A line break inside Chinese text (卡澀\n或是) is not a space.
  return turn.text.replace(/\s+/g, ' ').replace(/(?<=[\p{Script=Han}\u3000-\u303f\uff00-\uffef]) (?=[\p{Script=Han}\u3000-\u303f\uff00-\uffef])/gu, '').trim();
}

// Build the call script from an imported HTML scenario record.
export async function loadScript(record, directory) {
  const html = record.files?.length === 1 && /\.html?$/i.test(record.files[0].name) ? record.files[0] : undefined;
  const template = record.dataset?.template;
  if (!html || !Array.isArray(template)) return undefined;
  const sections = template.filter(section => Number.isInteger(section.number) && section.turns?.length)
    .map(section => ({
      number: section.number,
      title: section.title.trim(),
      turns: section.turns.filter(turn => turn.text?.trim()).map(turn => ({role: turn.role, text: turnText(turn)})),
    }));
  if (!sections.length) return undefined;
  const openingTurns = (template.find(section => !section.number)?.turns ?? []).filter(turn => turn.text?.trim());
  const opening = openingTurns.filter(turn => turn.role === 'assistant').map(turn => {
    const text = turnText(turn);
    return {
      text,
      language: /語言|language/i.test(text),
      digits: Number(text.normalize('NFKC').match(/(\d+|[一二三四五六七八九])\s*碼/)?.[1]
        ?.replace(/[一二三四五六七八九]/, c => '一二三四五六七八九'.indexOf(c) + 1)) || 0,
    };
  });
  if (!opening.length) opening.push({text: '請問您需要什麼協助？', language: false, digits: 0});

  const images = [];
  htmlScenarioText(await fs.readFile(path.join(directory, html.sha256 + path.extname(html.name).toLowerCase()), 'utf8'), images);
  const attachments = new Map((record.attachments ?? []).map(file => [file.name, file]));
  for (const image of images) {
    let name = '';
    try { name = decodeURIComponent(image.src).split('/').at(-1); } catch { /* keep empty */ }
    const inline = /^data:image\//i.test(image.src);
    const file = attachments.get(name);
    const number = Number(image.section.match(/^情境\s*(\d+)/)?.[1]);
    const section = sections.find(item => item.number === number);
    if (!section || (!inline && !file)) continue;
    (section.figures ??= []).push(inline
      ? {key: sha(image.src), src: image.src}
      : {key: file.sha256, path: path.join(directory, file.sha256 + path.extname(file.name).toLowerCase())});
  }
  for (const section of sections) {
    section.outbound = section.turns[0]?.role === 'assistant';
    // Sections whose script files a work order are saved as work orders.
    section.saves = /工單|work\s*order/i.test(section.title) ||
      section.turns.some(turn => turn.role === 'caller' && /回報工單|工單回報|report (?:a )?work order/i.test(turn.text));
  }
  return {id: record.id, name: record.name, opening, sections};
}

const figurePrompt = '逐行轉錄這張圖中所有可讀的文字：標題、文件編號、日期、版本、欄位與數值、每個步驟編號與說明。' +
  '一般文字每行一項，格式「欄位：內容」或「步驟 N：說明」。表格每一列輸出一行，欄位用 | 分隔，第一行是表頭，保留每個代碼與數字。' +
  '只有照片沒有文字的區塊寫「（照片）」。不要輸出空白表格，不要推測或補充說明。';

// Scale every figure into a 1600px box: small scans (e.g. a 482px SOP GIF)
// are unreadable to the vision model at their original size.
async function figureImage(bytes) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ivr-figure-'));
  try {
    const input = path.join(dir, 'input'), output = path.join(dir, 'figure.jpeg');
    await fs.writeFile(input, bytes);
    await run('convert', ['-limit', 'memory', '64MiB', '-limit', 'map', '128MiB', '-limit', 'disk', '0',
      `${input}[0]`, '-resize', '1600x1600', '-background', 'white', '-alpha', 'remove', '-quality', '88', 'jpeg:' + output],
    {timeout: 60_000});
    return `data:image/jpeg;base64,${(await fs.readFile(output)).toString('base64')}`;
  } finally { await fs.rm(dir, {recursive: true, force: true}); }
}

const LOOKUP = Symbol('work-order lookup');

const norm = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, '').toUpperCase();
// Picks the saved work order a question refers to (rows newest saved first);
// "same" is the one the previous answer described.
export function pickWorkOrder(rows, {which = 'latest', number = ''} = {}, current = '') {
  if (which === 'number') {
    const wanted = norm(number);
    return wanted ? rows.find(row => [row.reference_number, row.order_id].some(value => value && norm(value).includes(wanted))) : undefined;
  }
  if (which === 'same') return rows.find(row => row.order_id === current) ?? rows[0];
  return which === 'oldest' ? rows.at(-1) : rows[0];
}

// Short spoken answer about saved work orders: one fact per sentence, the
// summary first; equipment, work done, test result or notes only when asked.
export function describeWorkOrders(rows, {which = 'latest', number = '', field = 'summary'} = {}, language = 'zh', current = '') {
  const en = language === 'en';
  const id = row => row.reference_number || row.order_id;
  if (!rows.length) return en ? 'There are no saved work orders yet.' : '目前沒有已儲存的工單。';
  if (which === 'all') {
    const latest = rows.slice(0, 3).map(id).join(en ? ', ' : '、');
    return en ? `There are ${rows.length} saved work orders. The latest are ${latest}.`
      : `目前共有 ${rows.length} 張工單。最新的是 ${latest}。`;
  }
  const row = pickWorkOrder(rows, {which, number}, current);
  if (!row) return en ? `No saved work order ${number || 'with that number'} was found.` : `沒有找到工單 ${number || '這個號碼'}。`;
  const facts = {
    date: [row.dispatch_date, '派工日期', 'dispatch date'],
    equipment: [row.equipment_number, '設備', 'equipment'],
    work: [row.maintenance_items, '維修內容', 'work done'],
    test: [row.test_result, '起機測試', 'startup test'],
    notes: [row.notes, '備註', 'notes'],
  };
  if (facts[field]) {
    const [value, zh, english] = facts[field];
    if (!value) return en ? `Work order ${id(row)} has no ${english} recorded.` : `工單 ${id(row)} 沒有記錄${zh}。`;
    return en ? `The ${english} of work order ${id(row)}: ${value}.` : `工單 ${id(row)} 的${zh}：${value.replace(/[。.]$/, '')}。`;
  }
  const label = which === 'oldest' ? (en ? 'oldest' : '最舊') : which === 'latest' ? (en ? 'latest' : '最新') : '';
  const head = en ? `The ${label ? label + ' saved ' : ''}work order is ${id(row)}` : `${label ? label + '的' : ''}工單是 ${id(row)}`;
  const date = row.dispatch_date ? (en ? `, dispatched ${row.dispatch_date}` : `，${row.dispatch_date} 派工`) : '';
  const what = row.title || row.equipment_number;
  return en ? `${head}${date}.${what ? ` ${what}.` : ''}` : `${head}${date}。${what ? `${what}。` : ''}`;
}
const reportKey = (sessionId, number, run) => sha(JSON.stringify([sessionId, number, run]));
const orderId = key => `GV-${key.slice(0, 12).toUpperCase()}`;

const placeholder = '〔範例〕';
const identifierPattern = /[A-Za-z0-9][A-Za-z0-9_/.-]*\d[A-Za-z0-9_/.-]*/g;
const identifiers = text => new Set((text.normalize('NFKC').match(identifierPattern) ?? [])
  .map(value => value.replace(/[.\-/]+$/, '').toUpperCase()).filter(value => value.length >= 5 && /[A-Z]/.test(value)));
export function exampleLeaks(section, history, reply) {
  const example = identifiers(section.turns.filter(turn => turn.role === 'caller').map(turn => turn.text).join('\n'));
  const said = identifiers(history.filter(turn => turn.role === 'user').map(turn => turn.content).join('\n'));
  return [...identifiers(reply)].filter(value => example.has(value) && !said.has(value));
}

// Last resort after one regeneration: drop sentences that still carry the
// script's example data, keeping the rest of the reply (e.g. the question).
export function dropExampleSentences(reply, leaked) {
  const bad = sentence => sentence.includes(placeholder) || /\[example/i.test(sentence) ||
    [...identifiers(sentence)].some(value => leaked.includes(value));
  // A period ends a sentence only before whitespace, so "1.5" stays whole.
  const sentences = reply.split(/(?<=[。!?！？])|(?<=\.)(?=\s|$)/);
  const kept = sentences.filter(sentence => !bad(sentence)).join('').trim();
  return kept || reply;
}

// AI lines are numbered so the model states which script line it performs.
// A report script is a template for the caller's own data, so example IDs
// the caller has not said are hidden from the model to keep them out of replies.
function scriptText(section, hidden = new Set()) {
  let line = 0;
  const mask = text => hidden.size ? text.replace(identifierPattern, value =>
    hidden.has(value.normalize('NFKC').replace(/[.\-/]+$/, '').toUpperCase()) ? placeholder : value) : text;
  return section.turns.map(turn => turn.role === 'assistant' ? `AI[${++line}]: ${mask(turn.text)}` : `Caller: ${mask(turn.text)}`).join('\n');
}
function unsaidExamples(section, history) {
  const said = identifiers(history.filter(turn => turn.role === 'user').map(turn => turn.content).join('\n'));
  return new Set([...identifiers(section.turns.filter(turn => turn.role === 'caller').map(turn => turn.text).join('\n'))]
    .filter(value => !said.has(value)));
}
const aiLines = section => section.turns.filter(turn => turn.role === 'assistant').length;

export function createIvrEngine({
  scenarios,
  scenarioRoot,
  dataRoot = process.env.KNOWLEDGE_DATA_ROOT || '/data',
  llmUrl = process.env.IVR_LLM_URL || 'http://voice-ai:8087/v1',
  model = process.env.IVR_LLM_MODEL || 'ivr-vision',
  fetchImpl = fetch,
  now = () => Date.now(),
  log = console.log,
  timeZone = process.env.IVR_TIME_ZONE || 'Asia/Taipei',
} = {}) {
  const sessionsDir = path.join(dataRoot, 'ivr-sessions');
  const cacheDir = path.join(dataRoot, 'ivr-cache');
  const sessions = new Map();
  const locks = new Map();
  const scripts = new Map();
  const pendingFigures = new Map();

  async function llm(messages, schema, {maxTokens = 400, temperature = 0.1, timeout = 90_000, repeatPenalty} = {}) {
    const body = {model, messages, temperature, max_tokens: maxTokens, stream: false,
      chat_template_kwargs: {enable_thinking: false}, ...(repeatPenalty ? {repeat_penalty: repeatPenalty} : {})};
    if (schema) body.response_format = {type: 'json_schema', json_schema: {name: 'reply', schema}};
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetchImpl(`${llmUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      });
      if (!response.ok) throw fail(`IVR model request failed (${response.status}): ${(await response.text()).slice(0, 300)}`, 502);
      const content = (await response.json()).choices?.[0]?.message?.content ?? '';
      if (!schema) return content.trim();
      try { return JSON.parse(content); } catch (error) { lastError = error; }
    }
    throw fail(`IVR model returned invalid JSON: ${lastError?.message}`, 502);
  }

  // ── Scripts, cached translations and figure transcriptions ────────────────
  async function cacheFile(id) {
    try { return JSON.parse(await fs.readFile(path.join(cacheDir, `${id}.json`), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
  }
  async function saveCache(id, update) {
    await fs.mkdir(cacheDir, {recursive: true});
    const current = await cacheFile(id);
    const next = {...current, ...update(current)};
    const temp = path.join(cacheDir, `.${id}-${process.pid}-${Date.now()}.json`);
    await fs.writeFile(temp, JSON.stringify(next));
    await fs.rename(temp, path.join(cacheDir, `${id}.json`));
    return next;
  }

  async function defaultScenarioId() {
    const list = await scenarios.list();
    const ready = list.filter(item => item.simulation && item.files?.some(file => /\.html?$/i.test(file.name)));
    return ready.at(-1)?.id;
  }

  async function script(id) {
    const record = await scenarios.get(id);
    const key = JSON.stringify([id, record.files, record.attachments]);
    if (scripts.get(id)?.key !== key) {
      const loaded = await loadScript(record, path.join(scenarioRoot, id));
      if (!loaded) throw fail('The selected scenario is not an HTML call script with 情境 sections', 404);
      scripts.set(id, {key, script: loaded});
    }
    return scripts.get(id).script;
  }

  async function figureText(scriptId, figure) {
    const cached = (await cacheFile(scriptId)).figures?.[figure.key];
    if (cached) return cached;
    if (!pendingFigures.has(figure.key)) {
      pendingFigures.set(figure.key, (async () => {
        const bytes = figure.src
          ? Buffer.from(figure.src.replace(/^data:[^,]*,/, ''), 'base64')
          : await fs.readFile(figure.path);
        const image = await figureImage(bytes);
        const text = await llm([{role: 'user', content: [
          {type: 'image_url', image_url: {url: image}},
          {type: 'text', text: figurePrompt},
        ]}], undefined, {maxTokens: 1500, temperature: 0, timeout: 180_000, repeatPenalty: 1.1});
        await saveCache(scriptId, current => ({figures: {...current.figures, [figure.key]: text}}));
        log(`[ivr-engine] Transcribed figure ${figure.key.slice(0, 12)} (${text.length} chars)`);
        return text;
      })().finally(() => pendingFigures.delete(figure.key)));
    }
    return pendingFigures.get(figure.key);
  }

  function warmFigures(loaded) {
    for (const section of loaded.sections)
      for (const figure of section.figures ?? [])
        figureText(loaded.id, figure).catch(error => log(`[ivr-engine] Figure transcription failed: ${error.message}`));
  }

  // English callers hear the authored opening and outbound lines translated
  // once by the model; the translation is cached with the script.
  async function translated(loaded, kind, texts) {
    const key = sha(JSON.stringify(texts));
    const cached = (await cacheFile(loaded.id)).translations?.[key];
    if (cached?.length === texts.length) return cached;
    const result = await llm([
      {role: 'system', content: 'Translate each Traditional Chinese IVR prompt into one natural spoken English sentence. Keep names, numbers, dates, times, IDs and the menu digits unchanged. Return the same number of items in the same order.'},
      {role: 'user', content: JSON.stringify(texts)},
    ], {type: 'object', properties: {items: {type: 'array', items: {type: 'string'}, minItems: texts.length, maxItems: texts.length}}, required: ['items']},
    {maxTokens: 120 * texts.length, temperature: 0});
    const items = result.items.map(item => String(item).trim());
    await saveCache(loaded.id, current => ({translations: {...current.translations, [key]: items}}));
    log(`[ivr-engine] Cached English ${kind} for ${loaded.name}`);
    return items;
  }
  async function openingPrompt(loaded, session, step) {
    if (session.language !== 'en') return loaded.opening[step].text;
    return (await translated(loaded, 'opening', loaded.opening.map(prompt => prompt.text)))[step];
  }

  // ── Sessions ──────────────────────────────────────────────────────────────
  const sessionFile = id => path.join(sessionsDir, `${encodeURIComponent(id)}.json`);
  async function readSession(id) {
    const cached = sessions.get(id);
    const session = cached ?? await fs.readFile(sessionFile(id), 'utf8').then(JSON.parse).catch(error => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (!session || now() - session.updatedAt > sessionTtlMs) return undefined;
    sessions.set(id, session);
    return session;
  }
  async function writeSession(session) {
    session.updatedAt = now();
    // The model sees the last maxHistory turns; the call log keeps every turn.
    session.transcript ??= [];
    for (const turn of session.history) {
      if (turn.logged) continue;
      turn.logged = true;
      session.transcript.push({role: turn.role, text: turn.content, at: session.updatedAt});
    }
    session.transcript = session.transcript.slice(-maxTranscript);
    session.history = session.history.slice(-maxHistory);
    sessions.set(session.id, session);
    await fs.mkdir(sessionsDir, {recursive: true});
    const temp = sessionFile(session.id) + `.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(session));
    await fs.rename(temp, sessionFile(session.id));
  }
  async function pruneSessions() {
    for (const [id, session] of sessions) if (now() - session.updatedAt > sessionTtlMs) sessions.delete(id);
    let names = [];
    try { names = await fs.readdir(sessionsDir); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (const name of names) {
      const file = path.join(sessionsDir, name);
      const stat = await fs.stat(file).catch(() => undefined);
      if (stat && now() - stat.mtimeMs > sessionTtlMs) await fs.rm(file, {force: true});
    }
  }
  // Turns for one call run one at a time, so a retry or a late duplicate
  // cannot interleave with the turn that is still being answered.
  function serialized(id, operation) {
    const previous = locks.get(id) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(operation);
    const tail = next.catch(() => {});
    locks.set(id, tail);
    tail.then(() => { if (locks.get(id) === tail) locks.delete(id); });
    return next;
  }

  // ── Scenario steps ────────────────────────────────────────────────────────
  // Returns a script section, LOOKUP (questions about saved work orders), or
  // undefined when the request is unclear. The previous exchange is context
  // for follow-ups such as 「那最舊的呢？」.
  async function route(loaded, text, {previous = [], lookup = false, followUp = ''} = {}) {
    const direct = explicitSection(text, loaded.sections) ?? namedSection(text, loaded.sections);
    if (direct) return direct;
    if (isFiller(text)) return undefined;
    // Title-first options: the title names the kind of call (A/B tested on the
    // script's caller lines; examples alone pull reports toward one scenario).
    const options = loaded.sections.map(section => {
      const example = section.outbound ? '(the system calls out to the person)'
        : `caller example: "${section.turns.find(turn => turn.role === 'caller')?.text.slice(0, 120) ?? ''}"`;
      return `option "${section.number}" = ${section.title}. ${example}`;
    });
    if (lookup) options.push('option "lookup" = 查詢已儲存的工單 (asking about work orders that were already saved: the latest, oldest, a number, details). Not for reporting a new job.'
      + (followUp ? ` The previous answer described saved work order ${followUp}: questions about it (它/這張/那張, its 維修內容, 設備, 日期, 測試結果, 備註) are this option.` : ''));
    const context = previous.length
      ? `\nPrevious exchange:\n${previous.map(turn => `${turn.role === 'assistant' ? 'AI' : 'Caller'}: ${turn.content}`).join('\n')}` : '';
    const ids = ['none', ...loaded.sections.map(section => String(section.number)), ...(lookup ? ['lookup'] : [])];
    const result = await llm([
      {role: 'system', content: [
        'Pick the IVR option that matches what the caller wants now. Compare the request with each option\'s title and example; the title says what kind of call it is.',
        'Answer none when the request matches no option or is unclear.',
        `Options:\n${options.join('\n')}${context}`,
      ].join('\n')},
      {role: 'user', content: text},
    ], {type: 'object', properties: {option: {type: 'string', enum: ids}}, required: ['option']},
    {maxTokens: 20, temperature: 0});
    if (result.option === 'lookup') return LOOKUP;
    return loaded.sections.find(section => String(section.number) === result.option);
  }

  // Answers a question about saved work orders from the work_orders Data Table
  // rows n8n sends with the turn (newest saved first). The model only reads the
  // question; selecting rows and wording the answer are deterministic, so a
  // latest/oldest mix-up or an invented field cannot happen.
  async function lookupReply(session, text, rows) {
    const query = await llm([
      {role: 'system', content: [
        'The caller asks about saved work orders. Classify the question.',
        'which: "latest" (最新/最近/上一張/剛剛), "oldest" (最舊/最早/第一張), "number" (a work order number is mentioned; copy it exactly into number), "all" (list them or how many), "same" (a follow-up about the work order just answered, e.g. 那它的維修內容呢、設備是什麼).',
        'field: "summary" unless the caller asks for one detail: "date" (日期/什麼時候), "equipment" (設備), "work" (維修內容/做了什麼/更換), "test" (測試結果), "notes" (備註).',
        session.workOrder ? `The work order just answered: ${session.workOrder}.` : 'No work order has been answered yet.',
      ].join('\n')},
      {role: 'user', content: text},
    ], {type: 'object', properties: {which: {type: 'string', enum: ['latest', 'oldest', 'number', 'all', 'same']}, number: {type: 'string'},
      field: {type: 'string', enum: ['summary', 'date', 'equipment', 'work', 'test', 'notes']}},
      required: ['which', 'number', 'field']}, {maxTokens: 60, temperature: 0});
    const row = query.which !== 'all' && pickWorkOrder(rows, query, session.workOrder);
    const reply = describeWorkOrders(rows, query, session.language, session.workOrder);
    if (row) session.workOrder = row.order_id;
    return reply;
  }

  async function sectionReference(loaded, section, hidden) {
    const figures = await Promise.all((section.figures ?? []).map(figure => figureText(loaded.id, figure)));
    return [`REFERENCE SCRIPT (情境 ${section.number}：${section.title})`, scriptText(section, hidden),
      ...figures.map((text, index) => `REFERENCE FIGURE ${index + 1}\n${text}`)].join('\n\n');
  }

  async function scenarioReply(loaded, session, section) {
    const history = runTurns(session, section.number, session.scenarioRun).map(({role, content}) => ({role, content}));
    const reference = await sectionReference(loaded, section, section.saves ? unsaidExamples(section, history) : undefined);
    const language = session.language === 'en' ? 'English' : 'Traditional Chinese (繁體中文)';
    const system = [
      `You are the GeoVision phone IVR voice assistant. This call is in scenario ${section.number}: ${section.title}.`,
      'The REFERENCE SCRIPT shows how this scenario goes (AI = you, Caller = the caller). Follow its stages, order and wording style.',
      'Rules:',
      '- Give exactly the next single spoken AI turn for the live call: short, natural, plain text. No markdown, lists, emojis or role labels.',
      '- Facts about this call (names, dates, IDs, part numbers, quantities, serial numbers, readings, scores) come only from what the caller said in this call. Repeat them exactly, keeping letters, digits, leading zeros and units. Never present the script\'s example values as the caller\'s.',
      '- Reference facts (stock, lead times, SOP steps, fault-code meanings, colleague details) come only from the AI lines of the REFERENCE SCRIPT and the REFERENCE FIGURES. If the caller asks for something that is not there, say it is not in the reference. Never invent.',
      '- A script AI line ending in …… is abbreviated: give the complete answer from the REFERENCE FIGURES.',
      '- Where the script reads values back and asks for confirmation, read back the caller\'s actual values and ask the same way. If the caller corrects something, read back the corrected values.',
      '- When the caller has given what the script\'s next AI line needs, move on; ask only for what is still missing.',
      '- If the caller has only chosen this scenario and has not yet given the details the script\'s first AI line reads back or answers, ask for those details briefly (use line 0) instead of reading anything back.',
      '- A script AI line often acknowledges the caller and then asks the next question. Say the whole line, including the next question, until the script\'s closing line.',
      '- This is a simulation. Do not claim real actions beyond what the script\'s AI lines say.',
      `Set line to the number of the script AI line your reply performs (1–${aiLines(section)}). Use 0 if the caller asks something the script has no line for.`,
      'Set switch to true only when the caller clearly asks for a different service than this scenario.',
      session.language === 'en'
        ? 'The caller chose English. The script is in Chinese: speak the equivalent line in natural English, keeping IDs, numbers and units exactly.'
        : `Reply in ${language}.`,
      '',
      reference,
    ].join('\n');
    const schema = {
      type: 'object',
      properties: {
        line: {type: 'integer', minimum: 0, maximum: aiLines(section)},
        reply: {type: 'string'},
        switch: {type: 'boolean'},
      },
      required: ['line', 'reply', 'switch'],
    };
    let result = await llm([{role: 'system', content: system}, ...history], schema, {maxTokens: 400});
    // In report scripts the AI lines echo the caller's data, so identifiers from
    // the example caller lines that this caller never said are leaked example
    // data; regenerate once with them named. (In lookup scripts those IDs are
    // reference facts.)
    const leaks = text => section.saves ? exampleLeaks(section, history, text) : [];
    const leaked = leaks(result.reply);
    if (leaked.length || (section.saves && /範例|\[example/i.test(result.reply))) {
      log(`[ivr-engine] Regenerating reply that repeated example data: ${leaked.join(', ') || result.reply}`);
      result = await llm([{role: 'system', content: system}, ...history, {role: 'system',
        content: `Your reply "${result.reply}" contains example data from the script${leaked.length ? ` (${leaked.join(', ')})` : ''} that the caller never said. Rewrite it using only the items the caller actually said in this call; leave out anything else.`}],
      schema, {maxTokens: 400});
    }
    // The scenario is complete once its last AI line has been said. A turn that
    // matches no script line is checked against the other options (it may be
    // a new request) before the scenario carries on.
    const status = result.switch || result.line === 0 ? 'switch' : result.line === aiLines(section) ? 'done' : 'continue';
    // A reply that stops partway through its script line (dropping the next
    // question) is completed with the authored line.
    const authored = section.turns.filter(turn => turn.role === 'assistant')[result.line - 1]?.text;
    let reply = String(result.reply ?? '').trim();
    if (section.saves) reply = dropExampleSentences(reply, leaks(reply));
    if (session.language === 'en' && hanShare(reply) > 0) reply = (await translated(loaded, 'reply', [reply]))[0];
    if (session.language !== 'en' && authored && compact(reply).length >= 2 &&
      compact(authored).startsWith(compact(reply)) && compact(authored) !== compact(reply)) return {reply: authored, status};
    return {reply, status};
  }

  // History entries carry the scenario number and run, so a scenario that is
  // entered twice in one call never mixes the two runs.
  const runTurns = (session, number, run) => session.history.filter(turn => turn.scenario === number && turn.run === run);

  async function workOrderRecord(session, {number, title, run}) {
    const turns = runTurns(session, number, run);
    const transcript = turns.map(turn => `${turn.role === 'assistant' ? 'AI' : 'Caller'}: ${turn.content}`).join('\n');
    const fields = await llm([
      {role: 'system', content: [
        'Extract the work order the caller reported in this IVR call. Use only facts the caller stated or confirmed, copied exactly (keep IDs, units and numbers). Use an empty string when a field was not given.',
        'date: job date as YYYY-MM-DD, followed by HH:MM if a time was given.',
        'reference: a work-order or job number only if the caller said one explicitly; never a time or equipment ID.',
        'title: the job name, e.g. customer, site and job description.',
        'equipment: every equipment or device ID mentioned (such as C1-VFD-12CC04), separated by "、". A product or drive model (such as PF753) is not an equipment ID; put it in details.',
        'details: the work done, faults, fault codes (e.g. "Fault Code：010"), readings and quantities, per equipment. Keep every quantity the caller gave, even if the speech recognition garbled the item name (e.g. "分2個" for "FAN 2個").',
        'notes: extra remarks such as part numbers, serial numbers, manufacture dates, capacitance or motor nameplate data.',
        'test_result: the startup/test-run outcome only (e.g. 正常); empty if none was reported.',
      ].join('\n')},
      {role: 'user', content: transcript},
    ], {
      type: 'object',
      properties: Object.fromEntries(['date', 'reference', 'title', 'equipment', 'details', 'notes', 'test_result']
        .map(name => [name, {type: 'string'}])),
      required: ['date', 'reference', 'title', 'equipment', 'details', 'notes', 'test_result'],
    }, {maxTokens: 700, temperature: 0});
    const report_key = reportKey(session.id, number, run);
    return {
      order_id: orderId(report_key),
      report_key,
      session_id: session.id,
      dispatch_date: fields.date,
      reference_number: fields.reference,
      title: fields.title,
      equipment_number: fields.equipment,
      maintenance_items: fields.details,
      quantity: '',
      notes: fields.notes,
      test_result: fields.test_result,
      transcripts: JSON.stringify(turns.filter(turn => turn.role === 'user').map(turn => turn.content)),
      results: JSON.stringify({scenario: number, title, fields,
        dialogue: turns.map(({role, content}) => ({role, content}))}),
    };
  }

  async function enter(loaded, session, section) {
    session.scenario = section.number;
    session.scenarioRun = (session.scenarioRun ?? 0) + 1;
    if (!section.outbound) return undefined;
    // Outbound scenarios start with the script's own first AI line.
    const first = section.turns[0].text;
    const reply = session.language === 'en' ? (await translated(loaded, 'outbound line', [first]))[0] : first;
    return {reply, status: section.turns.length === 1 ? 'done' : 'continue'};
  }

  // Returns {reply, status, section?}; records both turns in the history.
  async function scenarioTurn(loaded, session, text, rows = []) {
    let section = loaded.sections.find(item => item.number === session.scenario);
    // Inside a scenario a bare number is an answer (a score, a quantity), so
    // only an explicit "情境 N" switches to another scenario.
    const explicit = explicitSection(text, loaded.sections, {bare: !section});
    if (section && explicit && explicit.number !== section.number) section = undefined;
    const record = (role, content, current) => session.history.push(
      {role, content, scenario: current?.number ?? null, run: current ? session.scenarioRun : null});
    if (!section) {
      const previous = session.history.slice(-2).map(({role, content}) => ({role, content}));
      const followUp = session.history.at(-1)?.lookup ? session.workOrder ?? '' : '';
      const routed = explicit ?? await route(loaded, text, {previous, lookup: Array.isArray(rows), followUp});
      if (routed) session.unclear = 0;
      if (routed === LOOKUP) {
        session.scenario = null;
        const reply = await lookupReply(session, text, rows);
        record('user', text); record('assistant', reply);
        session.history.at(-1).lookup = true;
        return {reply, status: 'done', lookup: true};
      }
      section = routed;
      if (!section) {
        session.scenario = null;
        // Repeat the menu question once; on a second unclear request, say what is available.
        const menu = await openingPrompt(loaded, session, loaded.opening.length - 1);
        const repeated = (session.unclear = (session.unclear ?? 0) + 1) > 1;
        const titles = loaded.sections.filter(item => !item.outbound).map(item => item.title);
        const reply = !repeated ? menu : session.language === 'en'
          ? `${menu} You can say: ${(await translated(loaded, 'menu options', titles)).join(', ')}, or ask about saved work orders.`
          : `${menu}可以說：${titles.join('、')}，或查詢已儲存的工單。`;
        record('user', text); record('assistant', reply);
        return {reply, status: 'menu'};
      }
      const started = await enter(loaded, session, section);
      if (started) {
        record('user', text, section); record('assistant', started.reply, section);
        return {...started, section};
      }
    }
    record('user', text, section);
    let result = await scenarioReply(loaded, session, section);
    if (result.status === 'switch') {
      const next = await route(loaded, text, {lookup: Array.isArray(rows)});
      if (next && next !== section) {
        session.history.pop();
        session.scenario = null;
        return scenarioTurn(loaded, session, text, rows);
      }
      result = {...result, status: 'continue'};
    }
    const reply = String(result.reply ?? '').trim();
    if (!reply) throw fail('The IVR model returned an empty reply', 502);
    record('assistant', reply, section);
    return {reply, status: result.status, section};
  }

  // ── Public API ────────────────────────────────────────────────────────────
  async function start({sessionId, scenarioId}) {
    if (typeof sessionId !== 'string' || !sessionPattern.test(sessionId)) throw fail('Invalid sessionId');
    return serialized(sessionId, async () => {
      await pruneSessions();
      const id = scenarioId || await defaultScenarioId();
      if (!id) throw fail('No HTML call script has been uploaded. Add one under Scenario → Add New Scenario.', 404);
      const loaded = await script(id);
      warmFigures(loaded);
      const session = {id: sessionId, scenarioId: id, language: 'zh', step: 0, scenario: null, scenarioRun: 0,
        history: [], pending: [], createdAt: now()};
      const reply = await openingPrompt(loaded, session, 0);
      session.history.push({role: 'assistant', content: reply, scenario: null, run: null});
      await writeSession(session);
      return {reply, stage: 'opening', status: 'continue', language: session.language,
        awaitingLanguage: !!loaded.opening[0].language, scenario: null};
    });
  }

  async function turn({sessionId, text, scenarioId, work_orders}) {
    if (typeof sessionId !== 'string' || !sessionPattern.test(sessionId)) throw fail('Invalid sessionId');
    if (typeof text !== 'string' || !text.trim() || text.length > 4000) throw fail('Caller text is required');
    if (work_orders !== undefined && (!Array.isArray(work_orders) || work_orders.length > 50 ||
      work_orders.some(row => !row || typeof row !== 'object' || Array.isArray(row)))) throw fail('Invalid work_orders');
    // Trim long fields so the newest rows fit the model's context.
    const rows = work_orders?.map(row => Object.fromEntries(Object.entries(row)
      .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 300) : value])));
    text = text.trim();
    let session = await readSession(sessionId);
    if (!session || (scenarioId && session.scenarioId !== scenarioId)) await start({sessionId, scenarioId});
    return serialized(sessionId, async () => {
      session = await readSession(sessionId);
      const loaded = await script(session.scenarioId);
      let response;
      if (session.step < loaded.opening.length - 1) {
        // Opening: language, identity questions, then the service menu.
        const prompt = loaded.opening[session.step];
        let valid = true;
        if (prompt.language) {
          const language = chooseLanguage(text);
          if (language) session.language = language; else valid = false;
        } else if (prompt.digits) {
          valid = spokenDigits(text).length === prompt.digits;
        }
        if (valid) {
          session.answers = [...(session.answers ?? []), {step: session.step, answer: text}];
          session.step++;
        }
        const reply = await openingPrompt(loaded, session, session.step);
        session.history.push({role: 'user', content: text, scenario: null, run: null},
          {role: 'assistant', content: reply, scenario: null, run: null});
        response = {reply, status: 'continue', stage: 'opening', scenario: null};
      } else {
        // The answer to the service menu (the last opening question) is the first request.
        if (session.step === loaded.opening.length - 1)
          session.answers = [...(session.answers ?? []), {step: session.step, answer: text}];
        session.step = loaded.opening.length;
        const {reply, status, section, lookup} = await scenarioTurn(loaded, session, text, rows);
        response = {reply, status, stage: section ? 'scenario' : lookup ? 'lookup' : 'menu',
          scenario: section ? {number: section.number, title: section.title} : null};
        if (section && status === 'done') {
          session.scenario = null;
          if (section.saves) {
            // The reply goes out now; the work order is extracted afterwards
            // through {record: true}, so the caller never waits for it.
            const pending = {number: section.number, title: section.title, run: session.scenarioRun};
            session.pending = [...(session.pending ?? []), pending];
            response.work_order = {order_id: orderId(reportKey(session.id, pending.number, pending.run)), pending: true};
          }
        }
      }
      await writeSession(session);
      return {...response, language: session.language,
        awaitingLanguage: session.step === 0 && !!loaded.opening[0].language};
    });
  }

  // Data Table column names for the opening questions (ASCII snake_case, as
  // n8n requires), named once per script by the model and cached.
  async function openingColumns(loaded) {
    const questions = loaded.opening.map(prompt => prompt.text);
    const key = sha(JSON.stringify(['columns-v2', questions]));
    const cached = (await cacheFile(loaded.id)).columns?.[key];
    if (cached?.length === questions.length) return cached;
    let names = [];
    try {
      const result = await llm([
        {role: 'system', content: 'Each item is a question an IVR asks the caller. Give the database column that stores the caller\'s answer, in short English snake_case (lowercase letters, digits, underscores; starts with a letter; at most 30 characters). Name the information itself and whose it is, not why it is asked, e.g. 請說出您的身分證字號後4碼? → id_number_last4, 請問您的分機號碼? → extension_number. No prefixes like answer_ or caller_. For a question asking what the caller needs, use request. Return the same number of items in the same order.'},
        {role: 'user', content: JSON.stringify(questions)},
      ], {type: 'object', properties: {items: {type: 'array', items: {type: 'string'}, minItems: questions.length, maxItems: questions.length}}, required: ['items']},
      {maxTokens: 30 * questions.length, temperature: 0});
      names = result.items.map(item => String(item).trim().toLowerCase());
    } catch (error) { log(`[ivr-engine] Cannot name opening columns for ${loaded.name}: ${error.message}`); }
    const used = new Set();
    const columns = questions.map((_, index) => {
      const name = names[index];
      const valid = name && columnPattern.test(name) && !reservedColumns.has(name) && !used.has(name);
      const column = valid ? name : `opening_${index + 1}`;
      used.add(column);
      return column;
    });
    if (names.length) await saveCache(loaded.id, current => ({columns: {...current.columns, [key]: columns}}));
    return columns;
  }

  // One call_sessions row: when the call started, the opening answers (one
  // column per opening question), the whole conversation and its duration.
  async function call({sessionId}) {
    if (typeof sessionId !== 'string' || !sessionPattern.test(sessionId)) throw fail('Invalid sessionId');
    return serialized(sessionId, async () => {
      const session = await readSession(sessionId);
      if (!session) return {rows: []};
      const loaded = await script(session.scenarioId);
      const columns = await openingColumns(loaded);
      const answer = step => (session.answers ?? []).findLast(item => item.step === step)?.answer ?? '';
      const transcript = session.transcript ?? [];
      const started = new Date(session.createdAt);
      const part = options => new Intl.DateTimeFormat('en-CA', {timeZone, ...options}).format(started);
      const row = {
        session_id: session.id,
        channel: session.id.startsWith('sip-') ? 'sip' : session.id.startsWith('web-') ? 'web' : 'other',
        date: part({year: 'numeric', month: '2-digit', day: '2-digit'}),
        time: part({hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'}),
        ...Object.fromEntries(columns.map((column, step) => [column, answer(step)])),
        opening: JSON.stringify(Object.fromEntries(loaded.opening.map((prompt, step) => [prompt.text, answer(step)]))),
        conversation: transcript.map(turn => `${turn.role === 'assistant' ? 'AI' : '來電者'}：${turn.text}`).join('\n'),
        conversation_duration: clock(Math.max(0, Math.round(((transcript.at(-1)?.at ?? session.createdAt) - session.createdAt) / 1000))),
      };
      return {rows: [row], columns: Object.keys(row)};
    });
  }

  // Extract and return every work order completed but not yet saved.
  async function records({sessionId}) {
    if (typeof sessionId !== 'string' || !sessionPattern.test(sessionId)) throw fail('Invalid sessionId');
    return serialized(sessionId, async () => {
      const session = await readSession(sessionId);
      if (!session?.pending?.length) return {records: []};
      const output = [];
      for (const pending of session.pending) output.push(await workOrderRecord(session, pending));
      session.pending = [];
      await writeSession(session);
      return {records: output};
    });
  }

  async function end({sessionId}) {
    if (typeof sessionId !== 'string' || !sessionPattern.test(sessionId)) throw fail('Invalid sessionId');
    sessions.delete(sessionId);
    await fs.rm(sessionFile(sessionId), {force: true});
    return {ended: true};
  }

  async function handle(body) {
    if (body?.end === true) return end(body);
    if (body?.records === true) return records(body);
    if (body?.call === true) return call(body);
    if (body?.start === true || typeof body?.text !== 'string' || !body.text.trim()) return start(body ?? {});
    return turn(body);
  }

  // Read every uploaded script's figures ahead of the first call.
  async function warm() {
    for (const item of await scenarios.list()) {
      if (!item.simulation) continue;
      try { warmFigures(await script(item.id)); }
      catch (error) { log(`[ivr-engine] Cannot prepare ${item.name}: ${error.message}`); }
    }
  }

  return {start, turn, end, records, call, handle, script, figureText, warm};
}
