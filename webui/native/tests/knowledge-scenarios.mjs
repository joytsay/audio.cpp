import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {readFileSync} from 'node:fs';
const built=buildSync({entryPoints:[new URL('../src/lib/knowledge-scenarios.ts',import.meta.url).pathname],bundle:true,platform:'node',format:'esm',write:false});
const {importScenarioFiles,listKnowledgeScenarios,removeKnowledgeScenario}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const originalFetch=globalThis.fetch;
const scenario={id:'a'.repeat(24),name:'新情境',qaCount:3,files:[{name:'政策.txt',size:12,sha256:'hash'}],createdAt:new Date().toISOString()};
try{
 const content='Q: 新情境怎麼申請？\nA: 請聯絡分機 7654。\n'.repeat(1000);
 const importedScenario={...scenario,tables:[]};
 const requests=[];
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'/n8n/webhook/ivr-import-scenario');
  requests.push(JSON.parse(options.body));
  return Response.json({scenario:importedScenario});
 };
 const csv='Question,Answer\n保固多久？,十二個月\n';
 const importFiles=files=>importScenarioFiles(files,new AbortController().signal,()=>{});
 await importFiles([new File([content],'政策.txt'),new File([csv],'政策.CSV')]);
 assert.deepEqual(requests.map(file=>file.name),['政策.txt','政策.CSV']);
 assert.deepEqual(requests.map(file=>Buffer.from(file.data,'base64').toString()),[content,csv]);
 await assert.rejects(importFiles([]),/Choose 1/);
 await assert.rejects(importFiles([new File(['data'],'bad.exe')]),/Choose PDF/);
 await assert.rejects(importFiles([new File([new Uint8Array(10*1024*1024+1)],'big.txt')]),/10 MiB/);
 const html='<!doctype html><p>情境 1：派工</p><p>AI：請確認派工。</p>';
 const htmlScenario={...scenario,simulation:true,tables:[]};
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'/n8n/webhook/ivr-import-scenario');
  assert.equal(options.method,'POST');
  const file=JSON.parse(options.body);
  assert.equal(file.name,'情境範例.html');
  assert.equal(Buffer.from(file.data,'base64').toString(),html);
  return Response.json({scenario:htmlScenario});
 };
 const imported=[];
 await importScenarioFiles([new File([html],'情境範例.html',{type:'text/html'})],new AbortController().signal,item=>imported.push(item));
 assert.deepEqual(imported,[htmlScenario]);
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
assert.ok(!workflow.nodes.some(node=>node.parameters?.path==='ivr-add-scenario'));
assert.equal(nodes.get('Upload scenario file').parameters.path,'ivr-import-scenario');
assert.equal(nodes.get('List uploaded scenarios').parameters.httpMethod,'GET');
assert.equal(nodes.get('Remove uploaded scenario').parameters.path,'ivr-delete-scenario');
assert.equal(nodes.get('Delete scenario files and Q/A').parameters.method,'DELETE');
console.log('PASS scenario upload encoding, file limits, workflow errors, persisted listing, and single upload endpoint');
