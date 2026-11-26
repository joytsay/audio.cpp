// Offline checks for the scenario IVR engine and the knowledge server.
// The model is a fake that answers by response schema, so no GPU is needed.
// Live checks against the real model: node replay-scenarios.mjs
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ivr-knowledge-test-'));
process.env.KNOWLEDGE_DATA_ROOT = root;
process.env.IVR_HOTWORDS_FILE = path.join(root, 'hotwords.csv');
const {createKnowledgeStore, createKnowledgeServer} = await import('./server.mjs');
const {loadScript, chooseLanguage, describeWorkOrders, dropExampleSentences, exampleLeaks, explicitSection, isFiller, namedSection, spokenDigits} = await import('./ivr-engine.mjs');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const html = `<html><body>
<p>AI語音</p>
<p>AI：請先選語言：中文 1、英文2</p>
<p>AI：請進行身分驗證：請問此電話持有人名字是?</p><p>維修人員：王怡文</p>
<p>AI：請說出您員工編號後3碼?</p><p>維修人員：847</p>
<p>AI：請問您要回報什麼內容?</p><p>維修人員：工單回報</p>
<p>情境 1：Call Out系統主動通知派工</p>
<p>AI：2026年8月5日下午14:00，陳大雄，台積電F12P8變頻器例行性維修保養，請記得前往。</p>
<p>情境 2：工單回報</p>
<p>維修人員：我要回報工單，F15P1H4K-GEX-EF-03 更換強排FAN 2個。F15P1H4K-GEX-EF-04 更換強排FAN 4個。</p>
<p>AI：F15P1H4K-GEX-EF-03 更換強排FAN 2個。F15P1H4K-GEX-EF-04 更換強排FAN 4個。以上是否正確。</p>
<p>維修人員：正確，起機測試正常。</p>
<p>AI：好的，工單已輸入完成，謝謝。</p>
<p>情境 3：零件庫存查詢</p>
<p>維修人員：我想查詢風扇SKR9FAN2F23的庫存。</p>
<p>AI：風扇SKR9FAN2F23，新竹實際可用量為7個。</p>
<p>參考圖表</p><img src="table.png">
<p>情境 4：Call out客戶滿意度調查</p>
<p>AI：請問接洽您的業務是何小瑞嗎?</p><p>客戶：是的</p>
<p>AI：有關服務態度請問給幾分?</p><p>客戶：5</p>
<p>AI：好的，服務態度5分，謝謝您的回饋。</p>
</body></html>`;

