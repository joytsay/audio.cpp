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
const {n8nDialogue}=await load('../src/lib/n8n-dialogue.ts');
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
function mock({respond,sseMode=false,errorTool=false,paginate=false}={}) {
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
        if(errorTool)result={isError:true,content:[{type:'text',text:'Tool failed'}]};
        else if(request.params.name==='list_work_orders')result={content:[{type:'text',text:JSON.stringify({source:'CSD資料庫.xlsx',sheet:'派工',count:1,work_orders:[{row:2,fields:{'派工單號':'YCS-16860'}}]})}]};
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
    for(const tool of body.tools)assert.ok(!Object.hasOwn(tool.function.parameters.properties,'context'));
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
  assert.ok(llm.at(-1).messages.some(m=>m.role==='tool'&&m.tool_call_id==='tool-2'));
  assert.equal(wire.filter(r=>r.method==='tools/call').at(-1).params.arguments.context.current,text);
  assert.equal(closed,1);
  assert.deepEqual(events.map(e=>e[1]),['started','completed','started','completed']);
  history.push({role:'assistant',content:reply});
}
const input={sessionId:'call-B',model:'local-model',text:turns[0].text,messages:[{role:'user',content:turns[0].text}]};
mock({respond:()=>({content:'No tools used'})});
await assert.rejects(n8nDialogue(input,signal),/連續兩次未產生 MCP 工具呼叫/);assert.equal(closed,1);
assert.equal(llm.length,2,'a missing tool call is retried once, not indefinitely');
mock({respond:(_body,round)=>round===1?{content:'Please provide a work order'}:round===2?{tool_calls:[call('get_report_draft')]}:{content:'本通話尚無工單草稿，尚未連接外部工單系統。'}});
assert.equal(await n8nDialogue({...input,text:'我想要知道有哪些公單',messages:[{role:'user',content:'我想要知道有哪些公單'}]},signal),'本通話尚無工單草稿，尚未連接外部工單系統。');
assert.equal(wire.filter(r=>r.method==='tools/call').length,1);
assert.equal(llm[0].messages[0].content.includes('list_work_orders 未提供時'),true);
assert.deepEqual(llm[0].tool_choice,{type:'function',function:{name:'get_report_draft'}});
assert.deepEqual(llm[0].tools.map(t=>t.function.name),['get_report_draft']);
schemas.push({name:'list_work_orders',description:'List the actual CSD dispatch sheet',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query']}});
mock({respond:(_body,round)=>round===1?{tool_calls:[call('list_work_orders',{query:'有哪些工單'})]}:{content:'CSD資料庫.xlsx／派工：YCS-16860。'}});
assert.equal(await n8nDialogue({...input,text:'有哪些公單',messages:[{role:'user',content:'有哪些公單'}]},signal),'CSD資料庫.xlsx／派工：YCS-16860。');
assert.deepEqual(llm[0].tools.map(t=>t.function.name),['list_work_orders']);
assert.equal(wire.filter(r=>r.method==='tools/call')[0].params.name,'list_work_orders');
assert.equal(JSON.parse(llm[1].messages.find(m=>m.role==='tool').content).source,'CSD資料庫.xlsx','tool data should not be buried in an escaped MCP envelope');
schemas.pop();
mock({respond:()=>({tool_calls:[call('not_advertised')]})});
await assert.rejects(n8nDialogue(input,signal),/unadvertised/);
assert.equal(wire.filter(r=>r.method==='tools/call').length,0);
mock({respond:()=>({tool_calls:[{...call('read_back_notes'),function:{name:'read_back_notes',arguments:'bad JSON'}}]})});
await assert.rejects(n8nDialogue(input,signal),/Invalid JSON/);
mock({respond:()=>({tool_calls:[call('get_report_draft')]})});
await assert.rejects(n8nDialogue(input,signal),/reasoning limit/);assert.equal(closed,1);
mock({respond:()=>({tool_calls:[call('get_report_draft',{},'batch-a'),call('get_report_draft',{},'batch-b'),call('get_report_draft',{},'batch-c')]})});
await assert.rejects(n8nDialogue(input,signal),/tool-call limit/);
assert.equal(wire.filter(r=>r.method==='tools/call').length,16);
mock({errorTool:true,respond:(_body,round)=>round===1?{tool_calls:[call('get_report_draft')]}:{content:'工具失敗，請稍後再試。'}});
const errorEvents=[];
assert.equal(await n8nDialogue(input,signal,{onTool:(...e)=>errorEvents.push(e)}),'工具失敗，請稍後再試。');
assert.equal(errorEvents.at(-1)[1],'failed');
mock();const aborted=new AbortController();aborted.abort();
await assert.rejects(n8nDialogue(input,aborted.signal),{name:'AbortError'});
globalThis.fetch=async()=>new Response('not published',{status:404});
await assert.rejects(n8nDialogue(input,signal),/Publish the IVR Maintenance MCP Tools/);
globalThis.fetch=async()=>Response.json({jsonrpc:'2.0',id:99,result:{}});
await assert.rejects(new McpHttpClient('/mcp/test',signal).connect(),/mismatched/);
globalThis.fetch=async(_url,options)=>Response.json({jsonrpc:'2.0',id:JSON.parse(options.body).id,error:{code:-32603,message:'test failure'}});
await assert.rejects(new McpHttpClient('/mcp/test',signal).connect(),/test failure/);
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
const executePreparation=documents=>vm.runInNewContext(`(function(){${preparation}})()`,{$:name=>{assert.equal(name,'RAG tool input');return {first:()=>({json:{query:ragQuery}})};},$input:{first:()=>({json:{documents}})}})[0].json;
const loaded=executePreparation(fixtureDocs);
assert.equal(loaded.query,ragQuery);
assert.equal(loaded.sources.length,4);
for(const doc of fixtureDocs) assert.ok(loaded.knowledge.includes(doc.source));
assert.ok(loaded.knowledge.includes('工作表：派工'));
assert.throws(()=>executePreparation([{...fixtureDocs[0],text:'  '},...fixtureDocs.slice(1)]),/Empty source/);
assert.throws(()=>executePreparation(fixtureDocs.slice(1)),/Missing knowledge source/);
assert.equal(rag.nodes.find(n=>n.name==='Load knowledge files').parameters.url,'http://knowledge:8085/documents');
assert.equal(rag.connections['RAG tool input'].main[0][0].node,'Load knowledge files');
const completion=nodes.get('confirm_startup_test').parameters.jsCode;
assert.throws(()=>vm.runInNewContext(`(function(){${completion}})()`,{query:{context:{current:'維修完成',user_transcripts:[]}}}),/not confirmed/);
assert.throws(()=>vm.runInNewContext(`(function(){${completion}})()`,{query:{context:{current:'不正確，起機測試正常。',user_transcripts:[turns[0].text]}}}),/not confirmed/);
console.log('PASS MCP initialize/session/notification/JSON/SSE/pagination, three actual n8n tool readbacks, bound ASR context, local LLM tool loop, errors/abort/limits/cleanup, and RAG workflow wiring');
