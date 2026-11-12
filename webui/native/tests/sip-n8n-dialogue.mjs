import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createDialogueServer, loadDialogue } from '../../../examples/docker/agx-one-container/n8n/sip-dialogue-server.mjs';

const dialogue = await loadDialogue(fileURLToPath(new URL('../src/lib/', import.meta.url)));
let source = 'n8n', failTool = false, modelReady = true, modelLoads = 0;
const requests = [], toolCalls = [];
const originalFetch = globalThis.fetch;
const query = '如何確認維修起機測試流程？';
const mockFetch = async (url, options = {}) => {
  url = String(url); options.signal?.throwIfAborted();
  if (url === 'http://audio.test/v1/ui/demo-settings') return Response.json({ settings: { dialogue_source: source, llm_model: 'selected-demo-llm' } });
  if (url === 'http://llm.test/models') return Response.json({ data: [{ id: 'selected-demo-llm', loaded: modelReady, status: { value: modelReady ? 'loaded' : 'unloaded' } }] });
  if (url === 'http://llm.test/models/load') { modelLoads++; modelReady = true; return Response.json({}); }
  if (url === 'http://n8n.test/webhook/ivr-agent') {
    const body = JSON.parse(options.body); toolCalls.push(body);
    assert.equal(body.text, query);
    assert.equal(body.model, 'selected-demo-llm');
    assert.equal(body.sessionId, 'same-sip-call');
    assert.ok(body.messages.some(m=>m.content==='Previous caller turn'));
    return failTool ? Response.json({message:'n8n RAG unavailable'}, {status:500})
      : Response.json({reply:'n8n 已檢索維修流程。',tools:['lookup_maintenance_guidance']});
  }
  if (url.startsWith('http://llm.test/v1/chat/completions')) {
    const body = JSON.parse(options.body); requests.push(body);
    assert.equal(body.model, 'selected-demo-llm', 'SIP must use the saved demo LLM');
    assert.equal(source, 'prompt.csv', 'n8n LLM calls must run in the AI Agent node');
    return Response.json({ choices: [{ message: {content:'一般提示詞回覆。'} }] });
  }
  return originalFetch(url, options);
};
globalThis.fetch = mockFetch;
const server = createDialogueServer({ dialogue, fetchImpl: mockFetch, audioUrl: 'http://audio.test', llmUrl: 'http://llm.test/v1', workflowUrl: 'http://n8n.test/webhook/ivr-agent' });
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const input = { sessionId: 'same-sip-call', text: query, model: 'old-worker-model', prompt: 'Saved telephone prompt', messages: [{ role: 'user', content: 'Previous caller turn' }, { role: 'assistant', content: 'Previous reply' }] };
async function turn() {
  const response = await originalFetch(`${base}/dialogue`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  assert.equal(response.status, 200);
  return (await response.text()).trim().split('\n').map(line => JSON.parse(line));
}
try {
  assert.equal((await originalFetch(base + '/health')).status, 200);
  const events = await turn();
  assert.deepEqual(events[0], { type: 'configuration', source: 'n8n', model: 'selected-demo-llm' });
  assert.ok(events.some(e => e.event === 'N8N_WORKFLOW_STARTED'));
  assert.ok(events.some(e => e.event === 'MCP_TOOL_COMPLETED'));
  assert.equal(events.at(-1).reply, 'n8n 已檢索維修流程。');
  assert.equal(toolCalls.length, 1);
  assert.equal(requests.length,0,'SIP does not run a parallel LLM loop for n8n');

  // Source changes apply to the next utterance in the same phone call.
  source = 'prompt.csv'; modelReady = false;
  const plain = await turn();
  assert.equal(modelLoads, 1, 'load the selected model before the AI Agent starts');
  assert.equal(plain[0].source, 'prompt.csv');
  assert.equal(plain.at(-1).reply, '一般提示詞回覆。');
  assert.equal(toolCalls.length, 1, 'prompt.csv must not use MCP');
  assert.equal(requests.at(-1).messages[0].content, input.prompt);

  source = 'n8n'; failTool = true;
  const failed = await turn();
  assert.ok(failed.some(e => e.event === 'N8N_WORKFLOW_FAILED'));
  assert.equal(failed.at(-1).type, 'error');
  assert.match(failed.at(-1).message, /n8n RAG unavailable/);
  assert.ok(!failed.some(e => e.type === 'reply'), 'never silently replace n8n with prompt-only output');
  console.log('PASS: real shared n8n dialogue code, saved source/model, same-call source switching, model readiness, AI Agent webhook calls, streamed events and explicit errors');
} finally {
  globalThis.fetch = originalFetch;
  await new Promise(resolve => server.close(resolve));
}