// ── Fake model ──────────────────────────────────────────────────────────────
const calls = [];
let scenarioReply = () => ({line: 1, reply: '', switch: false});
const fakeFetch = async (url, init) => {
  if (String(url).endsWith('/embeddings')) {
    // Character-bag vectors: texts sharing characters are close.
    const vector = text => Array.from({length: 64}, (_, i) => [...text].filter(c => c.codePointAt(0) % 64 === i).length + 0.01);
    const input = JSON.parse(init.body).input;
    return new Response(JSON.stringify({data: input.map((text, index) => ({index, embedding: vector(text)}))}), {status: 200});
  }
  if (!String(url).includes('/chat/completions')) throw new Error(`Unexpected fetch ${url}`);
  const body = JSON.parse(init.body);
  const properties = body.response_format?.json_schema?.schema?.properties ?? {};
  const last = body.messages.at(-1);
  const text = typeof last.content === 'string' ? last.content : '';
  calls.push({kind: Object.keys(properties).join(',') || 'text', text});
  let content;
  if (properties.option) content = {option: /最新|最舊|最早|上一張|它的/.test(text) ? 'lookup' : /庫存/.test(text) ? '3' : /回報/.test(text) ? '2' : 'none'};
  else if (properties.which) content = {which: /最舊|最早/.test(text) ? 'oldest' : /GB\d+/.test(text) ? 'number' : /它/.test(text) ? 'same' : 'latest', number: text.match(/GB\d+/)?.[0] ?? '',
    field: /維修內容/.test(text) ? 'work' : /設備/.test(text) ? 'equipment' : 'summary'};
  else if (properties.zh) content = {zh: ['好的，我幫您查一下庫存，請稍等。', '嗯，我看一下系統，稍等喔', '了解，我查查看，請稍候。', '好的，我查一下，請稍等。'],
    en: ['Sure, let me check the stock for you.', 'Okay, one moment while I look.', 'Got it, checking now.', 'Sure, let me check the stock for you.']};
  else if (properties.line) content = scenarioReply(body.messages);
  else if (properties.date) content = {date: '2026-06-02', reference: '', title: '測試工單', equipment: 'F8A-AHU-07', details: '更換強排FAN 3個', notes: '', test_result: '正常'};
  else if (properties.scenarios) content = {scenarios: [{title: '密碼重設', turns: [{role: 'USER', text: '我忘記密碼了'},
    {role: 'AI', text: '请到 IT-HELP01 网站按「忘记密码」，重设连结十分钟内有效。'}]}]};
  else if (properties.purpose && properties.instructions) content = {purpose: '查詢同仁分機', offer: '分機查詢', instructions: '依表格回答。', hotwords: []};
  else if (properties.paraphrases) content = {paraphrases: []};
  else if (properties.hotwords) content = {hotwords: ['IT-HELP01', '不在文件裡']};
  else if (properties.items && /database column/.test(body.messages[0].content)) content = {items: ['language', 'phone_holder_name', 'employee_id_last3', 'Service Request']};
  else if (properties.items) content = {items: JSON.parse(text).map(item => `EN:${item}`)};
  else if (properties.lines) content = {lines: JSON.parse(text).map(item => item.replace('王怡文', '李小華').replace('F15P1H4K', 'X'))};
  else content = '| 料件 | 實際可用量 |\n| SKR9FAN2F23 | 7 |';
  return new Response(JSON.stringify({choices: [{message: {content: typeof content === 'string' ? content : JSON.stringify(content)}}]}),
    {status: 200, headers: {'Content-Type': 'application/json'}});
};

let failures = 0;
async function test(name, run) {
  try { await run(); console.log(`ok - ${name}`); }
  catch (error) { failures++; console.error(`not ok - ${name}\n${error.stack}`); }
}

