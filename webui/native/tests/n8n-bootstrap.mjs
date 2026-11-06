import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {bootstrap,importMissing as realImportMissing,exists,originalSourceMigration,readOnlyMcpMigration,resultWorkflowMigration,promptSourceMigration} from '../../../examples/docker/agx-one-container/n8n/bootstrap-local.mjs';
const importMissing = options => realImportMissing({read:async()=>null,...options});
const templates=new URL('../../../examples/docker/agx-one-container/n8n',import.meta.url).pathname;
const credentials=JSON.parse(await fs.readFile(path.join(templates,'local-credentials.json'),'utf8'));
const workflow=JSON.parse(await fs.readFile(path.join(templates,'scenario-1-rag.json'),'utf8'));
const existing=new Set([credentials[0].id]);
const imports=[];
await importMissing({templates,has:async(_kind,id)=>existing.has(id),run:async args=>{
  imports.push(args[0]);
  const data=JSON.parse(await fs.readFile(args[1].slice('--input='.length),'utf8'));
  for(const entity of Array.isArray(data)?data:[data]) {
    assert.ok(!existing.has(entity.id),'existing edits must not be overwritten');
    existing.add(entity.id);
  }
}});
assert.deepEqual(imports,['import:credentials','import:workflow','import:workflow']);
await importMissing({templates,has:async(_kind,id)=>existing.has(id),run:async()=>assert.fail('a restart must preserve existing entities')});
await assert.rejects(importMissing({templates,has:async()=>false,run:async()=>{}}),/import incomplete/);
assert.equal(await exists('workflow','missing',{run:async()=>{throw new Error('No workflows found with specified filters');}}),false);
await assert.rejects(exists('workflow','missing',{run:async()=>{throw new Error('database unavailable');}}),/database unavailable/);
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'ivr-bootstrap-test-'));
try {
  const marker=path.join(directory,'installed');
  let calls=0,installs=0,waits=0;
  await bootstrap({marker,log:()=>{},fetchImpl:async()=>({ok:true,json:async()=>({data:{userManagement:{showSetupOnFirstLoad:++calls===1}}})}),wait:async()=>{waits++;},install:async()=>{if(++installs===1)throw new Error('database busy');}});
  assert.equal(calls,3);
  assert.equal(installs,2);
  assert.equal(waits,2);
  await fs.access(marker);
  let repaired = false;
  await bootstrap({marker,log:()=>{},fetchImpl:async()=>({ok:true,json:async()=>({data:{userManagement:{showSetupOnFirstLoad:false}}})}),install:async()=>{repaired=true;}});
  assert.equal(repaired,true,'a stale marker must not skip checking for a missing workflow');
} finally {await fs.rm(directory,{recursive:true,force:true});}
console.log('PASS automatic n8n bootstrap: owner setup, retry, import verification, partial imports and preservation of existing edits');

const ragTemplate=JSON.parse(await fs.readFile(path.join(templates,'maintenance-knowledge-rag.json'),'utf8'));
const oldRag=structuredClone(ragTemplate);
oldRag.nodes=oldRag.nodes.filter(n=>!['read-prompt-csv','decode-prompt-text','load-knowledge-files'].includes(n.id));
oldRag.nodes.find(n=>n.id==='prepare-guidance').parameters.jsCode='return [{json:{query:"test",knowledge:"old embedded text"}}];';
oldRag.nodes.find(n=>n.name==='Local Embeddings').credentials.openAiApi.id='custom-credential';
oldRag.nodes.find(n=>n.name==='Retrieve guidance').parameters.topK=7;
const migrated=promptSourceMigration(oldRag,ragTemplate);
assert.equal(migrated.nodes.find(n=>n.name==='Local Embeddings').credentials.openAiApi.id,'custom-credential');
assert.equal(migrated.nodes.find(n=>n.name==='Retrieve guidance').parameters.topK,7);
assert.equal(migrated.nodes.find(n=>n.id==='load-knowledge-files').parameters.url,'http://knowledge:8085/documents');
assert.equal(promptSourceMigration(migrated,ragTemplate),null);
const upgradeDir=await fs.mkdtemp(path.join(os.tmpdir(),'ivr-rag-migration-test-'));
try {
  let stored=oldRag,updates=0;
  await realImportMissing({templates,has:async()=>true,read:async()=>stored,backupDir:upgradeDir,run:async args=>{
    assert.equal(args[0],'import:workflow');updates++;
    stored=JSON.parse(await fs.readFile(args[1].slice('--input='.length),'utf8'));
  },log:()=>{}});
  assert.equal(updates,1);
  const backups=await fs.readdir(upgradeDir);
  assert.equal(backups.length,1);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(upgradeDir,backups[0]),'utf8')),oldRag);
  await realImportMissing({templates,has:async()=>true,read:async()=>stored,backupDir:upgradeDir,run:async()=>assert.fail('must not repeat the source migration'),log:()=>{}});
} finally {await fs.rm(upgradeDir,{recursive:true,force:true});}
console.log('PASS prompt.csv source migration: backup, preserved credentials/retrieval settings, verified import and idempotence');

