import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {createSipScenarioCalls} from './sip-scenario-calls.mjs';

const sharedModule = await readFile(new URL('../../../../webui/native/src/lib/scenario-simulation.ts', import.meta.url), 'utf8');
const simulation = await import('data:text/javascript;base64,' +
  Buffer.from(stripTypeScriptTypes(sharedModule, {mode: 'strip'})).toString('base64'));
const oldHtml = {id: 'old-html', simulation: true, files: [{name: 'old.htm'}]};
const latestHtml = {id: 'latest-html', simulation: true, files: [{name: 'latest.HTML'}]};
const customHtml = {id: 'custom-html', simulation: true, files: [{name: 'returns.html'}],
  opening: {language: 'en', prompts: ['Welcome. Which department are you calling?', 'How can we help?']}};
const lookups = [];
const reports = [];
const completions = [];

const calls = createSipScenarioCalls({
  simulation,
  knowledgeUrl: 'http://knowledge:8085/',
  async fetchImpl(url, options) {
    if (url.endsWith('/scenarios')) return Response.json({scenarios: [
      customHtml, oldHtml, latestHtml, {id: 'newest-word', simulation: true, files: [{name: 'latest.docx'}]},
    ]});
    assert.equal(url, 'http://knowledge:8085/ivr-simulation');
    const body = JSON.parse(options.body);
    lookups.push(body);
    if (body.id === customHtml.id) {
      if (!body.number) return Response.json({scenario: {number: 2, custom: true, retrieval: true}});
      return Response.json({answer: body.previous ? 'I can help with that return.' : 'What is your order number?'});
    }
    if (body.number === 4) return Response.json({answer: '目前缺貨。'});
    const scenarios = {
      '查庫存': {number: 4, retrieval: true},
      '維修報告': {number: 3},
      'Dispatch': {number: 1, steps: 'Ask about dispatch.'},
    };
    return Response.json({scenario: scenarios[body.text] ?? null});
  },
});

function turn(sessionId, text) {
  return calls.turn({
    sessionId, text, model: 'sip-test-model',
    async report(input, onWorkOrderSaved) {
      reports.push(input);
      if (input.text === '確認') {
        onWorkOrderSaved('test-order');
        return '完成。';
      }
      return '請確認。';
    },
    async complete(prompt, messages) {
      completions.push({prompt, messages});
      return 'Dispatch reply.';
    },
  });
}

assert.equal(await calls.start('disabled', ''), '');
assert.equal(await turn('disabled', '1'), undefined);
assert.equal(await calls.start('missing', 'not-uploaded'), '');
assert.equal(await calls.start('default'), simulation.languagePrompt);
assert.equal(await turn('default', '?'), simulation.languagePrompt);
assert.match(await turn('default', '1'), /電話持有人/);
assert.match(await turn('default', '測試姓名'), /員工編號/);
assert.match(await turn('default', '9'), /員工編號/);
assert.match(await turn('default', '941'), /直屬主管/);
assert.match(await turn('default', '測試主管'), /要回報什麼/);
assert.equal(lookups.length, 0);
assert.match(await turn('default', '工單回報'), /例行保養/);
assert.equal(await turn('default', '維修報告'), '請確認。');
assert.deepEqual(reports[0].scenarioReport, {number: 3, language: 'zh'});
assert.equal(reports[0].model, 'sip-test-model');
assert.deepEqual(reports[0].messages.filter(message => message.role === 'user').map(message => message.content),
  ['工單回報', '維修報告']);
assert.deepEqual(lookups, [{id: latestHtml.id, text: '工單回報'}, {id: latestHtml.id, text: '維修報告'}]);
assert.equal(await turn('default', '確認'), '完成。');
assert.equal(reports[0].sessionId, reports[1].sessionId);
assert.equal(await turn('default', '確認'), '工單 test-order 已儲存。');
assert.equal(reports.length, 2);

assert.equal(await calls.start('inventory', oldHtml.id), simulation.languagePrompt);
for (const input of ['1', '姓名', '941', '主管']) await turn('inventory', input);
assert.equal(await turn('inventory', '查庫存'), '目前缺貨。');
assert.equal(await turn('inventory', '要等多久'), '目前缺貨。');
assert.deepEqual(lookups.slice(-3), [
  {id: oldHtml.id, text: '查庫存'},
  {id: oldHtml.id, number: 4, language: 'zh', text: '查庫存', previous: ''},
  {id: oldHtml.id, number: 4, language: 'zh', text: '要等多久', previous: '查庫存'},
]);

assert.equal(await calls.start('dispatch', latestHtml.id), simulation.languagePrompt);
assert.match(await turn('dispatch', '2'), /owns this phone/);
for (const input of ['English caller', '941', 'Supervisor']) await turn('dispatch', input);
assert.equal(await turn('dispatch', 'Dispatch'), 'Dispatch reply.');
assert.match(completions[0].prompt, /English.*Ask about dispatch\./s);
assert.deepEqual(completions[0].messages, [{role: 'user', content: 'Dispatch'}]);
assert.equal(await calls.start('returns', customHtml.id), customHtml.opening.prompts[0]);
const lookupsBefore = lookups.length;
assert.equal(await turn('returns', 'Service desk'), customHtml.opening.prompts[1]);
assert.equal(lookups.length, lookupsBefore);
assert.equal(await turn('returns', 'I need to send a part back'), 'What is your order number?');
assert.equal(await turn('returns', 'LIVE-42'), 'I can help with that return.');
assert.deepEqual(lookups.slice(lookupsBefore).map(({number, language}) => [number, language]),
  [[undefined,'en'],[2,'en'],[2,'en']]);
assert.deepEqual(lookups.at(-1).history, [
  {role:'user',content:'I need to send a part back'},
  {role:'assistant',content:'What is your order number?'},
]);
assert.equal(reports.length, 2, 'custom scenario 2 never enters the legacy work-order flow');
console.log('PASS SIP scenario selection, automatic opening, report, retrieval, and local dialogue');