// ── Pure helpers ────────────────────────────────────────────────────────────
await test('language choice accepts digits, Chinese numerals and words', () => {
  for (const text of ['1', '一', '中文', '我要中文', 'one。']) assert.equal(chooseLanguage(text), 'zh', text);
  for (const text of ['2', '二', '英文', 'English', 'two']) assert.equal(chooseLanguage(text), 'en', text);
  assert.equal(chooseLanguage('嗯'), null);
});
await test('spoken digits normalize Chinese and English numerals', () => {
  assert.equal(spokenDigits('八四七'), '847');
  assert.equal(spokenDigits('eight four seven'), '847');
  assert.equal(spokenDigits('847。'), '847');
});
await test('bare numbers select a section only at the menu', () => {
  const sections = [{number: 3, title: '零件庫存查詢'}, {number: 5, title: '維修 SOP 查詢'}];
  assert.equal(explicitSection('5', sections)?.number, 5);
  assert.equal(explicitSection('5', sections, {bare: false}), undefined);
  assert.equal(explicitSection('我要情境三', sections, {bare: false})?.number, 3);
  assert.equal(namedSection('零件庫存查詢。', sections)?.number, 3);
});
await test('fillers never select an option', () => {
  for (const text of ['嗯嗯', '呃那個', '嗯，就是…', 'uh', '好']) assert.equal(isFiller(text), true, text);
  for (const text of ['最新', '我要回報工單', '查詢庫存', '3']) assert.equal(isFiller(text), false, text);
});
await test('work-order answers are built from the rows, never invented', () => {
  const rows = [
    {order_id: 'GV-AAA', reference_number: 'GB201418567', test_result: '正常'},
    {order_id: 'GV-BBB', dispatch_date: '2026-06-02 14:00', title: '台積電F15P1/2_ME VFD備品與維修', maintenance_items: 'F15P1H4K-GEX-EF-03 更換強排FAN 2個'},
  ];
  assert.equal(describeWorkOrders(rows, {which: 'latest'}), '最新的工單是 GB201418567。');
  assert.equal(describeWorkOrders(rows, {which: 'oldest'}), '最舊的工單是 GV-BBB，2026-06-02 14:00 派工。台積電F15P1/2_ME VFD備品與維修。');
  assert.equal(describeWorkOrders(rows, {which: 'same', field: 'work'}, 'zh', 'GV-BBB'), '工單 GV-BBB 的維修內容：F15P1H4K-GEX-EF-03 更換強排FAN 2個。');
  assert.equal(describeWorkOrders(rows, {which: 'same', field: 'equipment'}, 'zh', 'GV-BBB'), '工單 GV-BBB 沒有記錄設備。');
  assert.equal(describeWorkOrders(rows, {which: 'number', number: 'gb 201418567', field: 'test'}), '工單 GB201418567 的起機測試：正常。');
  assert.equal(describeWorkOrders(rows, {which: 'number', number: 'X9'}), '沒有找到工單 X9。');
  assert.equal(describeWorkOrders(rows, {which: 'all'}), '目前共有 2 張工單。最新的是 GB201418567、GV-BBB。');
  assert.equal(describeWorkOrders([], {which: 'latest'}, 'en'), 'There are no saved work orders yet.');
  assert.equal(describeWorkOrders(rows, {which: 'latest'}, 'en'), 'The latest saved work order is GB201418567.');
});
await test('example data leaks are detected and dropped by sentence', () => {
  const section = {turns: [{role: 'caller', text: 'F15P1H4K-GEX-EF-03 更換。F15P1H4K-GEX-EF-04 更換。'}]};
  const history = [{role: 'user', content: 'F15P1H4K-GEX-EF-03 更換強排FAN 2個'}];
  const reply = 'F15P1H4K-GEX-EF-03 更換2個。F15P1H4K-GEX-EF-04 更換4個。以上是否正確。';
  const leaked = exampleLeaks(section, history, reply);
  assert.deepEqual(leaked, ['F15P1H4K-GEX-EF-04']);
  assert.equal(dropExampleSentences(reply, leaked), 'F15P1H4K-GEX-EF-03 更換2個。以上是否正確。');
  assert.equal(dropExampleSentences('Version 1.5 is ready. OK?', []), 'Version 1.5 is ready. OK?');
});

// ── Engine through the knowledge store ──────────────────────────────────────
const store = createKnowledgeStore({fetchImpl: fakeFetch});
const encode = (name, bytes) => ({name, data: Buffer.from(bytes).toString('base64')});
const added = await store.addScenario({fileMode: true, files: [encode('情境模擬_test.html', html)], attachments: [encode('table.png', png)]});
const scenarioId = added.scenario.id;
await test('the scenario lists the caller side of the script for the demo mock call', () => {
  const {mockCall} = added.scenario;
  assert.deepEqual(mockCall.opening, ['1', '王怡文', '847'], 'language digit from the prompt, then the answers without the menu answer');
  assert.deepEqual(mockCall.sections[0], {number: 1, title: 'Call Out系統主動通知派工', outbound: true, lines: ['Call Out系統主動通知派工']});
  assert.deepEqual(mockCall.sections[1].lines, ['我要回報工單，F15P1H4K-GEX-EF-03 更換強排FAN 2個。F15P1H4K-GEX-EF-04 更換強排FAN 4個。', '正確，起機測試正常。']);
});
await store.saveScenarioImport(scenarioId, {tables: [], ready: true});
const listed = (await store.listScenarios()).find(item => item.id === scenarioId);

await test('an uploaded HTML call script is listed as a simulation', () => {
  assert.equal(listed.simulation, true);
});

const say = (sessionId, text) => store.ivr({sessionId, text});
await test('opening is spoken verbatim and validates language and digits', async () => {
  const start = await store.ivr({sessionId: 'open-1', start: true, scenarioId});
  assert.equal(start.reply, '請先選語言：中文 1、英文2');
  assert.equal(start.awaitingLanguage, true);
  assert.equal((await say('open-1', '嗯')).reply, '請先選語言：中文 1、英文2');
  assert.equal((await say('open-1', '1')).reply, '請進行身分驗證：請問此電話持有人名字是?');
  assert.equal((await say('open-1', '王怡文')).reply, '請說出您員工編號後3碼?');
  assert.equal((await say('open-1', '84')).reply, '請說出您員工編號後3碼?');
  const menu = await say('open-1', '八四七');
  assert.equal(menu.reply, '請問您要回報什麼內容?');
  assert.equal(menu.awaitingLanguage, false);
});

