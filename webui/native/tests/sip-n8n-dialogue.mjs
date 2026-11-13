import assert from 'node:assert/strict';
import { once } from 'node:events';
import {buildSync} from 'esbuild';
const normalizedModule=buildSync({entryPoints:[new URL('../src/lib/transcript.ts',import.meta.url).pathname],bundle:true,platform:'node',format:'esm',write:false});
const {normalizeTranscript}=await import('data:text/javascript;base64,'+Buffer.from(normalizedModule.outputFiles[0].text).toString('base64'));
import { fileURLToPath } from 'node:url';
import { createDialogueServer, loadDialogue } from '../../../examples/docker/agx-one-container/n8n/sip-dialogue-server.mjs';

const dialogue = await loadDialogue(fileURLToPath(new URL('../src/lib/', import.meta.url)));
let releaseLookup,holdLookup=false;
let noticeDelaySeconds=3,ttsStreaming=false,endSilenceMs=2000;
const ttsLoads=[];
let source = 'n8n', failTool = false, modelReady = true, modelLoads = 0;
const requests = [], toolCalls = [];
const originalFetch = globalThis.fetch;
const query = '如何確認維修起機測試流程？';
const mockFetch = async (url, options = {}) => {
  url = String(url); options.signal?.throwIfAborted();
  if (url === 'http://audio.test/v1/ui/demo-settings') return Response.json({ settings: { dialogue_source: source, llm_model: 'selected-demo-llm', lookup_notice_delay_seconds: noticeDelaySeconds,tts_streaming:ttsStreaming,vad_end_silence_ms:endSilenceMs,tts_model_id:'zipvoice-test',tts_model_family:'zipvoice',tts_model_path:'/models/zipvoice.gguf',tts_model_task:'clon' } });
  if (url === 'http://audio.test/v1/models/load') { ttsLoads.push(JSON.parse(options.body)); return Response.json({loaded:true}); }
  if (url === 'http://llm.test/models') return Response.json({ data: [{ id: 'selected-demo-llm', loaded: modelReady, status: { value: modelReady ? 'loaded' : 'unloaded' } }] });
  if (url === 'http://llm.test/models/load') { modelLoads++; modelReady = true; return Response.json({}); }
  if (url === 'http://n8n.test/webhook/ivr-agent') {
    const body = JSON.parse(options.body); toolCalls.push(body);
    assert.equal(body.text, query);
    assert.equal(body.model, 'selected-demo-llm');
    assert.equal(body.sessionId, 'same-sip-call');
    assert.ok(body.messages.some(m=>m.content==='Previous caller turn'));
    if(holdLookup)await new Promise(resolve=>{releaseLookup=resolve;});
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
const seenNoticeDelays=[];
const server = createDialogueServer({ dialogue: (...args)=>{seenNoticeDelays.push(args[2].noticeDelaySeconds);return dialogue(...args);}, normalizeTranscript, fetchImpl: mockFetch, audioUrl: 'http://audio.test', llmUrl: 'http://llm.test/v1', workflowUrl: 'http://n8n.test/webhook/ivr-agent' });
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
  const normalized=await originalFetch(base+'/normalize',{method:'POST',body:JSON.stringify({text:'十一月十二号A一二三五年一维，Fan两个。'})});
  assert.equal((await normalized.json()).text,'11月12號A1235年一維，Fan2個。');
  const callSettings=await originalFetch(base+'/settings',{method:'POST',body:'{}'});
  assert.equal((await callSettings.json()).vad_end_silence_ms,2000);
  ttsStreaming=true;
  const ttsConfig=await originalFetch(base+'/tts-config',{method:'POST',body:JSON.stringify({model:'zipvoice'})});
  assert.deepEqual(await ttsConfig.json(),{model:'demo-zipvoice-test-streaming',streaming:true,vad_end_silence_ms:2000});
  assert.equal(ttsLoads[0].mode,'streaming');assert.equal(ttsLoads[0].family,'zipvoice');
  ttsStreaming=false;endSilenceMs=3000;
  const offlineConfig=await originalFetch(base+'/tts-config',{method:'POST',body:JSON.stringify({model:'zipvoice'})});
  assert.deepEqual(await offlineConfig.json(),{model:'zipvoice',streaming:false,vad_end_silence_ms:3000});
  const events = await turn();
  assert.deepEqual(events[0], { type: 'configuration', source: 'n8n', model: 'selected-demo-llm' });
  assert.ok(events.some(e => e.event === 'N8N_WORKFLOW_STARTED'));
  assert.ok(!events.some(e=>e.type==='progress'),'no announcement for a fast lookup');
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
  failTool=false;holdLookup=true;noticeDelaySeconds=1;
  const lookupStarted=Date.now();
  const streaming=await originalFetch(`${base}/dialogue`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  const reader=streaming.body.getReader();let before='';
  while(!before.includes('"type":"progress"')){
   const part=await reader.read();assert.equal(part.done,false);before+=new TextDecoder().decode(part.value);
  }
  assert.ok(Date.now()-lookupStarted>=900,'notice waits the saved one-second delay');
  assert.equal(seenNoticeDelays.at(-1),1,'SIP reads the saved delay on every turn');
  assert.ok(before.includes('查詢中，請稍後。'));
  assert.ok(releaseLookup,'notice must arrive while the workflow request is unresolved');
  assert.ok(!before.includes('"type":"reply"'));
  releaseLookup();let remaining='';
  for(;;){const part=await reader.read();if(part.done)break;remaining+=new TextDecoder().decode(part.value);}
  assert.ok(remaining.includes('"type":"reply"'));holdLookup=false;
  console.log('PASS: real shared n8n dialogue code, saved source/model, same-call source switching, model readiness, AI Agent webhook calls, streamed events and explicit errors');
} finally {
  globalThis.fetch = originalFetch;
  await new Promise(resolve => server.close(resolve));
}
