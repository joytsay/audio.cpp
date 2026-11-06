import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../package.json',import.meta.url));
const {buildSync}=require('esbuild');
async function load(file) {
  const compiled=buildSync({entryPoints:[new URL(file,import.meta.url).pathname],bundle:true,platform:'node',format:'esm',write:false});
  return import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
}
const {n8nDialogue,NO_MCP_REPLY,isWorkOrderQuery,isKnowledgeQuery}=await load('../src/lib/n8n-dialogue.ts');
const {McpHttpClient}=await load('../src/lib/mcp-http.ts');
const root=new URL('../../../examples/docker/agx-one-container/n8n/',import.meta.url);
const workflow=JSON.parse(fs.readFileSync(new URL('maintenance-mcp-tools.json',root)));
const rag=JSON.parse(fs.readFileSync(new URL('maintenance-knowledge-rag.json',root)));
const turns=JSON.parse(fs.readFileSync(new URL('scenario-1-turns.json',root)));
const nodes=new Map(workflow.nodes.map(n=>[n.name,n]));
const codeTools=workflow.nodes.filter(n=>n.type.endsWith('.toolCode'));
const toolSchemas=codeTools.map(n=>({name:n.parameters.name,description:n.parameters.description,inputSchema:JSON.parse(n.parameters.inputSchema)}));
const schemas=[{name:'lookup_maintenance_guidance',description:'Retrieve workflow guidance',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query']}},...toolSchemas];
const signal=new AbortController().signal;
let wire=[],llm=[],toolOutputs=[],closed=0;
function call(name,args={},id='tool-1') {return {id,type:'function',function:{name,arguments:JSON.stringify(args)}};}
function sse(message) {
  const text=': keepalive\r\n\r\ndata: '+JSON.stringify({jsonrpc:'2.0',method:'notifications/progress',params:{}})+'\r\n\r\ndata: '+JSON.stringify(message)+'\r\n\r\n';
  const bytes=new TextEncoder().encode(text);
  return new Response(new ReadableStream({start(controller){for(let p=0;p<bytes.length;p+=7)controller.enqueue(bytes.slice(p,p+7));controller.close();}}),{headers:{'Content-Type':'text/event-stream','Mcp-Session-Id':'test-session'}});
}
function mock({respond,sseMode=false,errorTool=false,paginate=false,llmError}={}) {
  wire=[];llm=[];toolOutputs=[];closed=0;
  globalThis.fetch=async(url,options={})=>{
    options.signal?.throwIfAborted();
    if(String(url).includes('/mcp/')) {
      if(options.method==='DELETE'){closed++;return new Response(null,{status:204});}
      const request=JSON.parse(options.body);wire.push(request);
      if(request.method!=='initialize') {
        assert.equal(options.headers['Mcp-Session-Id'],'test-session');
        assert.equal(options.headers['MCP-Protocol-Version'],'2025-03-26');
      }
      if(request.method==='notifications/initialized')return new Response(null,{status:202});
      let result;
      if(request.method==='initialize')result={protocolVersion:'2025-03-26',capabilities:{tools:{}},instructions:'Use maintenance tools.'};
      else if(request.method==='tools/list')result=paginate&&!request.params.cursor?{tools:schemas.slice(0,1),nextCursor:'page2'}:{tools:paginate?schemas.slice(1):schemas};
      else if(request.method==='tools/call') {
        if(errorTool)result={isError:true,content:[{type:'text',text:typeof errorTool==='string'?errorTool:'Tool failed'}]};
        else if(['read_work_order','list_work_orders'].includes(request.params.name))result={content:[{type:'text',text:JSON.stringify({source:'CSD資料庫.xlsx',sheet:'派工',revision:'fixture-revision',count:1,work_orders:[{row:2,fields:{'派工單號':'YCS-16860'}}]})}]};
        else if(['create_work_order','update_work_order','replace_work_order','delete_work_order'].includes(request.params.name))result={content:[{type:'text',text:JSON.stringify({persisted:true,action:request.params.name})}]};
        else if(request.params.name==='lookup_maintenance_guidance')result={content:[{type:'text',text:'維修和備註需確認，起機測試正常才完成。'}]};
        else {
          const node=nodes.get(request.params.name);assert.ok(node);
          const text=vm.runInNewContext(`(function(){${node.parameters.jsCode}})()`,{query:request.params.arguments});
          result={content:[{type:'text',text}]};
        }
        toolOutputs.push(result);
      } else assert.fail(request.method);
      const message={jsonrpc:'2.0',id:request.id,result};
      return sseMode?sse(message):Response.json(message,{headers:{'Mcp-Session-Id':'test-session'}});
    }
    assert.ok(String(url).includes('/chat/completions?autoload=true'));
    const body=JSON.parse(options.body);llm.push(body);
    assert.equal(typeof body.tool_choice,'string','llama.cpp requires a string tool_choice');
    assert.ok(['required','auto','none'].includes(body.tool_choice));
    for(const tool of body.tools)assert.ok(!Object.hasOwn(tool.function.parameters.properties,'context'));
    if(llmError)return Response.json({error:{message:llmError}},{status:400});
    const message=respond?respond(body,llm.length):{content:JSON.parse(toolOutputs.at(-1).content[0].text).proposed_reply};
    return Response.json({choices:[{message}]});
  };
}
const history=[];
for(let turn=0;turn<3;turn++) {
  const text=turns[turn].text;
  history.push({role:'user',content:text});
  const name=['read_back_maintenance','read_back_notes','confirm_startup_test'][turn];
  mock({sseMode:turn===1,paginate:true,respond:(_body,round)=>{
    if(round===1)return {content:null,tool_calls:[call('lookup_maintenance_guidance',{query:'maintenance reporting'})]};
    if(round===2)return {content:null,tool_calls:[call(name,{context:{current:'FAKE',user_transcripts:['SN：99999999']}},'tool-2')]};
    return {content:JSON.parse(toolOutputs.at(-1).content[0].text).proposed_reply};
  }});
  const events=[];
  const reply=await n8nDialogue({sessionId:'call-A',text,model:'local-model',messages:history},signal,{onTool:(...event)=>events.push(event)});
  assert.equal(reply,turns[turn].expected);
  assert.equal(llm[0].tool_choice,'required');
  assert.equal(llm[1].tool_choice,'auto');
  assert.deepEqual(llm[0].tools.map(t=>t.function.name),['lookup_maintenance_guidance']);
  assert.deepEqual(llm[1].tools.map(t=>t.function.name),[name]);
  assert.deepEqual(llm[2].tools,[]);
  assert.equal(llm[2].tool_choice,'none');
  assert.ok(llm.at(-1).messages.some(m=>m.role==='tool'&&m.tool_call_id==='tool-2'));
  assert.equal(wire.filter(r=>r.method==='tools/call').at(-1).params.arguments.context.current,text);
  assert.equal(closed,1);
  assert.deepEqual(events.map(e=>e[1]),['started','completed','started','completed']);
  history.push({role:'assistant',content:reply});
}
const input={sessionId:'call-B',model:'local-model',text:turns[0].text,messages:[{role:'user',content:turns[0].text}]};
mock({respond:()=>({content:'No tools used'})});
assert.equal(await n8nDialogue(input,signal),NO_MCP_REPLY);assert.equal(closed,1);
assert.equal(llm.length,1,'missing tool calls return immediately without a retry');
assert.equal(llm[0].max_tokens,128);
assert.equal(wire.filter(r=>r.method==='tools/call').length,0);
const queryHistory=[];
for (const text of ['我要查詢工單 最新的一筆','最舊的呢','可以列出所有歷史工單']) {
  queryHistory.push({role:'user',content:text});
  mock({respond:(_body,round)=>round===1?{tool_calls:[call('lookup_maintenance_guidance',{query:'最新的一筆'})]}:{content:'依本輪結果回答。'}});
  await n8nDialogue({...input,text,messages:queryHistory},signal);
  assert.deepEqual(llm[0].tools.map(t=>t.function.name),['lookup_maintenance_guidance']);
  assert.equal(wire.find(r=>r.method==='tools/call').params.arguments.query,text);
  assert.ok(!llm[0].messages.some(m=>m.role==='assistant'));
  assert.ok(llm[1].messages[0].content.includes('只給查詢結果'));
  assert.ok(!llm[1].messages.some(m=>m.content?.includes('n8n 維修工具使用規則')));
  queryHistory.push({role:'assistant',content:'過時的最新工單回答'});
}
assert.equal(isWorkOrderQuery('工單回報流程是什麼？',queryHistory),false);
assert.equal(isWorkOrderQuery('最舊的呢',[{role:'user',content:'天氣如何'}]),false);
mock({respond:(_body,round)=>round===1?{tool_calls:[call('lookup_maintenance_guidance',{query:''})]}:{content:'依規則回報。'}});
await n8nDialogue({...input,text:'維修工單回報流程是什麼？',messages:queryHistory},signal);
assert.deepEqual(llm[0].tools.map(t=>t.function.name),['lookup_maintenance_guidance']);
assert.equal(wire.find(r=>r.method==='tools/call').params.arguments.query,'維修工單回報流程是什麼？');
console.log('PASS latest/oldest/all follow-ups bind current ASR; guidance routes to RAG with a nonempty query');
const notesQuestion='DEMO-EF-04有備註嗎？';
assert.equal(isKnowledgeQuery(notesQuestion),true);
assert.equal(isKnowledgeQuery('正確，請幫我備註 SN：123 製造日期：2026年1月1日 電容值：100MF'),false);
mock({respond:(_body,round)=>round===1?{tool_calls:[call('lookup_maintenance_guidance',{query:'outdated request'})]}:{content:'未查到對應設備備註。'}});
await n8nDialogue({...input,text:notesQuestion,messages:queryHistory},signal);
assert.deepEqual(llm[0].tools.map(t=>t.function.name),['lookup_maintenance_guidance']);
assert.equal(wire.find(r=>r.method==='tools/call').params.arguments.query,notesQuestion);
assert.ok(!llm[0].messages.some(m=>m.role==='assistant'));
console.log('PASS equipment-note questions retrieve guidance without stale assistant answers or report tools');
for(const name of ['create_work_order','read_work_order','update_work_order','delete_work_order','list_work_orders'])schemas.push({name,inputSchema:{type:'object',properties:{},required:[]}});
mock({respond:()=>({tool_calls:[call('create_work_order',{fields:{派工單號:'TEST-001'}})]})});
await assert.rejects(n8nDialogue({...input,text:'測試',messages:[]},signal),/unadvertised/);
assert.ok(!llm[0].tools.some(t=>t.function.name.endsWith('_work_order')||t.function.name==='list_work_orders'));
assert.equal(wire.filter(r=>r.method==='tools/call').length,0);
schemas.splice(-5);
console.log('PASS old server CRUD tools are neither advertised to the model nor executed');
mock({respond:()=>({tool_calls:[call('not_advertised')]})});
await assert.rejects(n8nDialogue({...input,text:"測試",messages:[]},signal),/unadvertised/);
assert.equal(wire.filter(r=>r.method==='tools/call').length,0);
mock({respond:()=>({tool_calls:[{...call('read_back_notes'),function:{name:'read_back_notes',arguments:'bad JSON'}}]})});
await assert.rejects(n8nDialogue({...input,text:"測試",messages:[]},signal),/Invalid JSON/);
mock({respond:()=>({tool_calls:[call('get_report_draft')]})});
await assert.rejects(n8nDialogue({...input,text:"測試",messages:[]},signal),/reasoning limit/);assert.equal(closed,1);
mock({respond:()=>({tool_calls:[call('get_report_draft',{},'batch-a'),call('get_report_draft',{},'batch-b'),call('get_report_draft',{},'batch-c')]})});
await assert.rejects(n8nDialogue({...input,text:"測試",messages:[]},signal),/tool-call limit/);
assert.equal(wire.filter(r=>r.method==='tools/call').length,16);
mock({errorTool:true,respond:(_body,round)=>round===1?{tool_calls:[call('get_report_draft')]}:{content:'工具失敗，請稍後再試。'}});
const errorEvents=[];
await assert.rejects(n8nDialogue({...input,text:"測試",messages:[]},signal,{onTool:(...e)=>errorEvents.push(e)}),/get_report_draft 執行失敗：Tool failed/);
assert.equal(llm.length,1,'tool failures must not be rewritten by the LLM');
assert.equal(errorEvents.at(-1)[1],'failed');
mock({errorTool:'There was an error: "Workflow is not active and cannot be executed."',respond:()=>({tool_calls:[call('lookup_maintenance_guidance',{query:'test'})]})});
await assert.rejects(n8nDialogue({...input,text:'查詢工單'},signal),/重新 Publish「GeoVision · RAG」/);
assert.equal(llm.length,1);
mock();const aborted=new AbortController();aborted.abort();
await assert.rejects(n8nDialogue(input,aborted.signal),{name:'AbortError'});
globalThis.fetch=async()=>new Response('not published',{status:404});
await assert.rejects(n8nDialogue({...input,text:"測試",messages:[]},signal),/Publish the GeoVision · MCP/);
globalThis.fetch=async()=>Response.json({jsonrpc:'2.0',id:99,result:{}});
await assert.rejects(new McpHttpClient('/mcp/test',signal).connect(),/mismatched/);
globalThis.fetch=async(_url,options)=>Response.json({jsonrpc:'2.0',id:JSON.parse(options.body).id,error:{code:-32603,message:'test failure'}});
await assert.rejects(new McpHttpClient('/mcp/test',signal).connect(),/test failure/);
mock();
const normalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 if(!String(url).includes('/chat/completions'))return normalFetch(url,options);
 return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));
};
const selectionStarted=Date.now();
const keepAlive=setInterval(()=>{},1000);
try{assert.equal(await n8nDialogue(input,signal,{toolSelectionTimeoutMs:20}),NO_MCP_REPLY);}finally{clearInterval(keepAlive);}
assert.ok(Date.now()-selectionStarted<1000);
assert.equal(closed,1,'timeout must clean up the MCP session');
console.log('PASS quick no-tool reply, single attempt, 128-token selection budget and selection timeout');
mock({llmError:'Context size has been exceeded.'});
await assert.rejects(n8nDialogue({...input,text:'我要回報工單'},signal),/400.*Context size has been exceeded.*context/);
console.log('PASS upstream context errors retain the actual server message');
for(const w of [workflow,rag]) {
  const names=new Set(w.nodes.map(n=>n.name));
  for(const [from,outputs] of Object.entries(w.connections)) {
    assert.ok(names.has(from));
    for(const groups of Object.values(outputs))for(const group of groups)for(const edge of group)assert.ok(names.has(edge.node));
  }
}
assert.equal(nodes.get('Maintenance MCP Server').typeVersion,2);
assert.equal(nodes.get('Maintenance MCP Server').parameters.path,'ivr-maintenance');
assert.equal(nodes.get('lookup_maintenance_guidance').parameters.workflowId.value,rag.id);
for(const type of ['documentDefaultDataLoader','textSplitterRecursiveCharacterTextSplitter','embeddingsOpenAi','vectorStoreInMemory'])assert.ok(rag.nodes.some(n=>n.type.endsWith('.'+type)));
const preparation=rag.nodes.find(n=>n.name==='Prepare guidance').parameters.jsCode;
const promptText=fs.readFileSync(new URL('../../../prompt.csv',import.meta.url),'utf8');
const ragQuery='NEVER_INDEX_THIS_QUERY_XYZ';
const fixtureDocs=[{source:'prompt.csv',text:promptText,kind:'rules',extraction:'utf8'}, {source:'情境模擬_20261105.docx',text:'情境範例',kind:'scenario_examples',extraction:'docx'}, {source:'CSD資料庫.xlsx',sheet:'派工',text:'派工單號：YCS-16860',kind:'workbook_records',extraction:'xlsx'}, {source:'(備品維修)PY252-0059-工單-20260602-2工-CL、JC.pdf',text:'OCR 工單內容需核對',kind:'work_order_document',extraction:'ocr'}];
const executePreparation=documents=>vm.runInNewContext(`(function(){${preparation}})()`,{$:name=>{assert.equal(name,'Validate query');return {first:()=>({json:{query:ragQuery}})};},$input:{first:()=>({json:{documents}})}})[0].json;
const loaded=executePreparation(fixtureDocs);
assert.equal(loaded.query,ragQuery);
const selectedResult={selection:'newest',source:'CSD資料庫.xlsx',work_orders:[{fields:{派工單號:'SYNTH-002',派工日期:'2026-01-02'}}]};
const resultPreparation=executePreparation(fixtureDocs);
const returnCode=rag.nodes.find(n=>n.name==='Return guidance').parameters.jsCode;
const returned=vm.runInNewContext(`(function(){${returnCode}})()`,{$:()=>({first:()=>({json:{...resultPreparation,result:selectedResult}})}),$input:{all:()=>assert.fail('structured results must not be replaced by instruction passages')}})[0].json;
assert.equal(returned.work_orders[0].fields.派工單號,'SYNTH-002');
assert.equal(returned.selection,'newest');
assert.equal(rag.nodes.find(n=>n.name==='Load knowledge files').parameters.queryParameters.parameters[0].value,'={{ $json.query }}');