await test('the call session row has one column per opening answer and the whole conversation', async () => {
  const {rows, columns} = await store.ivr({sessionId: 'open-1', call: true});
  const [row] = rows;
  assert.deepEqual(columns, ['session_id', 'channel', 'date', 'time', 'language', 'phone_holder_name', 'employee_id_last3', 'opening_4',
    'opening', 'conversation', 'conversation_duration'], 'an invalid generated name falls back to opening_N');
  assert.equal(row.session_id, 'open-1');
  assert.equal(row.channel, 'other');
  assert.match(row.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(row.time, /^\d{2}:\d{2}:\d{2}$/);
  assert.equal(row.language, '1');
  assert.equal(row.phone_holder_name, '王怡文');
  assert.equal(row.employee_id_last3, '八四七', 'only the accepted answer is kept');
  assert.equal(row.opening_4, '');
  assert.deepEqual(JSON.parse(row.opening), {'請先選語言：中文 1、英文2': '1', '請進行身分驗證：請問此電話持有人名字是?': '王怡文',
    '請說出您員工編號後3碼?': '八四七', '請問您要回報什麼內容?': ''});
  assert.equal(row.conversation.split('\n').length, 11);
  assert.match(row.conversation, /^AI：請先選語言/);
  assert.match(row.conversation, /來電者：84\n/);
  assert.match(row.conversation_duration, /^\d{2}:\d{2}:\d{2}$/);
  assert.deepEqual(await store.ivr({sessionId: 'never-started', call: true}), {rows: []});
});

async function openCall(sessionId) {
  await store.ivr({sessionId, start: true, scenarioId});
  for (const text of ['1', '王怡文', '847']) await say(sessionId, text);
}

await test('outbound section speaks its own first line and completes', async () => {
  await openCall('out-1');
  const result = await say('out-1', 'Call Out系統主動通知派工');
  assert.equal(result.reply, '2026年8月5日下午14:00，陳大雄，台積電F12P8變頻器例行性維修保養，請記得前往。');
  assert.equal(result.scenario.number, 1);
  assert.equal(result.status, 'done');
});

await test('a finished scenario re-routes the next request (no stuck session)', async () => {
  scenarioReply = () => ({line: 1, reply: 'F8A-AHU-07 更換強排FAN 3個。以上是否正確。', switch: false});
  const report = await say('out-1', '我要回報工單，F8A-AHU-07 更換強排FAN 3個。');
  assert.equal(report.scenario.number, 2);
  assert.equal(report.status, 'continue');
});

await test('work order: reply first, record extracted on request with a stable ID', async () => {
  scenarioReply = () => ({line: 2, reply: '好的，工單已輸入完成，謝謝。', switch: false});
  const done = await say('out-1', '正確，起機測試正常。');
  assert.equal(done.status, 'done');
  assert.equal(done.work_order.pending, true);
  assert.ok(!calls.some(call => call.kind.startsWith('date')), 'record must not be extracted before replying');
  const {records} = await store.ivr({sessionId: 'out-1', records: true});
  assert.equal(records.length, 1);
  assert.equal(records[0].order_id, done.work_order.order_id);
  assert.equal(records[0].equipment_number, 'F8A-AHU-07');
  const results = JSON.parse(records[0].results);
  assert.equal(results.scenario, 2);
  assert.deepEqual(results.dialogue.map(turn => turn.role), ['user', 'assistant', 'user', 'assistant']);
  assert.deepEqual((await store.ivr({sessionId: 'out-1', records: true})).records, []);
});

await test('example IDs the caller never said are hidden from the report script', async () => {
  const prompt = calls.length;
  scenarioReply = messages => {
    assert.ok(!messages[0].content.includes('F15P1H4K-GEX-EF-04'), 'unsaid example ID reached the model');
    return {line: 1, reply: 'F15P1H4K-GEX-EF-03 更換強排FAN 2個。以上是否正確。', switch: false};
  };
  await openCall('mask-1');
  await say('mask-1', '我要回報工單，F15P1H4K-GEX-EF-03 更換強排FAN 2個。');
  assert.ok(calls.length > prompt);
});

await test('lookup scenario is grounded in the transcribed figure', async () => {
  scenarioReply = messages => {
    assert.match(messages[0].content, /REFERENCE FIGURE 1\n\| 料件 \| 實際可用量 \|/);
    return {line: 1, reply: '風扇SKR9FAN2F23，新竹實際可用量為7個。', switch: false};
  };
  await openCall('stock-1');
  const result = await say('stock-1', '我想查詢風扇的庫存');
  assert.equal(result.scenario.number, 3);
  assert.equal(result.status, 'done');
});

await test('inside a scenario a bare number is an answer, not a switch', async () => {
  let turn = 0;
  scenarioReply = () => [{line: 2, reply: '有關服務態度請問給幾分?', switch: false},
    {line: 3, reply: '好的，服務態度5分，謝謝您的回饋。', switch: false}][turn++];
  await openCall('survey-1');
  const first = await say('survey-1', 'Call out客戶滿意度調查');
  assert.equal(first.reply, '請問接洽您的業務是何小瑞嗎?');
  assert.equal((await say('survey-1', '是的')).scenario.number, 4);
  const score = await say('survey-1', '3');
  assert.equal(score.scenario.number, 4);
  assert.equal(score.status, 'done');
});

await test('unclear requests return to the menu, then list what is available', async () => {
  await openCall('menu-1');
  const result = await say('menu-1', '六八六一那個。或者。');
  assert.equal(result.stage, 'menu');
  assert.equal(result.reply, '請問您要回報什麼內容?');
  const again = await say('menu-1', '嗯嗯');
  assert.equal(again.reply, '請問您要回報什麼內容?可以說：工單回報、零件庫存查詢，或查詢已儲存的工單。');
});

await test('questions about saved work orders are answered from the Data Table rows', async () => {
  await openCall('lookup-1');
  const rows = [{order_id: 'GV-AAA', reference_number: 'GB201418567', dispatch_date: '', title: '', saved_at: '2026-11-24 10:28'},
    {order_id: 'GV-BBB', reference_number: '', dispatch_date: '2026-06-02', title: '台積電', saved_at: '2026-11-24 10:17'}];
  const result = await store.ivr({sessionId: 'lookup-1', text: '我想要查詢最新的工單。', work_orders: rows});
  assert.equal(result.stage, 'lookup');
  assert.equal(result.reply, '最新的工單是 GB201418567。');
  const oldest = await store.ivr({sessionId: 'lookup-1', text: '那最舊的呢？', work_orders: rows});
  assert.equal(oldest.reply, '最舊的工單是 GV-BBB，2026-06-02 派工。台積電。');
  const work = await store.ivr({sessionId: 'lookup-1', text: '那它的維修內容呢？', work_orders: [...rows.slice(0, 1), {...rows[1], maintenance_items: '更換FAN 2個'}]});
  assert.equal(work.reply, '工單 GV-BBB 的維修內容：更換FAN 2個。', 'a follow-up refers to the work order just answered');
  const none = await store.ivr({sessionId: 'lookup-1', text: '最舊的工單呢？', work_orders: []});
  assert.equal(none.reply, '目前沒有已儲存的工單。');
  // A finished report is followed by a lookup without getting stuck.
  scenarioReply = () => ({line: 2, reply: '好的，工單已輸入完成，謝謝。', switch: false});
  await say('lookup-1', '我要回報工單，F8A-AHU-07 更換強排FAN 3個。');
  assert.equal((await store.ivr({sessionId: 'lookup-1', text: '我想要查詢最新的工單。', work_orders: rows})).stage, 'lookup');
  await assert.rejects(store.ivr({sessionId: 'lookup-1', text: '最新', work_orders: 'x'}), /Invalid work_orders/);
});

await test('the intent request names the scenario and offers varied wait phrases, sharing the routing call', async () => {
  await openCall('intent-1');
  assert.deepEqual(await store.ivr({sessionId: 'intent-1', intent: true, text: '王怡文'}), {intent: 'menu', phrases: []}, 'an unclear request needs no notice');
  const routed = () => calls.filter(call => call.kind === 'option').length;
  const before = routed();
  const text = '我想查詢風扇SKR9FAN2F23的庫存。';
  const [peek, reply] = await Promise.all([store.ivr({sessionId: 'intent-1', intent: true, text}), say('intent-1', text)]);
  assert.equal(peek.intent, '3');
  assert.deepEqual(peek.phrases, ['好的，我幫您查一下庫存，請稍等。', '嗯，我看一下系統，稍等喔。', '了解，我查查看，請稍候。', '好的，我查一下，請稍等。'],
    'phrases end with punctuation and repeat none');
  assert.equal(reply.scenario.number, 3);
  assert.equal(routed() - before, 1, 'the turn reuses the routing the intent request started');
  const inside = await store.ivr({sessionId: 'intent-1', intent: true, text: '那另一個呢'});
  assert.equal(inside.intent, '3', 'inside a scenario the intent is the current one, with no model call');
  assert.equal(routed() - before, 1);
});

await test('a mock call varies names and numbers but keeps codes, choices and scales', async () => {
  const {varyNumbers, scoreScale} = await import('./mock-call.mjs');
  let seed = 1;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const line = '我要回報工單，2026年6月2日下午14:00 F15P1H4K-GEX-EF-03 更換強排FAN 2個，PF753 Fault Code：010，電容值：6460MF，SN：14778725';
  const varied = varyNumbers(line, {random});
  for (const kept of ['F15P1H4K-GEX-EF-03', 'PF753', 'Fault Code：010']) assert.ok(varied.includes(kept), kept);
  assert.match(varied, /^我要回報工單，20\d\d年([1-9]|1[0-2])月([1-9]|1\d|2[0-8])日下午1[2-7]:(00|15|30|45) /);
  assert.match(varied, /FAN \d個，.*電容值：\d{4}MF，SN：\d{8}$/);
  assert.notEqual(varied.match(/SN：(\d+)/)[1], '14778725');
  for (let i = 0; i < 20; i++) assert.match(varyNumbers('5', {scale: scoreScale('以1-5為評分'), random}), /^[1-4]$/);
  for (let i = 0; i < 30; i++) assert.match(varyNumbers('FAN 2個', {random}), /^FAN [1-9]個$/, 'a quantity never becomes 0');
  const result = await store.ivr({mock: true, scenarioId, sections: [1, 2]});
  assert.equal(result.opening[0], '1', 'the language choice is kept');
  assert.equal(result.opening[1], '李小華', 'names come from the model');
  assert.notEqual(result.opening[2], '847');
  assert.match(result.opening[2], /^\d{3}$/);
  assert.deepEqual(result.sections.map(section => section.number), [1, 2]);
  assert.equal(result.sections[0].lines[0], 'Call Out系統主動通知派工', 'an outbound title selects its 情境 unchanged');
  assert.ok(result.sections[1].lines[0].includes('F15P1H4K-GEX-EF-03'));
});

await test('English callers hear the translated opening', async () => {
  await store.ivr({sessionId: 'en-1', start: true, scenarioId});
  assert.equal((await say('en-1', '2')).reply, 'EN:請進行身分驗證：請問此電話持有人名字是?');
});

await test('sessions persist on disk across a service restart', async () => {
  await openCall('persist-1');
  const restarted = createKnowledgeStore({fetchImpl: fakeFetch});
  const result = await restarted.ivr({sessionId: 'persist-1', text: '六八六一'});
  assert.equal(result.stage, 'menu');
});

await test('HTTP /ivr validates input', async () => {
  const server = createKnowledgeServer(store).listen(0);
  try {
    const url = `http://127.0.0.1:${server.address().port}/ivr`;
    const bad = await fetch(url, {method: 'POST', body: JSON.stringify({sessionId: '../x', text: 'hi'})});
    assert.equal(bad.status, 400);
    const ok = await fetch(url, {method: 'POST', body: JSON.stringify({sessionId: 'http-1', start: true, scenarioId})});
    assert.equal((await ok.json()).reply, '請先選語言：中文 1、英文2');
  } finally { server.close(); }
});

// ── SOP drafts ──────────────────────────────────────────────────────────────
const drafted = async files => {
  let draft = await store.drafts.create({files});
  while (draft.status === 'writing') { await new Promise(resolve => setTimeout(resolve, 20)); draft = await store.drafts.get(draft.id); }
  assert.equal(draft.status, 'ready', draft.error);
  return {draft, page: (await store.drafts.file(draft.id, 'draft.html')).bytes.toString('utf8')};
};
const importBundle = async id => {
  const results = [];
  for (const document of (await store.drafts.bundle(id)).documents) {
    const {attachments, title, ...file} = document;
    const result = await store.addScenario({fileMode: true, files: [file], attachments, title});
    // As the n8n import does before an SOP is written.
    await store.saveScenarioImport(result.scenario.id, {tables: [], ready: true});
    results.push(result);
  }
  return results;
};

await test('a call script keeps its turns verbatim in English-structured parts', async () => {
  const {draft, page} = await drafted([encode('維修腳本.html', html.replace('table.png', 'images/table.png')), encode('table.png', png)]);
  for (const heading of ['AGENT PROMPT', 'HOTWORDS', 'OPENING', 'SCENARIOS', 'KNOWLEDGE BASE']) assert.match(page, new RegExp(`<h2>${heading}</h2>`));
  assert.match(page, /<p class="marker">CHOOSE SCENARIO<\/p>\n<p class="turn ai"><b>AI:<\/b> 請問您要回報什麼內容\?/);
  assert.match(page, /<b>USER:<\/b> 王怡文/);
  assert.match(page, /<h3>SCENARIO_02: 工單回報<\/h3>/);
  assert.match(page, /FIGURE: table\.png<\/p>\n<img src="files\/table\.png"/);
  assert.doesNotMatch(page, /情境 \d|維修人員：|參考圖表|選擇情境/);
  assert.deepEqual(draft.figures, ['table.png']);
  assert.match(page, /IT-HELP01|F15P1H4K-GEX-EF-03/, 'codes become hotwords');
  assert.doesNotMatch(page, /不在文件裡/, 'hotwords must appear in the document');
  const [result] = await importBundle(draft.id);
  const record = await store.readScenario(result.scenario.id);
  const script = await loadScript(record, path.join(root, 'scenarios', record.id));
  assert.deepEqual(script.sections.map(section => section.figures?.length ?? 0), [0, 0, 1, 0], 'the figure stays in its scenario');
  assert.equal(script.opening.length, 4);
  await store.removeScenario(result.scenario.id);
});

await test('a narrative document is written into scenarios, and the confirmed page runs as a call script', async () => {
  const markdown = '# IT 服務台\n\n忘記密碼時，請到 IT-HELP01 網站按「忘記密碼」。重設連結十分鐘內有效，逾時請重新申請。\n';
  const {draft, page} = await drafted([encode('IT服務台.md', markdown)]);
  assert.match(page, /<h3>SCENARIO_01: 密碼重設<\/h3>/);
  assert.match(page, /<pre>You are the phone voice assistant for &quot;IT服務台&quot;\.\n/);
  assert.match(page, /1\. OPENING: start every call with the OPENING\. Say its 5 AI lines in order/);
  assert.match(page, /2\. CHOOSE SCENARIO: after the opening/);
  assert.match(page, /Scenarios: 1\. 密碼重設\./);
  const {traditional} = await import('./sop-drafts.mjs');
  assert.equal(traditional('IT服務台 臺北 請说 查询零件库存 台风'), 'IT服務台 臺北 請說 查詢零件庫存 颱風', 'Traditional text is kept as written');
  assert.match(page, /<b>AI:<\/b> 請到 IT-HELP01 網站按「忘記密碼」，重設連結十分鐘內有效。/, 'Simplified Chinese from the LLM becomes Traditional');
  assert.match(page, /<b>USER:<\/b> 密碼重設<\/p>/, 'the default opening ends with the first scenario');
  assert.match(page, /FILE: <a href="files\/IT%E6%9C%8D%E5%8B%99%E5%8F%B0\.md">/);
  const [result] = await importBundle(draft.id);
  assert.equal(result.scenario.simulation, true);
  assert.equal(result.scenario.name, 'IT服務台.md', 'listed under the uploaded file name');
  assert.ok((await store.syncHotwords()).terms >= 1);
  assert.match(await fs.readFile(process.env.IVR_HOTWORDS_FILE, 'utf8'), /IT-HELP01/, 'the page hotwords reach hotwords.csv before the SOP is written');
  const record = await store.readScenario(result.scenario.id);
  assert.match(record.dataset.sop.prompt, /^You are the phone voice assistant for "IT服務台"\. Every call must follow this SOP in order:/);
  assert.ok(record.dataset.sop.hotwords.includes('IT-HELP01'));
  const sections = record.dataset.template.filter(section => section.number);
  assert.deepEqual(sections.map(section => [section.number, section.title]), [[1, '密碼重設']]);
  assert.deepEqual(sections[0].turns.map(turn => turn.role), ['caller', 'assistant']);
  const opening = record.dataset.template.find(section => !section.number);
  assert.equal(opening.turns.at(-2).text, '請問您要回報什麼內容?', 'no structure line is appended to a turn');
  assert.equal(opening.turns.at(-1).text, '密碼重設');
  await store.saveScenarioImport(result.scenario.id, {tables: [], ready: true});
  const call = await store.ivr({sessionId: 'draft-1', start: true, scenarioId: result.scenario.id});
  assert.equal(call.reply, '請先選語言：中文 1、英文2');
});

await test('a table alone gets a full page that links the table, and the page SOP reads its rows', async () => {
  const {draft, page} = await drafted([encode('分機表.csv', '姓名,分機\n王小明,1234\n陳大文,5678\n')]);
  assert.match(page, /<h3>SCENARIO_01: /);
  assert.match(page, /TABLE: <a href="files\/%E5%88%86%E6%A9%9F%E8%A1%A8\.csv">分機表\.csv<\/a> · 2 rows/);
  const scenarioCall = calls.findLast(call => call.kind === 'scenarios');
  assert.match(scenarioCall.text, /欄位：姓名、分機/);
  assert.match(scenarioCall.text, /王小明/);
  const bundle = await store.drafts.bundle(draft.id);
  assert.deepEqual(bundle.documents.map(document => [document.name, document.title, document.attachments.map(file => file.name)]),
    [['分機表.html', '分機表.csv', ['分機表.csv']]], 'one scenario: the page with its table');
  assert.equal(Buffer.from(bundle.documents[0].attachments[0].data, 'base64').toString(), '姓名,分機\n王小明,1234\n陳大文,5678\n');
  const results = await importBundle(draft.id);
  assert.equal(results.length, 1);
  assert.equal(results[0].scenario.name, '分機表.csv');
  const record = await store.readScenario(results[0].scenario.id);
  assert.deepEqual(record.dataset.sop.tables, ['分機表.csv']);
  const sop = await store.indexSop(record.id);
  assert.match(sop.instructions, /^You are the phone voice assistant for "分機表"\..*tables \(分機表\.csv\)/, 'the page prompt is the SOP instructions');
  const {results: found} = await store.lookup({sopId: record.id, query: '陳大文的分機是多少', k: 2});
  assert.match(found[0].text, /分機表\.csv：姓名：陳大文；分機：5678/, 'the linked table row is found');
});

await test('HTTP serves the draft page with a no-script policy and rejects bad names', async () => {
  const {draft} = await drafted([encode('IT2.md', '忘記密碼時，請到 IT-HELP01 網站按「忘記密碼」重設，連結十分鐘內有效。')]);
  const server = createKnowledgeServer(store).listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}/sop-drafts/${draft.id}`;
    const response = await fetch(`${base}/draft.html`);
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
    const original = await fetch(`${base}/files/IT2.md`);
    assert.equal(original.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal((await fetch(`${base}/files/..%2Fdraft.json`)).status, 400);
    assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/sop-drafts`, {method: 'POST', body: JSON.stringify({files: [encode('x.exe', 'x')]})})).status, 400);
  } finally { server.close(); }
});

await fs.rm(root, {recursive: true, force: true});
if (failures) { console.error(`${failures} test(s) failed`); process.exit(1); }
console.log('all knowledge tests passed');
