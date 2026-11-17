import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {readFileSync} from 'node:fs';
const built=buildSync({entryPoints:[new URL('../src/lib/knowledge-scenarios.ts',import.meta.url).pathname],bundle:true,platform:'node',format:'esm',write:false});
const {addKnowledgeScenario,listKnowledgeScenarios,removeKnowledgeScenario}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const originalFetch=globalThis.fetch;
const scenario={id:'a'.repeat(24),name:'新情境',qaCount:3,files:[{name:'政策.txt',size:12,sha256:'hash'}],createdAt:new Date().toISOString()};
try{
 const content='Q: 新情境怎麼申請？\nA: 請聯絡分機 7654。\n'.repeat(1000);
 let body;
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'/n8n/webhook/ivr-add-scenario');body=JSON.parse(options.body);
  return Response.json({scenario,duplicate:false,indexed:true});
 };
 const result=await addKnowledgeScenario('新情境',[new File([content],'政策.txt')],new AbortController().signal);
 assert.equal(result.scenario.qaCount,3);assert.equal(Buffer.from(body.files[0].data,'base64').toString(),content);
 const csv='Question,Answer\n保固多久？,十二個月\n';
 await addKnowledgeScenario('CSV 情境',[new File([csv],'政策.CSV')],new AbortController().signal);
 assert.equal(body.files[0].name,'政策.CSV');assert.equal(Buffer.from(body.files[0].data,'base64').toString(),csv);
 await assert.rejects(addKnowledgeScenario('',[],new AbortController().signal),/name/);
 await assert.rejects(addKnowledgeScenario('new',[new File(['data'],'bad.exe')],new AbortController().signal),/Choose PDF/);
 await assert.rejects(addKnowledgeScenario('new',[new File([new Uint8Array(10*1024*1024+1)],'big.txt')],new AbortController().signal),/10 MiB/);
 globalThis.fetch=async()=>Response.json({scenario,duplicate:true,indexed:false,index_error:'Embedding unavailable'});
 assert.equal((await addKnowledgeScenario('新情境',[new File(['text'],'政策.txt')],new AbortController().signal)).indexed,false,'saved Q/A can be retried after an indexing failure');
 globalThis.fetch=async()=>Response.json({scenarios:[scenario]});assert.equal((await listKnowledgeScenarios())[0].id,scenario.id);
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'/n8n/webhook/ivr-delete-scenario');assert.equal(options.method,'POST');
  assert.deepEqual(JSON.parse(options.body),{id:scenario.id});
  return Response.json({id:scenario.id,removed:true});
 };
 await removeKnowledgeScenario(scenario.id);
 await assert.rejects(removeKnowledgeScenario('maintenance'),/uploaded scenario/);
 globalThis.fetch=async()=>Response.json({id:scenario.id,removed:false});
 await assert.rejects(removeKnowledgeScenario(scenario.id),/confirm removal/);
 globalThis.fetch=async()=>new Response('Not found',{status:404});await assert.rejects(listKnowledgeScenarios(),/publish GeoVision/);
}finally{globalThis.fetch=originalFetch;}
const workflow=JSON.parse(readFileSync(new URL('../../../examples/docker/agx-one-container/n8n/workflow.json',import.meta.url)));
const nodes=new Map(workflow.nodes.map(n=>[n.name,n]));
assert.equal(nodes.get('Add scenario upload').parameters.path,'ivr-add-scenario');
assert.equal(nodes.get('Create scenario Q/A').parameters.method,'POST');
assert.equal(nodes.get('Index scenario Q/A').parameters.workflowId.value,'ivrWorkflow');
assert.equal(nodes.get('Index scenario Q/A').parameters.workflowInputs.value.operation,'retrieve');
assert.equal(nodes.get('Index scenario Q/A').onError,'continueRegularOutput');
assert.equal(nodes.get('List uploaded scenarios').parameters.httpMethod,'GET');
assert.equal(nodes.get('Remove uploaded scenario').parameters.path,'ivr-delete-scenario');
assert.equal(nodes.get('Delete scenario files and Q/A').parameters.method,'DELETE');
console.log('PASS scenario upload encoding, file limits, workflow errors, persisted listing and same-workflow Q/A indexing branch');
