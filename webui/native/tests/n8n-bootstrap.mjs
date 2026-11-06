import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {bootstrap,importMissing as realImportMissing,exists,promptSourceMigration,knowledgeToolMigration} from '../../../examples/docker/agx-one-container/n8n/bootstrap-local.mjs';
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
assert.deepEqual(imports,['import:credentials','import:workflow','import:workflow','import:workflow']);
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
const oldMcp=structuredClone(mcpTemplate);oldMcp.nodes=oldMcp.nodes.filter(n=>n.name!=='list_work_orders');delete oldMcp.connections.list_work_orders;
const nextMcp=knowledgeToolMigration(oldMcp,mcpTemplate);
assert.ok(nextMcp.nodes.some(n=>n.name==='list_work_orders'));
assert.equal(knowledgeToolMigration(nextMcp,mcpTemplate),null);
console.log('PASS existing MCP workflow receives the CSD work-order listing tool without replacing other tools');