assert.equal(loaded.sources.length,4);
for(const doc of fixtureDocs) assert.ok(loaded.knowledge.includes(doc.source));
assert.ok(loaded.knowledge.includes('工作表：派工'));
assert.throws(()=>executePreparation([{...fixtureDocs[0],text:'  '},...fixtureDocs.slice(1)]),/Empty source/);
assert.throws(()=>executePreparation(fixtureDocs.slice(1)),/Missing knowledge source/);
assert.equal(rag.nodes.find(n=>n.name==='Load knowledge files').parameters.url,'http://knowledge:8085/documents');
assert.equal(rag.connections['RAG tool input'].main[0][0].node,'Validate query');
const completion=nodes.get('confirm_startup_test').parameters.jsCode;
assert.throws(()=>vm.runInNewContext(`(function(){${completion}})()`,{query:{context:{current:'維修完成',user_transcripts:[]}}}),/not confirmed/);
assert.throws(()=>vm.runInNewContext(`(function(){${completion}})()`,{query:{context:{current:'不正確，起機測試正常。',user_transcripts:[turns[0].text]}}}),/not confirmed/);
console.log('PASS MCP initialize/session/notification/JSON/SSE/pagination, three actual n8n tool readbacks, bound ASR context, local LLM tool loop, errors/abort/limits/cleanup, and RAG workflow wiring');

const queryCode=rag.nodes.find(n=>n.name==='Validate query').parameters.jsCode;
const validate=query=>vm.runInNewContext(`(function(){${queryCode}})()`,{$input:{first:()=>({json:{query}})}})[0].json.query;
assert.equal(validate('  維修流程  '),'維修流程');
assert.throws(()=>validate(undefined),/手動測試請使用 Test RAG/);
const manualCode=rag.nodes.find(n=>n.name==='Test query').parameters.jsCode;
assert.ok(validate(vm.runInNewContext(`(function(){${manualCode}})()`)[0].json.query));
console.log('PASS RAG manual test query and strict live-query validation before file extraction');
