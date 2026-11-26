// SOPs: each uploaded CSV table or HTML call script becomes one Q/A
// SOP that an n8n agent follows. The local LLM (LFM2.5 by default) reads
// the file and writes the SOP:
//   purpose        one line the router uses to pick this SOP
//   instructions   how the agent answers callers from this file
//   qa             question/answer pairs grounded in the file
//   hotwords       names and terms for the ASR context
// A CSV is read from its headers and sample rows: the model writes question
// and answer templates over the columns, which are filled from every row, so
// each answer is a real row. An HTML call script is read section by section.
// Q/A pairs and source passages are indexed with a text embedding model
// (Qwen3-Embedding-0.6B) for the agent's search skill.
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const fail = (message, status = 400) => Object.assign(new Error(message), {status});
const norm = text => String(text ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const clean = text => String(text ?? '').replace(/\s+/g, ' ').trim();
const writerVersion = 'sop-writer-v8';

export function sopKind(record) {
  const file = record?.files?.length === 1 ? record.files[0].name : '';
  if (/\.html?$/i.test(file) && (record.dataset?.template ?? []).some(section => Number.isInteger(section.number) && section.turns?.length)) return 'script';
  if (/\.csv$/i.test(file) && record.dataset?.tables?.[0]?.records?.length) return 'table';
  return undefined;
}
// The same, from a scenario listing (which omits the dataset).
const listedSop = item => (item.simulation && /\.html?$/i.test(item.files?.[0]?.name ?? '')) ||
  (/\.csv$/i.test(item.files?.[0]?.name ?? '') && item.tables?.[0]?.rowCount > 0);

const rowFields = (table, record) => Object.fromEntries(table.headers
  .map(header => [header.trim(), clean(record.fields[header])]).filter(([, value]) => value));
export const rowText = fields => Object.entries(fields).map(([key, value]) => `${key}：${value}`).join('；');

// Fill a template's {column} placeholders from one row; undefined when the
// row lacks a value the template needs.
export function fillTemplate(template, fields) {
  let missing = false;
  const text = template.replace(/\{([^{}]+)\}/g, (_, key) => {
    const value = fields[key.trim()];
    if (!value) missing = true;
    return value ?? '';
  });
  return missing ? undefined : clean(text);
}
export const placeholders = template => [...template.matchAll(/\{([^{}]+)\}/g)].map(match => match[1].trim());

export function scriptPassages(script, figures = new Map()) {
  const line = turn => `${turn.role === 'assistant' ? 'AI' : '來電者'}：${turn.text}`;
  return [
    {id: 'opening', section: 0, title: '開場', text: ['開場', ...script.opening.map(item => `AI：${item.text}`)].join('\n')},
    ...script.sections.map(section => ({
      id: `section-${section.number}`, section: section.number, title: section.title,
      text: [`情境 ${section.number}：${section.title}`, ...section.turns.map(line),
        ...(section.figures ?? []).map(figure => figures.get(figure.key)).filter(Boolean).map(text => `圖表：${text}`)].join('\n'),
    })),
  ];
}

// The greeting's name for an SOP: the model's phrase up to its first
// punctuation, or the file name.
const shortOffer = (offer, name) => clean(offer).split(/[，,。、；;：:（(]/)[0].slice(0, 12) || name.replace(/\.[a-z]+$/i, '');

// A script's offer must name what its sections handle; otherwise the two
// shortest section titles are used.
function scriptOffer(offer, titles) {
  const words = new Set(titles.join('').match(/\p{Script=Han}{2}/gu) ?? []);
  if ((offer.match(/\p{Script=Han}{2}/gu) ?? []).some(pair => words.has(pair))) return offer;
  return [...titles].sort((a, b) => a.length - b.length).slice(0, 2).join('或');
}

// Codes a speech recognizer is likely to miss: letters with digits.
const codes = text => (String(text).normalize('NFKC').match(/[A-Za-z][A-Za-z0-9-]*\d[A-Za-z0-9-]*|\d+[A-Za-z]{2,}[A-Za-z0-9-]*/g) ?? [])
  .filter(token => token.length >= 3 && token.length <= 30);

// Source passages are stored in pieces small enough for a 1.2B model's
// context: whole lines, about 500 characters each, under their heading.
export function chunks(text, size = 500) {
  const lines = String(text).split('\n');
  if (text.length <= size) return [text];
  const heading = lines[0], out = [];
  let current = heading;
  for (const line of lines.slice(1)) {
    if (current.length + line.length + 1 > size && current !== heading) { out.push(current); current = heading; }
    current += '\n' + line.slice(0, size);
  }
  if (current !== heading) out.push(current);
  return out;
}
export const sopCollection = id => `sop_${id}`;
const cosine = (a, b) => { let sum = 0; for (let i = 0; i < a.length; i++) sum += a[i] * b[i]; return sum; };
const unit = vector => { const length = Math.hypot(...vector) || 1; return vector.map(value => value / length); };

export function createSops({
  scenarios, dataRoot = process.env.KNOWLEDGE_DATA_ROOT || '/data', script: loadScript, figureText,
  llmUrl = process.env.IVR_LLM_URL || 'http://voice-ai:8082/v1',
  model = process.env.IVR_LLM_MODEL || 'bartowski/LiquidAI_LFM2.5-1.2B-Instruct-GGUF:Q4_K_M',
  embedUrl = process.env.IVR_TEXT_EMBED_URL || 'http://voice-ai:8084/v1',
  embedModel = process.env.IVR_TEXT_EMBED_MODEL || 'Qwen/Qwen3-Embedding-0.6B-GGUF:Q8_0',
  hotwordsFile = process.env.IVR_HOTWORDS_FILE || '', fetchImpl = fetch, log = console.log,
  qdrantUrl = process.env.IVR_QDRANT_URL || 'http://127.0.0.1:6333',
} = {}) {
  const sopDir = path.join(dataRoot, 'sops');
  const managedFile = path.join(dataRoot, 'sop-hotwords.json');
  // SOPs were first stored as "runbooks": move that data once, and drop the
  // old Qdrant collections (n8n re-embeds each SOP into sop_<id>).
  const migrated = (async () => {
    const legacyDir = path.join(dataRoot, 'runbooks');
    const moved = await fs.rename(legacyDir, sopDir).then(() => true, error => {
      if (['ENOENT', 'EEXIST', 'ENOTEMPTY'].includes(error.code)) return false;
      throw error;
    });
    await fs.rename(path.join(dataRoot, 'runbook-hotwords.json'), managedFile).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (!moved) return;
    for (const name of await fs.readdir(sopDir)) {
      const id = /^([a-f0-9]{24})\.json$/.exec(name)?.[1];
      if (id) await qdrant(`/collections/runbook_${id}`, 'DELETE').catch(error => log(`[sops] ${error.message}`));
    }
    log(`[sops] Moved ${legacyDir} to ${sopDir}`);
  })();
  migrated.catch(() => {});  // awaited (and reported) by read, syncHotwords and removed
  const sessions = new Map();
  const loaded = new Map();
  const writing = new Map();

  async function llm(messages, schema, {maxTokens = 800} = {}) {
    const response = await fetchImpl(`${llmUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(300_000),
      body: JSON.stringify({model, messages, temperature: 0.1, max_tokens: maxTokens, stream: false,
        response_format: {type: 'json_schema', json_schema: {name: 'sop', schema}}}),
    });
    if (!response.ok) throw fail(`SOP writer LLM HTTP ${response.status}`, 502);
    const content = (await response.json()).choices?.[0]?.message?.content ?? '';
    try { return JSON.parse(content); } catch { throw fail('SOP writer returned invalid JSON', 502); }
  }
  async function embed(texts) {
    const vectors = [];
    for (let i = 0; i < texts.length; i += 16) {
      const response = await fetchImpl(`${embedUrl}/embeddings`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({model: embedModel, input: texts.slice(i, i + 16)}), signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw fail(`Embedding HTTP ${response.status}`, 502);
      const {data} = await response.json();
      vectors.push(...data.sort((a, b) => a.index - b.index).map(item => unit(item.embedding)));
    }
    return vectors;
  }
  // Qdrant (the RAG store) is filled by n8n's Embed skill from documents();
  // this service only removes an SOP's collection with the SOP.
  async function qdrant(route, method = 'GET', body) {
    const response = await fetchImpl(`${qdrantUrl}${route}`, {method, headers: {'Content-Type': 'application/json'},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: AbortSignal.timeout(60_000)});
    if (!response.ok && !(method === 'DELETE' && response.status === 404)) throw fail(`Qdrant ${route}: HTTP ${response.status}`, 502);
    return response.json().catch(() => ({}));
  }
  // Qwen3-Embedding: queries carry a task instruction, documents do not.
  const queryText = query => `Instruct: Given a phone caller's question, retrieve the SOP answer or source passage that answers it\nQuery: ${query}`;

  // ── Writing an SOP from a CSV table ─────────────────────────────────
  // The model classifies the columns (constrained to the real headers); the
  // Q/A is built from them over every row, so every answer is a real row.
  async function writeTable(record) {
    const table = record.dataset.tables[0];
    const headers = table.headers.map(header => header.trim());
    const rows = table.records.map(item => rowFields(table, item)).filter(fields => Object.keys(fields).length);
    const samples = rows.slice(0, 5).map(rowText).join('\n');
    const result = await llm([
      {role: 'system', content: '你是電話語音客服的設計者，閱讀上傳的表格並分類它的欄位。只用繁體中文。'},
      {role: 'user', content: `檔名：${record.name}\n欄位：${headers.join('、')}\n範例資料（共 ${rows.length} 列）：\n${samples}\n\n` +
        'key_columns：來電者會用來指出是哪一筆資料的欄位（例如姓名、英文名、部門、型號），一到三個。\n' +
        'answer_columns：來電者想知道的欄位（例如分機、電話、職稱、信箱、數量、日期），一到四個。\n' +
        'purpose：一句話說明來電者可以用這份表格查什麼（例如「查詢同仁的分機與聯絡方式」）。\n' +
        'offer：總機問候時列出的服務名稱，四到八個字，不要標點（例如「轉接同仁分機」）。\n' +
        'not_found：查不到時對來電者說的一句話。'},
    ], {
      type: 'object', required: ['key_columns', 'answer_columns', 'purpose', 'offer', 'not_found'],
      properties: {
        key_columns: {type: 'array', minItems: 1, maxItems: 3, items: {type: 'string', enum: headers}},
        answer_columns: {type: 'array', minItems: 1, maxItems: 4, items: {type: 'string', enum: headers}},
        purpose: {type: 'string', maxLength: 80}, offer: {type: 'string', maxLength: 16}, not_found: {type: 'string', maxLength: 80},
      },
    });
    // Checked against the data: a column that barely varies (a company name)
    // cannot identify a row, and an all-digit column (an extension) is
    // something callers ask for, not something they say.
    const distinct = column => new Set(rows.map(fields => fields[column]).filter(Boolean)).size / Math.max(1, rows.length);
    const numeric = column => rows.every(fields => !fields[column] || /^[\d\s#*,()+-]+$/.test(fields[column].normalize('NFKC')));
    // Short values that are almost all different (names, English names,
    // model numbers) always identify a row.
    const nameLike = column => distinct(column) >= 0.9 && !numeric(column) &&
      rows.every(fields => !fields[column] || (fields[column].length <= 24 && !fields[column].includes('@')));
    let keys = [...new Set([...result.key_columns, ...headers.filter(nameLike)])].filter(column => distinct(column) >= 0.5 && !numeric(column)).slice(0, 3);
    if (!keys.length) keys = headers.filter(column => distinct(column) >= 0.5 && !numeric(column)).slice(0, 1);
    const answers = [...new Set([...result.answer_columns, ...result.key_columns.filter(numeric)])].filter(column => !keys.includes(column));
    if (!answers.length) answers.push(...headers.filter(header => !keys.includes(header)).slice(0, 2));
    const label = column => column.split('/')[0];
    const templates = keys.flatMap(key => answers.map(answer => ({
      question: `{${key}}的${label(answer)}是什麼？`, answer: `{${key}}的${label(answer)}是{${answer}}。`})));
    const qa = [];
    for (const [index, fields] of rows.entries()) for (const template of templates) {
      const question = fillTemplate(template.question, fields), answer = fillTemplate(template.answer, fields);
      if (question && answer && qa.length < 4000) qa.push({question, answer, row: index + 1});
    }
    const hotwords = new Set();
    for (const column of keys) for (const fields of rows) {
      const value = fields[column];
      // Chinese names and terms; English ones are left to the recognizer.
      if (value && value.length <= 20 && /\p{Script=Han}/u.test(value)) hotwords.add(value);
    }
    const instructions = `來電者會用${keys.map(label).join('、')}指出要找的資料，可以詢問${answers.map(label).join('、')}。` +
      `一筆明確符合就直接回答；多筆符合時列出最多三筆請來電者選擇；查不到時說：「${clean(result.not_found)}」`;
    return {
      purpose: `${clean(result.purpose).replace(/[。.]$/, '')}（可查：${answers.map(label).join('、')}；依${keys.map(label).join('、')}）`,
      offer: shortOffer(result.offer, record.name), instructions, templates, qa,
      passages: rows.map((fields, index) => ({id: `row-${index + 1}`, row: index + 1, text: rowText(fields), fields})),
      hotwords: [...hotwords].slice(0, 400),
    };
  }

  // ── Writing an SOP from an HTML call script ─────────────────────────
  async function writeScript(record) {
    const script = await loadScript(record.id);
    const figures = new Map();
    for (const figure of script.sections.flatMap(section => section.figures ?? []))
      figures.set(figure.key, await figureText(record.id, figure).catch(() => ''));
    const passages = scriptPassages(script, figures);
    const overview = await llm([
      {role: 'system', content: '你負責為電話語音客服撰寫 SOP。閱讀通話腳本的開場與各情境標題，判斷它的用途。只用繁體中文。'},
      {role: 'user', content: `檔名：${record.name}\n開場：\n${script.opening.map(item => item.text).join('\n')}\n情境：\n` +
        script.sections.map(section => `${section.number}. ${section.title}`).join('\n') + '\n\n' +
        '請輸出：\npurpose：一句話說明來電者打來可以辦什麼事（例如「設備維修、派工提醒與滿意度調查」）。\n' +
        'offer：總機問候時列出的服務名稱，四到八個字，不要標點，例如「設備維修服務」。\n' +
        'instructions：給語音客服的作答規則，三到五句：先完成開場確認，再依情境腳本回答，事實只能來自腳本與圖表。\n' +
        'hotwords：腳本中語音辨識需要特別注意的專有名詞（公司、產品、型號），最多二十個，必須照抄原文。'},
    ], {
      type: 'object', required: ['purpose', 'offer', 'instructions', 'hotwords'],
      properties: {purpose: {type: 'string', maxLength: 200}, offer: {type: 'string', maxLength: 16}, instructions: {type: 'string', maxLength: 600},
        hotwords: {type: 'array', maxItems: 20, items: {type: 'string', maxLength: 30}}},
    });
    // Each section's Q/A: a caller line and the script's next AI line, both
    // verbatim. The model only adds other ways a caller may say it.
    const qa = [];
    for (const section of script.sections) {
      const pairs = section.turns.flatMap((turn, index) => {
        const next = section.turns.slice(index + 1).find(item => item.role === 'assistant');
        return turn.role === 'caller' && next ? [{question: turn.text, answer: next.text}] : [];
      });
      if (!pairs.length) continue;
      const result = await llm([
        {role: 'system', content: '你協助電話客服整理問法。只用繁體中文。'},
        {role: 'user', content: `情境：${section.title}\n來電者的話：\n${pairs.map((pair, i) => `${i + 1}. ${pair.question}`).join('\n')}\n\n` +
          '請為每一句寫兩種來電者可能的其他說法（意思相同，口語、簡短）。'},
      ], {
        type: 'object', required: ['paraphrases'],
        properties: {paraphrases: {type: 'array', maxItems: pairs.length, items: {type: 'array', maxItems: 2, items: {type: 'string', maxLength: 60}}}},
      }, {maxTokens: 1200}).catch(error => { log(`[sops] ${record.name} 情境 ${section.number}: ${error.message}`); return {paraphrases: []}; });
      for (const [index, pair] of pairs.entries()) {
        qa.push({...pair, section: section.number, title: section.title});
        for (const other of result.paraphrases[index] ?? []) {
          const question = clean(other);
          if (question && question !== pair.question) qa.push({question, answer: pair.answer, section: section.number, title: section.title, paraphrase: true});
        }
      }
    }
    const allText = passages.map(passage => passage.text).join('\n');
    const hotwords = new Set([...codes(allText), ...overview.hotwords.map(clean).filter(term => term && allText.includes(term))]);
    return {purpose: `${clean(overview.purpose).replace(/[。.]$/, '')}（${script.sections.map(section => section.title).join('、')}）`,
      offer: scriptOffer(shortOffer(overview.offer, record.name), script.sections.map(section => section.title)),
      instructions: clean(overview.instructions), qa, passages, hotwords: [...hotwords],
      sections: script.sections.map(section => ({number: section.number, title: section.title}))};
  }

  const sourceKey = record => createHash('sha256')
    .update(JSON.stringify([writerVersion, model, embedModel, record.files, record.attachments ?? []])).digest('hex');

  async function read(id) {
    if (loaded.has(id)) return loaded.get(id);
    await migrated;
    try {
      const saved = JSON.parse(await fs.readFile(path.join(sopDir, `${id}.json`), 'utf8'));
      loaded.set(id, saved);
      return saved;
    } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
  }

  // Write (or reuse) the SOP for an uploaded file and index it.
  function build(id, {force = false} = {}) {
    if (writing.has(id)) return writing.get(id);
    const job = (async () => {
      const record = await scenarios.get(id);
      const kind = sopKind(record);
      if (!kind) throw fail('Only CSV tables and HTML call scripts become SOPs');
      const key = sourceKey(record);
      const saved = await read(id);
      if (saved?.key === key && !force) return saved;
      const started = Date.now();
      const written = kind === 'table' ? await writeTable(record) : await writeScript(record);
      const entries = [
        ...written.qa.map((item, index) => ({id: `qa-${index + 1}`, type: 'qa', text: `Q：${item.question}\nA：${item.answer}`,
          ...(item.row ? {row: item.row} : {}), ...(item.section !== undefined ? {section: item.section} : {})})),
        ...written.passages.flatMap(passage => chunks(passage.text).map((text, part) =>
          ({...passage, id: part ? `${passage.id}-${part + 1}` : passage.id, text, type: 'source'}))),
      ];
      const vectors = await embed(entries.map(entry => entry.text));
      const sop = {
        id, key, name: record.name, kind, file: record.files[0].name, model, embedModel, writtenAt: new Date().toISOString(),
        purpose: written.purpose, offer: written.offer, instructions: written.instructions, hotwords: written.hotwords,
        ...(written.templates ? {templates: written.templates} : {}), ...(written.sections ? {sections: written.sections} : {}),
        qa: written.qa, entries: entries.map((entry, index) => ({...entry, vector: vectors[index]})),
      };
      await fs.mkdir(sopDir, {recursive: true});
      const target = path.join(sopDir, `${id}.json`), temp = `${target}.${process.pid}.tmp`;
      await fs.writeFile(temp, JSON.stringify(sop));
      await fs.rename(temp, target);
      loaded.set(id, sop);
      log(`[sops] Wrote ${record.name}: ${written.qa.length} Q/A, ${written.passages.length} passages, ` +
        `${written.hotwords.length} hotwords in ${Math.round((Date.now() - started) / 1000)} s`);
      await syncHotwords();
      return sop;
    })().finally(() => writing.delete(id));
    writing.set(id, job);
    return job;
  }
  const summary = sop => ({
    id: sop.id, name: sop.name, kind: sop.kind, file: sop.file, purpose: sop.purpose, offer: sop.offer,
    collection: sopCollection(sop.id), embedModel: sop.embedModel,
    instructions: sop.instructions, qaCount: sop.qa.length, qaSample: sop.qa.slice(0, 12),
    hotwordCount: sop.hotwords.length, ...(sop.sections ? {sections: sop.sections} : {}),
    ...(sop.templates ? {templates: sop.templates} : {}), writtenAt: sop.writtenAt, model: sop.model,
  });

  async function index(id, options) { return summary(await build(id, options)); }

  // What the Embed skill loads into Qdrant: every Q/A pair and source passage.
  async function documents(id) {
    const sop = await read(id) ?? await build(id);
    return {sopId: id, collection: sopCollection(id), writtenAt: sop.writtenAt,
      dimensions: sop.entries[0]?.vector?.length ?? 1024, documents: sop.entries.map(entry => ({
      content: entry.text, metadata: {sop: sop.name, type: entry.type,
        ...(entry.row !== undefined ? {row: entry.row} : {}), ...(entry.section !== undefined ? {section: entry.section} : {})},
    }))};
  }

  // The search skill: exact matches first (a name, a code, a number the
  // caller said), then meaning.
  async function lookup({sopId, query, k = 5}) {
    if (typeof sopId !== 'string' || typeof query !== 'string' || !query.trim()) throw fail('sopId and query are required');
    const sop = await read(sopId) ?? await build(sopId);
    const [vector] = await embed([queryText(query)]);
    const wanted = norm(query);
    const scored = sop.entries.map(entry => {
      let exact = 0;
      for (const value of Object.values(entry.fields ?? {})) {
        const field = norm(value);
        if (field.length >= 2 && (wanted.includes(field) || (wanted.length >= 2 && field.includes(wanted)))) exact += field.length >= 3 ? 1 : 0.5;
      }
      return {entry, score: cosine(vector, entry.vector) + exact};
    }).sort((a, b) => b.score - a.score);
    // One result per source row or section: its Q/A and its passage repeat each other.
    const seen = new Set(), results = [];
    for (const {entry, score} of scored) {
      const origin = entry.row !== undefined ? `row-${entry.row}` : entry.section !== undefined ? `section-${entry.section}` : entry.id;
      if (seen.has(origin)) continue;
      seen.add(origin);
      const source = entry.type === 'qa' && sop.entries.find(item => item.type === 'source' &&
        (entry.row !== undefined ? item.row === entry.row : item.section === entry.section));
      results.push({score: Math.round(score * 1000) / 1000, text: entry.text,
        ...(source ? {source: source.text.slice(0, 1500)} : {}), ...((entry.fields ?? source?.fields) ? {fields: entry.fields ?? source.fields} : {})});
      if (results.length >= Math.min(10, Math.max(1, k))) break;
    }
    return {sopId, name: sop.name, results};
  }

  // Routing evidence: each SOP's best RAG match for the caller's words.
  async function rank({text}) {
    if (typeof text !== 'string' || !text.trim()) return {ranking: []};
    const ranking = [];
    for (const item of await list()) {
      if (!item.ready) continue;
      const {results} = await lookup({sopId: item.id, query: text, k: 1});
      if (results[0]) ranking.push({id: item.id, score: results[0].score, match: results[0].text.replace(/\s+/g, ' ').slice(0, 80)});
    }
    return {ranking: ranking.sort((a, b) => b.score - a.score)};
  }

  async function list() {
    const described = [];
    for (const item of (await scenarios.list()).filter(listedSop)) {
      const record = await scenarios.get(item.id).catch(() => undefined);
      if (!record || !sopKind(record)) continue;
      const sop = await read(item.id);
      described.push({id: item.id, name: item.name, kind: sopKind(record), workflowId: record.resources?.workflowId,
        ready: !!sop, ...(sop ? summary(sop) : {purpose: '', instructions: ''})});
    }
    return described;
  }

  // hotwords.csv holds one context cell. Generated terms are one line that is
  // replaced on every change; the user's own text is kept.
  async function syncHotwords() {
    if (!hotwordsFile) return;
    await migrated;
    const terms = new Set();
    for (const item of (await scenarios.list()).filter(listedSop))
      for (const term of (await read(item.id))?.hotwords ?? []) terms.add(term);
    let previous = '';
    try { previous = JSON.parse(await fs.readFile(managedFile, 'utf8')).line ?? ''; } catch { /* first run */ }
    let context = '';
    try { context = readContext(await fs.readFile(hotwordsFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const own = previous && context.includes(previous) ? context.replace(previous, '').replace(/\n+$/, '') : context;
    const line = [...terms].join('，');
    const next = [own.trim(), line].filter(Boolean).join('\n');
    if (next !== context) {
      // Rewrite in place: the file is bind-mounted, so a rename would detach it.
      const handle = await fs.open(hotwordsFile, 'r+').catch(error => error.code === 'ENOENT' ? fs.open(hotwordsFile, 'w') : Promise.reject(error));
      try { await handle.truncate(0); await handle.write(writeContext(next), 0); } finally { await handle.close(); }
    }
    await fs.writeFile(managedFile, JSON.stringify({line, updatedAt: new Date().toISOString()}));
    log(`[sops] hotwords.csv: ${terms.size} SOP terms`);
  }

  async function removed(id) {
    await migrated;
    loaded.delete(id);
    await fs.rm(path.join(sopDir, `${id}.json`), {force: true});
    await qdrant(`/collections/${sopCollection(id)}`, 'DELETE').catch(error => log(`[sops] ${error.message}`));
    await syncHotwords().catch(error => log(`[sops] Hotword update failed: ${error.message}`));
  }

  // Which SOP a call is in, the SOPs it has used, and the last reply.
  const session = sessionId => {
    const value = sessions.get(sessionId);
    return value && Date.now() - value.at < 2 * 3600_000 ? value : undefined;
  };
  async function context({sessionId}) {
    const sops = (await list()).map(({id, name, kind, purpose, offer, workflowId, ready}) => ({id, name, kind, purpose, offer, workflowId, ready}));
    return {sops, active: session(sessionId) ?? null};
  }
  function remember({sessionId, sopId, reply}) {
    if (typeof sessionId !== 'string' || !sessionId) throw fail('sessionId is required');
    if (!sopId) { sessions.delete(sessionId); return {sessionId, cleared: true}; }
    const visited = [...new Set([...(session(sessionId)?.visited ?? []), sopId])];
    const value = {sopId, reply: String(reply ?? '').slice(0, 500), visited, at: Date.now()};
    sessions.set(sessionId, value);
    if (sessions.size > 2000) sessions.delete(sessions.keys().next().value);
    return {sessionId, ...value};
  }

  return {index, build, read: async id => { const sop = await read(id); return sop && summary(sop); },
    documents, lookup, rank, list, syncHotwords, removed, context, remember};
}

export function readContext(csv) {
  const match = csv.replace(/^﻿/, '').match(/^(?:context|hotwords)\r?\n([\s\S]*?)\r?\n?$/);
  if (!match) return '';
  const value = match[1];
  return value.startsWith('"') ? value.slice(1, -1).replace(/""/g, '"') : value;
}
export const writeContext = context => `context\n"${context.replace(/"/g, '""')}"\n`;
