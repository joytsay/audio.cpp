import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runInNewContext} from 'node:vm';
import {buildSync} from 'esbuild';

const built = buildSync({entryPoints: [new URL('../src/lib/n8n-dialogue.ts', import.meta.url).pathname],
  bundle: true, platform: 'node', format: 'esm', write: false});
const {ivrDialogue, pickNotice} = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
const workflow = JSON.parse(fs.readFileSync(new URL('../../../examples/docker/agx-one-container/n8n/workflow.json', import.meta.url)));

const originalFetch = globalThis.fetch;
const requests = [];
let respond = () => Response.json({reply: '  請先選語言：中文 1、英文2  ', stage: 'opening', status: 'continue', language: 'zh', awaitingLanguage: true, scenario: null});
globalThis.fetch = async (url, init) => {
  requests.push({url: String(url), body: JSON.parse(init.body)});
  return respond(init, String(url));
};
try {
  // Start and turn requests carry only the call identity and caller text.
  const events = [];
  const start = await ivrDialogue({sessionId: 'web-1', start: true, scenarioId: 'a'.repeat(24)}, new AbortController().signal,
    {onWorkflow: state => events.push(state)});
  assert.equal(start.reply, '請先選語言：中文 1、英文2');
  assert.equal(start.awaitingLanguage, true);
  assert.deepEqual(requests.at(-1), {url: '/n8n/webhook/ivr-agent', body: {sessionId: 'web-1', start: true, scenarioId: 'a'.repeat(24)}});
  assert.deepEqual(events, ['started', 'completed']);

  // Turns carry no wait notice; the reply is returned as is.
  respond = () => Response.json({reply: '好的。', stage: 'scenario', status: 'done', language: 'zh', awaitingLanguage: false, scenario: {number: 4, title: '零件庫存查詢'}});
  const turn = await ivrDialogue({sessionId: 'web-1', text: '我想查詢庫存'}, new AbortController().signal, {workflowUrl: 'http://n8n.test/webhook/ivr-agent'});
  assert.equal(turn.scenario.number, 4);
  assert.equal(requests.at(-1).url, 'http://n8n.test/webhook/ivr-agent');

  // A slow turn asks what it is about and speaks a wait phrase after the delay;
  // the phrase is offered for speech synthesis as soon as it is known.
  let release;
  respond = (init, url) => url.endsWith('ivr-intent')
    ? Response.json({intent: '4', phrases: ['好的，我幫您查一下庫存，請稍等。']})
    : new Promise(resolve => { release = () => resolve(Response.json({reply: '好的。', stage: 'scenario', status: 'continue', language: 'zh', awaitingLanguage: false, scenario: {number: 4, title: '零件庫存查詢'}})); });
  const ready = [], spoken = [];
  const slow = ivrDialogue({sessionId: 'web-1', text: '我想查詢庫存'}, new AbortController().signal, {
    workflowUrl: 'http://n8n.test/webhook/ivr-agent', noticeDelaySeconds: 1,
    onNoticeReady: phrase => ready.push(phrase), onNotice: phrase => { spoken.push(phrase); },
  });
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.deepEqual(ready, ['好的，我幫您查一下庫存，請稍等。'], 'prepared before it is due');
  assert.deepEqual(spoken, []);
  await new Promise(resolve => setTimeout(resolve, 900));
  assert.deepEqual(spoken, ['好的，我幫您查一下庫存，請稍等。']);
  assert.deepEqual(requests.find(request => request.url.endsWith('ivr-intent')).body, {sessionId: 'web-1', text: '我想查詢庫存'});
  release();
  assert.equal((await slow).scenario.number, 4);
  // A fast turn is not announced.
  respond = (init, url) => url.endsWith('ivr-intent') ? Response.json({intent: '4', phrases: ['好的，請稍等。']})
    : Response.json({reply: '好的。', stage: 'scenario', status: 'continue', language: 'zh', awaitingLanguage: false, scenario: null});
  const quick = [];
  await ivrDialogue({sessionId: 'web-1', text: '好'}, new AbortController().signal, {noticeDelaySeconds: 1, onNotice: phrase => { quick.push(phrase); }});
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.deepEqual(quick, []);
  // Consecutive notices in one call are worded differently.
  const phrases = ['好的，請稍等。', '嗯，我看一下喔。', '了解，稍等一下。'];
  let previous = pickNotice('web-9', phrases, () => 0);
  for (let i = 0; i < 20; i++) { const next = pickNotice('web-9', phrases); assert.notEqual(next, previous); previous = next; }

  // Errors are explicit and never replaced with another reply.
  respond = () => Response.json({message: 'knowledge service unavailable'}, {status: 500});
  const failed = [];
  await assert.rejects(ivrDialogue({sessionId: 'web-1', text: '1'}, new AbortController().signal, {onWorkflow: state => failed.push(state)}),
    /IVR workflow failed \(500\): knowledge service unavailable/);
  assert.deepEqual(failed, ['started', 'failed']);
  respond = () => new Response('Not found', {status: 404});
  await assert.rejects(ivrDialogue({sessionId: 'web-1', text: '1'}, new AbortController().signal), /Publish「GeoVision · Workflow」/);
  respond = () => Response.json({reply: ' '});
  await assert.rejects(ivrDialogue({sessionId: 'web-1', text: '1'}, new AbortController().signal), /returned no reply/);
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(ivrDialogue({sessionId: 'web-1', text: '1'}, aborted.signal));
  console.log('PASS IVR client: start/turn payloads, intent wait notice (prepared early, spoken only when slow, varied), explicit errors and aborts');
} finally {
  globalThis.fetch = originalFetch;
}

// The workflow saves one Data Table row per completed work order.
const split = workflow.nodes.find(node => node.name === 'One row per work order');
const run = records => runInNewContext(`(function(){${split.parameters.jsCode}})()`, {$input: {first: () => ({json: {records}})}});
const rows = run([{order_id: 'GV-1', report_key: 'k1'}, {order_id: 'GV-2', report_key: 'k2'}]);
assert.deepEqual(JSON.parse(JSON.stringify(rows)), [{json: {order_id: 'GV-1', report_key: 'k1'}}, {json: {order_id: 'GV-2', report_key: 'k2'}}]);
assert.throws(() => run(undefined), /no work orders/);
const save = workflow.nodes.find(node => node.name === 'Save work order · Data Table');
assert.equal(save.parameters.operation, 'upsert');
assert.equal(save.parameters.filters.conditions[0].keyName, 'report_key', 'retries update the same row');
const extract = workflow.nodes.find(node => node.name === 'Extract work orders');
assert.match(extract.parameters.jsonBody, /records:true/);
console.log('PASS work-order save: one upserted row per completed work order, keyed by report_key');
