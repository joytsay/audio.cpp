import assert from 'node:assert/strict';
import { once } from 'node:events';
import {buildSync} from 'esbuild';
const normalizedModule=buildSync({stdin:{
  contents:"export { normalizeTranscript } from './transcript.ts'; export { correctAsrTranscript, DEFAULT_ASR_POSTPROCESS_MODEL } from './asr-postprocess.ts';",
  resolveDir:new URL('../src/lib/',import.meta.url).pathname,
},bundle:true,platform:'node',format:'esm',write:false});
const {normalizeTranscript,correctAsrTranscript,DEFAULT_ASR_POSTPROCESS_MODEL}=await import('data:text/javascript;base64,'+Buffer.from(normalizedModule.outputFiles[0].text).toString('base64'));
import { fileURLToPath } from 'node:url';
import { createDialogueServer, loadDialogue, loadGreetingReader } from '../../../examples/docker/agx-one-container/n8n/sip-dialogue-server.mjs';

const directory = fileURLToPath(new URL('../src/lib/', import.meta.url));
const [dialogue, readGreetingCsv] = await Promise.all([loadDialogue(directory), loadGreetingReader(directory)]);
let releaseLookup,holdLookup=false;
let noticeDelaySeconds,intentRequests=[],ttsStreaming=false,endSilenceMs=2000;
const ttsLoads=[];
let ttsFamily='zipvoice',voiceId;
let failTtsLoad=false;
let greetingsCsv='greeting\n"您好，這裡是 GeoVision IVR，請問需要什麼協助？"\n';
let source = 'n8n', failTool = false, modelReady = true, modelLoads = 0, modelDiscovery = 0;
let asrPostprocessEnabled, asrModel, failCorrection=false;
const correctionRequests=[];
let sipScenarioId;
const engineStarts=[], engineTurns=[];
let correctionText='请检查设备 C1-VFD-12CC04。';
const requests = [], toolCalls = [];
const originalFetch = globalThis.fetch;
const query = '如何確認維修起機測試流程？';
const mockFetch = async (url, options = {}) => {
  url = String(url); options.signal?.throwIfAborted();
  if (url === 'http://audio.test/v1/ui/demo-settings') return Response.json({ settings: { dialogue_source: source, llm_model: 'selected-demo-llm', lookup_notice_delay_seconds: noticeDelaySeconds,tts_streaming:ttsStreaming,vad_end_silence_ms:endSilenceMs,tts_model_id:'zipvoice-test',tts_model_family:ttsFamily,tts_model_path:`/models/${ttsFamily}.gguf`,tts_model_task:ttsFamily==='bluemagpie'?'tts':'clon',tts_voice_id:voiceId, sip_scenario_id: sipScenarioId, asr_postprocess_enabled: asrPostprocessEnabled, asr_postprocess_model: asrModel } });
  if (url === 'http://correction.test/v1/chat/completions' ||
      (url === 'http://llm.test/v1/chat/completions?autoload=true' && JSON.parse(options.body).model === 'alternate-model')) {
    const {model, messages}=JSON.parse(options.body);
    const input=messages[1].content;
    correctionRequests.push({url, model, text:input.slice(input.indexOf('\n')+1)});
    return failCorrection ? new Response('worker unavailable',{status:503}) :
      Response.json({choices:[{finish_reason:'stop',message:{content:correctionText}}]});
  }
  if (url === 'http://audio.test/v1/ui/greetings') {
    assert.equal(options.cache,'no-store');
    return Response.json({content:greetingsCsv});
  }
  if (url === 'http://audio.test/v1/models/load') { ttsLoads.push(JSON.parse(options.body)); return failTtsLoad ? new Response('backend unavailable',{status:503}) : Response.json({loaded:true}); }
  if (url === 'http://audio.test/v1/ui/voices') return Response.json({voices:[{id:'my-clone',audio:'UklGRg==',transcript:''}]});
  if (url === 'http://llm.test/models') { modelDiscovery++; return Response.json({ data: [{ id: 'selected-demo-llm', loaded: modelReady, status: { value: modelReady ? 'loaded' : 'unloaded' } }] }); }
  if (url === 'http://llm.test/models/load') { modelLoads++; modelReady = true; return Response.json({}); }
  if (url === 'http://n8n.test/webhook/ivr-intent') {
    const body = JSON.parse(options.body); intentRequests.push(body);
    assert.deepEqual(Object.keys(body).sort(), ['sessionId','text']);
    return Response.json({intent:'5',phrases:['好的，我幫您查一下SOP，請稍等。']});
  }
  if (url === 'http://n8n.test/webhook/ivr-agent') {
    // The IVR engine contract: {sessionId, text|start, scenarioId?} → reply + call state.
    const body = JSON.parse(options.body);
    assert.deepEqual(Object.keys(body).sort(), body.start ? ['scenarioId','sessionId','start'].filter(key=>key in body) : ['scenarioId','sessionId','text'].filter(key=>key in body));
    if (body.start) { engineStarts.push(body); return Response.json({reply:'請先選語言：中文 1、英文2',stage:'opening',status:'continue',language:'zh',awaitingLanguage:true,scenario:null}); }
    if (body.sessionId === 'script-call') {
      engineTurns.push(body);
      return Response.json({reply:body.text==='1'?'請進行身分驗證：請問此電話持有人名字是?':'好的，工單已輸入完成，謝謝。',stage:'scenario',status:'done',
        language:'zh',awaitingLanguage:false,scenario:{number:2,title:'工單回報'},work_order:{order_id:'GV-0123456789AB',pending:true}});
    }
    toolCalls.push(body);
    assert.equal(body.text, query);
    assert.equal(body.sessionId, 'same-sip-call');
    if(holdLookup)await new Promise(resolve=>{releaseLookup=resolve;});
    return failTool ? Response.json({message:'IVR engine unavailable'}, {status:500})
      : Response.json({reply:'參考資料中的維修流程。',stage:'scenario',status:'continue',language:'zh',awaitingLanguage:false,scenario:{number:5,title:'維修 SOP 查詢'}});
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
const server = createDialogueServer({ dialogue, readGreetingCsv, normalizeTranscript, correctAsrTranscript, defaultAsrModel:DEFAULT_ASR_POSTPROCESS_MODEL, fetchImpl: mockFetch, audioUrl: 'http://audio.test', llmUrl: 'http://llm.test/v1', asrPostprocessUrl:'http://correction.test/v1', workflowUrl: 'http://n8n.test/webhook/ivr-agent' });
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
  const normalizeTurn=async (postprocess,text='请维修设备 C1-VFD-12CC04。')=>(await originalFetch(base+'/normalize',{method:'POST',body:JSON.stringify({
    text,postprocess,
  })})).json();
  assert.deepEqual(await normalizeTurn(false),{text:'請維修設備 C1-VFD-12CC04。'});
  assert.equal(correctionRequests.length,0);
  assert.deepEqual(await normalizeTurn(true),{text:'請檢查設備 C1-VFD-12CC04。',postprocess:'completed'});
  assert.deepEqual(correctionRequests.at(-1),{url:'http://correction.test/v1/chat/completions',model:DEFAULT_ASR_POSTPROCESS_MODEL,text:'請維修設備 C1-VFD-12CC04。'});
  asrModel='alternate-model';
  assert.equal((await normalizeTurn(true)).postprocess,'completed');
  assert.deepEqual(correctionRequests.at(-1),{url:'http://llm.test/v1/chat/completions?autoload=true',model:'alternate-model',text:'請維修設備 C1-VFD-12CC04。'});
  failCorrection=true;
  assert.deepEqual(await normalizeTurn(true),{text:'請維修設備 C1-VFD-12CC04。',postprocess:'fallback'});
  asrPostprocessEnabled=false;
  assert.deepEqual(await normalizeTurn(true),{text:'請維修設備 C1-VFD-12CC04。'});
  assert.equal(correctionRequests.length,3);
  assert.deepEqual(await normalizeTurn(true,'查'),{text:'查'});
  assert.equal(correctionRequests.length,3);
  asrPostprocessEnabled=true;
  failCorrection=false;
  correctionText='查询';
  for (const text of ['查','請查']) {
    assert.deepEqual(await normalizeTurn(true,text),{text:'查詢',postprocess:'completed'});
    assert.equal(correctionRequests.at(-1).text,text);
  }
  failCorrection=true;
  const longText='查'.repeat(20001);
  assert.deepEqual(await normalizeTurn(true,longText),{text:longText,postprocess:'fallback'});
  assert.equal(correctionRequests.at(-1).text,longText);
  assert.deepEqual(await normalizeTurn(true,' '),{text:' '});
  assert.equal(correctionRequests.length,6);
  const callSettings=await originalFetch(base+'/settings',{method:'POST',body:'{}'});
  assert.equal((await callSettings.json()).vad_end_silence_ms,2000);
  ttsStreaming=true;
  const ttsConfig=await originalFetch(base+'/tts-config',{method:'POST',body:JSON.stringify({model:'zipvoice'})});
  assert.deepEqual(await ttsConfig.json(),{model:'demo-zipvoice-test-streaming',streaming:true,vad_end_silence_ms:2000});
  assert.equal(ttsLoads[0].mode,'streaming');assert.equal(ttsLoads[0].family,'zipvoice');
  ttsStreaming=false;endSilenceMs=3000;
  const offlineConfig=await originalFetch(base+'/tts-config',{method:'POST',body:JSON.stringify({model:'zipvoice'})});
  assert.deepEqual(await offlineConfig.json(),{model:'demo-zipvoice-test',streaming:false,vad_end_silence_ms:3000});
  ttsFamily='bluemagpie';voiceId='my-clone';
  for (const streaming of [false,true]) {
    ttsStreaming=streaming;
    const response=await originalFetch(base+'/tts-config',{method:'POST',body:JSON.stringify({model:'zipvoice'})});
    const config=await response.json();
    assert.equal(response.status,200);assert.equal(config.model,`demo-zipvoice-test${streaming?'-streaming':''}`);
    assert.equal(ttsLoads.at(-1).family,'bluemagpie');assert.equal(ttsLoads.at(-1).task,'tts');
    assert.equal(ttsLoads.at(-1).mode,streaming?'streaming':'offline');
    assert.deepEqual(config.reference,{audio:'UklGRg==',text:''},'BlueMagpie reference needs no transcript');
  }
  const keypadConfig=await originalFetch(base+'/tts-config',{method:'POST',body:JSON.stringify({model:'zipvoice',keypadGreeting:true})});
  assert.deepEqual(await keypadConfig.json(),{model:'demo-zipvoice-test',streaming:false,vad_end_silence_ms:3000});
  assert.equal(ttsLoads.at(-1).family,'bluemagpie');
  assert.equal(ttsLoads.at(-1).mode,'offline','keypad playback requires one WAV');
  // Without a SIP session ID the welcome greeting never starts a call script.
  const fetchWelcome=()=>originalFetch(base+'/tts-config',{method:'POST',body:JSON.stringify({model:'zipvoice',welcomeGreeting:true})});
  const welcome=await (await fetchWelcome()).json();
  assert.equal(welcome.greeting,'您好，這裡是 GeoVision IVR，請問需要什麼協助？');
  assert.equal(welcome.model,'demo-zipvoice-test-streaming');
  assert.deepEqual(welcome.reference,{audio:'UklGRg==',text:''});
  greetingsCsv='greeting\r\n"新的 ""GeoVision"" 問候，\n請問需要什麼協助？"\r\n';
  assert.equal((await (await fetchWelcome()).json()).greeting,'新的 "GeoVision" 問候，\n請問需要什麼協助？');
  greetingsCsv='greeting\n""\n';
  assert.equal((await fetchWelcome()).status,500);
  failTtsLoad=true;
  const failedTts=await originalFetch(base+'/tts-config',{method:'POST',body:JSON.stringify({model:'zipvoice'})});
  assert.equal(failedTts.status,500,'never silently fall back to ZipVoice');
  failTtsLoad=false;ttsStreaming=false;
  const discoveries=modelDiscovery;
  modelReady=true;
  const events = await turn();
  assert.deepEqual(events[0], { type: 'configuration', source: 'n8n', model: 'selected-demo-llm' });
  assert.ok(events.some(e => e.event === 'N8N_WORKFLOW_STARTED'));
  assert.ok(!events.some(e=>e.type==='progress'),'a fast turn has no notice');
  assert.equal(events.at(-1).reply, '參考資料中的維修流程。','script replies are not re-normalized');
  assert.equal(toolCalls.length, 1);
  assert.equal(requests.length,0,'SIP does not run a parallel LLM loop for the IVR engine');
  assert.equal(modelDiscovery,discoveries,'the IVR engine needs no chat-model discovery or loading');

  // Source changes apply to the next utterance in the same phone call.
  source = 'prompt.csv'; modelReady = false;
  const plain = await turn();
  assert.equal(modelLoads, 1, 'load the selected model before the AI Agent starts');
  assert.equal(plain[0].source, 'prompt.csv');
  assert.equal(plain.at(-1).reply, '一般提示詞回覆。');
  assert.equal(toolCalls.length, 1, 'prompt.csv must not invoke the n8n workflow');
  assert.equal(requests.at(-1).messages[0].content, input.prompt);

  source = 'n8n'; failTool = true;
  const failed = await turn();
  assert.ok(failed.some(e => e.event === 'N8N_WORKFLOW_FAILED'));
  assert.equal(failed.at(-1).type, 'error');
  assert.match(failed.at(-1).message, /IVR engine unavailable/);
  assert.ok(!failed.some(e => e.type === 'reply'), 'never silently replace n8n with prompt-only output');
  failTool=false;holdLookup=true;
  // A slow turn speaks what it is doing after the saved delay, before the reply.
  noticeDelaySeconds=1;
  const lookupStarted=Date.now();
  const streaming=await originalFetch(`${base}/dialogue`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  const reader=streaming.body.getReader();let before='';
  while(!before.includes('"type":"progress"')){
   const part=await reader.read();assert.equal(part.done,false);before+=new TextDecoder().decode(part.value);
  }
  assert.ok(Date.now()-lookupStarted>=900,'the notice waits the saved delay');
  assert.ok(before.includes('好的，我幫您查一下SOP，請稍等。'),'the notice says what is being done');
  assert.ok(!before.includes('"type":"reply"'));
  assert.deepEqual(intentRequests.at(-1),{sessionId:'same-sip-call',text:query});
  releaseLookup();let remaining='';
  for(;;){const part=await reader.read();if(part.done)break;remaining+=new TextDecoder().decode(part.value);}
  assert.ok(remaining.includes('"type":"reply"'));holdLookup=false;noticeDelaySeconds=undefined;
  // A call script starts with the welcome greeting and keeps answering that call,
  // even after the saved dialogue source changes.
  greetingsCsv='greeting\n"您好，這裡是 GeoVision IVR，請問需要什麼協助？"\n';
  const scriptWelcome = await (await originalFetch(base+'/tts-config',{method:'POST',
    body:JSON.stringify({model:'zipvoice',welcomeGreeting:true,sessionId:'script-call'})})).json();
  assert.equal(scriptWelcome.greeting,'您好，這裡是 GeoVision IVR，請問需要什麼協助？\n請先選語言：中文 1、英文2');
  assert.equal(scriptWelcome.awaitingLanguage,true);
  assert.deepEqual(engineStarts.at(-1),{sessionId:'script-call',start:true});
  source='prompt.csv';
  const say = async text => (await (await originalFetch(base+'/dialogue',{method:'POST',body:JSON.stringify({
    ...input,sessionId:'script-call',text,messages:[],
  })})).text()).trim().split('\n').map(JSON.parse);
  const first = await say('1');
  assert.equal(first.at(-1).reply,'請進行身分驗證：請問此電話持有人名字是?');
  assert.ok(!('awaitingLanguage' in first.at(-1)));
  const saved = await say('正確，起機測試正常。');
  assert.ok(saved.some(e=>e.event==='WORK_ORDER_COMPLETED'&&e.summary==='GV-0123456789AB'));
  assert.equal(engineTurns.length,2);
  // An empty saved scenario ID switches call scripts off for SIP.
  sipScenarioId=''; const startsBefore=engineStarts.length;
  const offWelcome = await (await originalFetch(base+'/tts-config',{method:'POST',
    body:JSON.stringify({model:'zipvoice',welcomeGreeting:true,sessionId:'no-script-call'})})).json();
  assert.equal(offWelcome.greeting,'您好，這裡是 GeoVision IVR，請問需要什麼協助？');
  assert.equal(engineStarts.length,startsBefore);
  // A saved script ID is passed through to the engine.
  sipScenarioId='c'.repeat(24);
  await originalFetch(base+'/tts-config',{method:'POST',body:JSON.stringify({model:'zipvoice',welcomeGreeting:true,sessionId:'chosen-script'})});
  assert.deepEqual(engineStarts.at(-1),{sessionId:'chosen-script',start:true,scenarioId:'c'.repeat(24)});
  console.log('PASS: shared IVR engine client, call-script opening with the welcome greeting, saved source/model, same-call source switching, intent wait notice, streamed events and explicit errors');
} finally {
  globalThis.fetch = originalFetch;
  await new Promise(resolve => server.close(resolve));
}