const mcpTemplate=JSON.parse(await fs.readFile(path.join(templates,'maintenance-mcp-tools.json'),'utf8'));
const priorQueryFlow=structuredClone(ragTemplate);
priorQueryFlow.nodes=priorQueryFlow.nodes.filter(n=>!['manual-rag-test','rag-test-query','validate-rag-query'].includes(n.id));
priorQueryFlow.nodes.find(n=>n.id==='prepare-guidance').parameters.jsCode=priorQueryFlow.nodes.find(n=>n.id==='prepare-guidance').parameters.jsCode.replace("$('Validate query')","$('RAG tool input')");
const repairedQueryFlow=promptSourceMigration(priorQueryFlow,ragTemplate);
assert.ok(repairedQueryFlow.nodes.some(n=>n.name==='Test RAG'));
assert.equal(repairedQueryFlow.connections['RAG tool input'].main[0][0].node,'Validate query');
assert.equal(promptSourceMigration(repairedQueryFlow,ragTemplate),null);
console.log('PASS migration of existing published RAG query wiring to support manual tests');
const renamedIds=structuredClone(priorQueryFlow);
for(const node of renamedIds.nodes)node.id='imported-'+node.name;
const prep=renamedIds.nodes.find(n=>n.name==='Prepare guidance');
prep.parameters.jsCode=prep.parameters.jsCode.replace("const query = $('RAG tool input').first().json.query;", "const query = $input.first().json.query || 'manual question';");
prep.position=renamedIds.nodes.find(n=>n.name==='Load knowledge files').position;
const repairedImport=promptSourceMigration(renamedIds,ragTemplate);
assert.ok(repairedImport.nodes.some(n=>n.name==='Test query'));
assert.ok(repairedImport.nodes.find(n=>n.name==='Prepare guidance').parameters.jsCode.includes("const query = $('Validate query').first().json.query;"));
assert.notDeepEqual(repairedImport.nodes.find(n=>n.name==='Prepare guidance').position,repairedImport.nodes.find(n=>n.name==='Load knowledge files').position);
assert.equal(promptSourceMigration(repairedImport,ragTemplate),null);
console.log('PASS manual-test upgrade with GUI-remapped node IDs, edited query code and overlapping node positions');

const legacyMcp=structuredClone(mcpTemplate);
for(const name of ['create_work_order','read_work_order','update_work_order','delete_work_order','get_work_order','replace_work_order','list_work_orders']){
 legacyMcp.nodes.push({id:name,name,type:'n8n-nodes-base.httpRequestTool',parameters:{url:'http://knowledge:8085/work-orders'}});
 legacyMcp.connections[name]={ai_tool:[[{node:'Maintenance MCP Server',type:'ai_tool',index:0}]]};
}
legacyMcp.nodes.find(n=>n.name==='Maintenance MCP Server').parameters.instructions='CRUD writes ivrDataBase.csv';
const rolledBack=readOnlyMcpMigration(legacyMcp,mcpTemplate);
assert.equal(rolledBack.nodes.length,mcpTemplate.nodes.length);
assert.equal(readOnlyMcpMigration(rolledBack,mcpTemplate),null);
assert.equal(rolledBack.nodes.find(n=>n.name==='Maintenance MCP Server').parameters.instructions,mcpTemplate.nodes.find(n=>n.name==='Maintenance MCP Server').parameters.instructions);
for(const [from,outputs] of Object.entries(rolledBack.connections)){
 assert.ok(rolledBack.nodes.some(n=>n.name===from));
 for(const groups of Object.values(outputs))for(const edges of groups)for(const edge of edges)assert.ok(rolledBack.nodes.some(n=>n.name===edge.node));
}
const oldCsvSource={nodes:[{parameters:{jsCode:"const source = 'ivrDataBase.csv';"}}]};
assert.ok(originalSourceMigration(oldCsvSource).nodes[0].parameters.jsCode.includes('CSD資料庫.xlsx'));
assert.equal(originalSourceMigration(mcpTemplate),null);
console.log('PASS CRUD toolbox rollback removes nodes/connections and restores original XLSX source idempotently');
const rollbackDir=await fs.mkdtemp(path.join(os.tmpdir(),'ivr-rollback-'));
try{
 let stored=legacyMcp;
 await realImportMissing({templates,has:async()=>true,read:async id=>id==='ivrMaintenanceMcp'?stored:ragTemplate,backupDir:rollbackDir,log:()=>{},run:async args=>{stored=JSON.parse(await fs.readFile(args[1].slice('--input='.length),'utf8'));}});
 assert.equal(stored.nodes.length,mcpTemplate.nodes.length);
 const backups=await fs.readdir(rollbackDir);assert.equal(backups.length,1);
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(rollbackDir,backups[0]),'utf8')),legacyMcp);
}finally{await fs.rm(rollbackDir,{recursive:true,force:true});}
console.log('PASS existing MCP workflow is backed up before CRUD rollback');

const beforeResults=structuredClone(ragTemplate);
const beforeLoad=beforeResults.nodes.find(n=>n.name==='Load knowledge files');delete beforeLoad.parameters.sendQuery;delete beforeLoad.parameters.queryParameters;
beforeResults.nodes.find(n=>n.name==='Return guidance').parameters.jsCode='return [{json:{passages:[]}}];';
const resultUpgrade=resultWorkflowMigration(beforeResults,ragTemplate);
assert.equal(resultUpgrade.nodes.find(n=>n.name==='Local Embeddings').credentials.openAiApi.id,beforeResults.nodes.find(n=>n.name==='Local Embeddings').credentials.openAiApi.id);
assert.ok(resultUpgrade.nodes.find(n=>n.name==='Return guidance').parameters.jsCode.includes('if (prepared.result)'));
assert.equal(resultWorkflowMigration(resultUpgrade,ragTemplate),null);
console.log('PASS RAG result migration passes current query and structured facts without altering credentials');
