import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runInNewContext} from 'node:vm';
import {bootstrap,importMissing,exists,mergedWorkflowMigration,repairLocalCredentialUrls,prepareStartupWorkflow} from '../../../examples/docker/agx-one-container/n8n/bootstrap-local.mjs';
import {knowledgeToolsId,managedWorkflowIds,scenarioAdminId,splitManagedWorkflow,workflowLayoutRevision} from '../../../examples/docker/agx-one-container/n8n/workflow-layout.mjs';
const templates=new URL('../../../examples/docker/agx-one-container/n8n',import.meta.url).pathname;
const retired=[];
const installMissing=options=>importMissing({repairCredentials:async()=>{},retireWorkflow:async id=>{retired.push(id);entities.set(id,{...entities.get(id),active:false,activeVersionId:null});},...options});
const readTemplate=async name=>JSON.parse(await fs.readFile(path.join(templates,name),'utf8'));
const credentials=await readTemplate('local-credentials.json');
const template=await readTemplate('workflow.json');
const entities=new Map([[credentials[0].id,credentials[0]]]);
const imports=[];
const run=async args=>{
 imports.push(args[0]);
 const data=JSON.parse(await fs.readFile(args[1].slice('--input='.length),'utf8'));
 for(const entity of Array.isArray(data)?data:[data])entities.set(entity.id,entity);
};
const has=async(_kind,id)=>entities.has(id);
const listWorkflows=async()=>new Map([...entities].filter(([,entity])=>Array.isArray(entity.nodes)));

// Fresh install: the call flow is the slim IVR engine flow; Knowledge Tools is gone.
await installMissing({templates,has,listWorkflows,run,log:()=>{}});
assert.deepEqual(imports,['import:credentials','import:workflow']);
assert.deepEqual(managedWorkflowIds,['ivrWorkflow',scenarioAdminId,'ivrDocumentRag']);
assert.ok(managedWorkflowIds.every(id=>entities.has(id)));
assert.ok(!entities.has(knowledgeToolsId),'new installs have no Knowledge Tools sub-workflow');
const installedMain=entities.get(template.id);
assert.equal(installedMain.name,'GeoVision · Workflow');
assert.equal(installedMain.meta.ivrWorkflowRevision,workflowLayoutRevision);
assert.deepEqual(installedMain.nodes.map(node=>node.name).sort(),['1 · IVR call','IVR Input','Ensure work_orders','Read work orders · Data Table','Add saved work orders',
 'IVR call engine','IVR Output','Work order to save?','Extract work orders','One row per work order','Save work order · Data Table',
 'Call session record','Ensure call_sessions columns','Save call session · Data Table',
 'IVR Intent Input','What is the caller asking?','IVR Intent Output',
 'Mock Call Input','Vary the caller script','Mock Call Output'].sort());
assert.match(installedMain.nodes.find(node=>node.name==='Vary the caller script').parameters.jsonBody,/mock:true/);
assert.equal(installedMain.nodes.find(node=>node.name==='IVR Intent Input').parameters.path,'ivr-intent');
assert.match(installedMain.nodes.find(node=>node.name==='What is the caller asking?').parameters.jsonBody,/intent:true/);
const next=name=>installedMain.connections[name].main.map(edges=>edges.map(edge=>edge.node));
assert.deepEqual(next('IVR Intent Input'),[['What is the caller asking?']]);
assert.deepEqual(next('What is the caller asking?'),[['IVR Intent Output']]);
assert.deepEqual(next('IVR Input'),[['Ensure work_orders']]);
assert.deepEqual(next('Ensure work_orders'),[['Read work orders · Data Table']]);
assert.deepEqual(next('Read work orders · Data Table'),[['Add saved work orders']]);
assert.deepEqual(next('Add saved work orders'),[['IVR call engine']]);
assert.equal(installedMain.nodes.find(node=>node.name==='Read work orders · Data Table').alwaysOutputData,true,'an empty table still reaches the engine');
assert.deepEqual(next('IVR call engine'),[['IVR Output']]);
assert.deepEqual(next('IVR Output'),[['Work order to save?','Call session record']],'the reply is sent before anything is saved');
assert.deepEqual(next('Call session record'),[['Ensure call_sessions columns']]);
assert.deepEqual(next('Ensure call_sessions columns'),[['Save call session · Data Table']]);
const saveCall=installedMain.nodes.find(node=>node.name==='Save call session · Data Table').parameters;
assert.equal(saveCall.operation,'upsert');
assert.equal(saveCall.filters.conditions[0].keyName,'session_id','one row per call, updated every turn');
assert.equal(saveCall.columns.mappingMode,'autoMapInputData','opening-answer columns come from the call script');
assert.deepEqual(next('Work order to save?'),[['Extract work orders'],[]]);
assert.deepEqual(next('One row per work order'),[['Save work order · Data Table']]);
assert.equal(installedMain.nodes.find(node=>node.name==='IVR call engine').parameters.url,'http://knowledge:8085/ivr');
assert.ok(!installedMain.nodes.some(node=>/langchain|executeWorkflow/.test(node.type)),'no AI Agent, memory or sub-workflow');
await installMissing({templates,has,listWorkflows,run:async()=>assert.fail('preserve existing edits'),log:()=>{}});
await assert.rejects(installMissing({templates,has:async()=>false,listWorkflows:async()=>new Map(),run:async()=>{},log:()=>{}}),/import incomplete/);
assert.equal(await exists('workflow','missing',{run:async()=>{throw Error('No workflows found');}}),false);
await assert.rejects(exists('workflow','missing',{run:async()=>{throw Error('database unavailable');}}),/database unavailable/);
console.log('PASS fresh install: slim IVR engine flow, three managed workflows, idempotent');

// Upgrade from revision 27: the old agent flow is replaced and Knowledge Tools is unpublished.
const upgradeDir=await fs.mkdtemp(path.join(os.tmpdir(),'ivr-revision-30-'));
try{
 const oldMain={...structuredClone(installedMain),meta:{ivrWorkflowRevision:27},nodes:[
  {id:'ivr-input',name:'IVR Input',type:'n8n-nodes-base.webhook',position:[0,0],parameters:{path:'ivr-agent'}},
  {id:'ivr-ai-agent',name:'AI Agent',type:'@n8n/n8n-nodes-langchain.agent',position:[0,0],parameters:{}},
  {id:'ivr-local-chat-model',name:'Local Chat Model',type:'@n8n/n8n-nodes-langchain.lmChatOpenAi',position:[0,0],parameters:{},credentials:{openAiApi:{id:'x',name:'IVR local LLM'}}},
 ],connections:{'IVR Input':{main:[[{node:'AI Agent',type:'main',index:0}]]}}};
 const oldTools={id:knowledgeToolsId,name:'GeoVision · Knowledge Tools',active:true,activeVersionId:'v1',nodes:[],connections:{},meta:{ivrWorkflowRevision:27}};
 entities.set(template.id,oldMain);entities.set(knowledgeToolsId,oldTools);
 for(const id of managedWorkflowIds.slice(1))entities.set(id,{...entities.get(id),meta:{...entities.get(id).meta,ivrWorkflowRevision:Math.min(27,entities.get(id).meta.ivrWorkflowRevision)}});
 retired.length=0;
 await installMissing({templates,has,listWorkflows,run,backupDir:upgradeDir,log:()=>{}});
 const upgraded=entities.get(template.id);
 assert.equal(upgraded.meta.ivrWorkflowRevision,workflowLayoutRevision);
 assert.ok(upgraded.nodes.some(node=>node.name==='IVR call engine'));
 assert.ok(!upgraded.nodes.some(node=>node.name==='AI Agent'));
 assert.deepEqual(retired,[knowledgeToolsId]);
 assert.equal(entities.get(knowledgeToolsId).active,false,'Knowledge Tools is unpublished, not deleted');
 const backups=await fs.readdir(upgradeDir);
 assert.ok(backups.some(name=>name.startsWith('merged-workflow-')));
 assert.ok(backups.some(name=>name.startsWith('knowledge-tools-')));
 assert.equal(mergedWorkflowMigration(upgraded,null,splitManagedWorkflow(template)[0]),null);
 retired.length=0;
 await installMissing({templates,has,listWorkflows,run:async()=>assert.fail('upgrade must be idempotent'),backupDir:upgradeDir,log:()=>{}});
 assert.deepEqual(retired,[]);
}finally{await fs.rm(upgradeDir,{recursive:true,force:true});}
console.log('PASS revision 30 upgrade replaces the agent flow, backs up and unpublishes Knowledge Tools');

// Retry loop: the marker never suppresses verification.
const markerDir=await fs.mkdtemp(path.join(os.tmpdir(),'ivr-bootstrap-marker-'));
try{
 const marker=path.join(markerDir,'installed');
 let calls=0,installs=0,waits=0;
 await bootstrap({marker,log:()=>{},fetchImpl:async()=>({ok:true,json:async()=>({data:{userManagement:{showSetupOnFirstLoad:++calls===1}}})}),wait:async()=>{waits++;},install:async()=>{if(++installs===1)throw Error('database busy');}});
 assert.equal(calls,3);assert.equal(installs,2);assert.equal(waits,2);await fs.access(marker);
 let repaired=false;
 await bootstrap({marker,log:()=>{},fetchImpl:async()=>({ok:true,json:async()=>({data:{userManagement:{showSetupOnFirstLoad:false}}})}),install:async()=>{repaired=true;}});
 assert.ok(repaired,'marker cannot suppress verification');
}finally{await fs.rm(markerDir,{recursive:true,force:true});}
console.log('PASS bootstrap waits for the owner account and retries');

const credentialDir=await fs.mkdtemp(path.join(os.tmpdir(),'ivr-local-credential-test-'));
try {
 const stored=structuredClone(credentials);
 stored[0].data={apiKey:'fixture-private-key',url:'http://192.168.5.151:8082/v1',other:'preserve'};
 stored[1].data.url='http://custom-embedding.test/v1';
 let imports=0;
 await repairLocalCredentialUrls({credentials,backupDir:credentialDir,log:()=>{},run:async args=>{
  if(args[0]==='export:credentials'){
   const id=args.find(a=>a.startsWith('--id=')).slice(5);
   const current=stored.find(c=>c.id===id);
   const output=args.find(a=>a.startsWith('--output=')).slice(9);
   await fs.writeFile(output,JSON.stringify([{...current,data:args.includes('--decrypted')?current.data:'ENCRYPTED_BACKUP'}]));
  }else if(args[0]==='import:credentials'){
   const next=JSON.parse(await fs.readFile(args[1].slice(8),'utf8'))[0];
   Object.assign(stored.find(c=>c.id===next.id),next);imports++;
  }else assert.fail(args[0]);
 }});
 assert.equal(imports,1);
 assert.deepEqual(stored[0].data,{apiKey:'fixture-private-key',url:'http://voice-ai:8082/v1',other:'preserve'});
 assert.equal(stored[1].data.url,'http://custom-embedding.test/v1');
 const backups=await fs.readdir(credentialDir);assert.equal(backups.length,1);
 assert.equal(JSON.parse(await fs.readFile(path.join(credentialDir,backups[0]),'utf8'))[0].data,'ENCRYPTED_BACKUP');
 assert.equal((await fs.stat(path.join(credentialDir,backups[0]))).mode & 0o777,0o600);
}finally{await fs.rm(credentialDir,{recursive:true,force:true});}
console.log('PASS old bundled credential URL repair preserves API keys/custom settings and backs up encrypted credentials');

const {ensureWorkflowPublished}=await import('../../../examples/docker/agx-one-container/n8n/publish-workflow.mjs');
let publishedWorkflow={active:false,activeVersionId:null,versionId:'draft-1',name:'Preserve local edits'};
let publishCalls=0;
const publicationApi=async(route,body)=>{
 assert.ok(route.startsWith('/workflows/ivrWorkflow'));
 if(body!==undefined){assert.equal(route,'/workflows/ivrWorkflow/publish');publishCalls++;publishedWorkflow.active=true;publishedWorkflow.activeVersionId=publishedWorkflow.versionId;}
 return structuredClone(publishedWorkflow);
};
assert.equal(await ensureWorkflowPublished(publicationApi),true);
assert.equal(publishCalls,1);assert.equal(publishedWorkflow.name,'Preserve local edits');
assert.equal(await ensureWorkflowPublished(publicationApi),false);assert.equal(publishCalls,1);
publishedWorkflow.versionId='draft-2';
assert.equal(await ensureWorkflowPublished(publicationApi),true);assert.equal(publishCalls,2);
await assert.rejects(ensureWorkflowPublished(async()=>({active:false,versionId:'draft-1'})),/did not publish/);
const startupSteps=[];
const startupOptions={install:async()=>startupSteps.push('import'),upgradeTables:async()=>startupSteps.push('tables'),publish:async id=>{startupSteps.push(id);return true;},log:()=>{}};
await prepareStartupWorkflow({...startupOptions,autoPublish:true});assert.deepEqual(startupSteps,['import','tables',...managedWorkflowIds]);
startupSteps.length=0;await prepareStartupWorkflow({...startupOptions,autoPublish:false});assert.deepEqual(startupSteps,['import','tables']);
const publishRetryDir=await fs.mkdtemp(path.join(os.tmpdir(),'ivr-auto-publish-'));
try{
 const marker=path.join(publishRetryDir,'ready');let attempts=0,waits=0;
 await bootstrap({marker,log:()=>{},fetchImpl:async()=>({ok:true,json:async()=>({data:{userManagement:{showSetupOnFirstLoad:false}}})}),wait:async()=>{waits++;await assert.rejects(fs.access(marker));},install:()=>prepareStartupWorkflow({...startupOptions,autoPublish:true,publish:async()=>{if(++attempts===1)throw Error('temporary publication failure');return true;}})});
 assert.equal(attempts,1+managedWorkflowIds.length);assert.equal(waits,1);await fs.access(marker);
}finally{await fs.rm(publishRetryDir,{recursive:true,force:true});}
console.log('PASS default startup publication after imports/table upgrade, disabled mode, draft republishing, unchanged-version skip, preservation and retry before readiness');

// Document RAG keeps its shared endpoints after the split.
const localWorkflow=structuredClone(template);
localWorkflow.nodes.find(node=>node.id==='document-rag-embed-query').parameters.url='http://local-model.test/embedding';
const [splitMain,splitScenarios,splitRag]=splitManagedWorkflow(localWorkflow);
assert.equal(splitMain.id,'ivrWorkflow');
assert.equal(splitScenarios.nodes.find(node=>node.id==='scenario-file-import-webhook').parameters.path,'ivr-import-scenario');
assert.equal(splitRag.nodes.find(node=>node.id==='document-rag-embed-query').parameters.url,'http://local-model.test/embedding');
assert.equal(splitRag.nodes.filter(node=>node.parameters.url?.includes('collectionUrl')).length,5);
const request={scope:'a'.repeat(64),collection:'ivr_documents_'+ 'b'.repeat(16),dimensions:2048,documents:[],index:true};
const prepareRag=splitRag.nodes.find(node=>node.id==='document-rag-prepare');
const preparedRag=runInNewContext(`(function(){${prepareRag.parameters.jsCode}})()`,{
 $input:{first:()=>({json:{body:request}})},
})[0];
const ragUrl=id=>runInNewContext(splitRag.nodes.find(node=>node.id===id).parameters.url.slice(3,-2),{
 $:name=>{assert.equal(name,prepareRag.name);return {first:()=>preparedRag};},
});
assert.equal(ragUrl('document-rag-search'),'http://knowledge:6333/collections/'+request.collection+'/points/query');
assert.equal(ragUrl('document-rag-embed-documents'),'http://voice-ai:8088/embedding');
for (const workflow of [splitMain,splitScenarios,splitRag]) {
 const names=new Set(workflow.nodes.map(node=>node.name));
 for (const [name,outputs] of Object.entries(workflow.connections)) {
  assert.ok(names.has(name),name);
  for (const groups of Object.values(outputs)) for (const edges of groups) for (const edge of edges) assert.ok(names.has(edge.node),edge.node);
 }
}
console.log('PASS workflow split: every connection stays inside its workflow; Document RAG endpoints are configured');

const retiredUploadNodes=['scenario-upload-webhook','prepare-scenario-upload','create-scenario-qa',
 'index-scenario-qa','scenario-upload-response'].map(id=>({id,name:id,position:[0,0]}));
const oldAdmin=structuredClone(entities.get(scenarioAdminId));
oldAdmin.meta.ivrWorkflowRevision=25;
oldAdmin.nodes.find(node=>node.id==='scenario-file-import-webhook').position=[190,270];
oldAdmin.nodes.push(...retiredUploadNodes);
oldAdmin.pinData={...oldAdmin.pinData,'scenario-upload-webhook':[{}]};
oldAdmin.connections['scenario-upload-webhook']={main:[[{node:'prepare-scenario-upload',type:'main',index:0}]]};
const oldMonolith=structuredClone(template);
oldMonolith.nodes.push(...retiredUploadNodes);
oldMonolith.connections['scenario-upload-webhook']=oldAdmin.connections['scenario-upload-webhook'];
assert.ok(splitManagedWorkflow(oldMonolith).every(workflow=>workflow.nodes.every(node=>!retiredUploadNodes.some(old=>old.id===node.id))));
entities.set(scenarioAdminId,oldAdmin);
const adminBackupDir=await fs.mkdtemp(path.join(os.tmpdir(),'ivr-scenario-admin-'));
try{
 const previousMain=entities.get(template.id);
 await installMissing({templates,has,listWorkflows,run,backupDir:adminBackupDir,log:()=>{}});
 const admin=entities.get(scenarioAdminId);
 assert.equal(entities.get(template.id),previousMain);
 assert.equal(admin.meta.ivrWorkflowRevision,26);
 assert.equal(admin.nodes.length,10);
 assert.deepEqual(admin.nodes.find(node=>node.id==='scenario-file-import-webhook').position,[190,270]);
 assert.ok(!Object.hasOwn(admin.pinData,'scenario-upload-webhook'));
 assert.ok(!Object.hasOwn(admin.connections,'scenario-upload-webhook'));
 const [file]=await fs.readdir(adminBackupDir);
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(adminBackupDir,file),'utf8')),[oldAdmin]);
 await installMissing({templates,has,listWorkflows,run:async()=>assert.fail('migration must be idempotent'),backupDir:adminBackupDir,log:()=>{}});
}finally{await fs.rm(adminBackupDir,{recursive:true,force:true});}
console.log('PASS legacy upload removal preserves the current upload and local Scenario Admin edits');

// call_sessions gets each opening-answer column the first time a row needs it.
{
  const {createCallSessionColumns}=await import('../../../examples/docker/agx-one-container/n8n/scenario-workflows.mjs');
  const tables=[],calls=[];
  const api=async(route,body)=>{
    calls.push(route);
    if(route.startsWith('/data-tables?'))return {data:tables};
    if(route==='/data-tables'){const table={id:'t1',name:body.name,columns:body.columns};tables.push(table);return table;}
    if(route==='/data-tables/t1/columns'){if(!body)return tables[0].columns;tables[0].columns.push(body);return body;}
    throw new Error('unexpected '+route);
  };
  let clock=0;
  const ensure=createCallSessionColumns({withApi:async(scopes,run)=>run(api),now:()=>clock});
  await ensure(['session_id','date','supervisor_name']);
  assert.deepEqual(tables[0].columns.map(c=>c.name),['session_id','date','supervisor_name']);
  const before=calls.length;
  await ensure(['session_id','supervisor_name']);
  assert.equal(calls.length,before,'known columns need no API call');
  await ensure(['session_id','date','supervisor_name','employee_id_last3']);
  assert.deepEqual(tables[0].columns.map(c=>c.name),['session_id','date','supervisor_name','employee_id_last3']);
  clock=61000;tables.length=0;
  await ensure(['session_id','date']);
  assert.deepEqual(tables[0].columns.map(c=>c.name),['session_id','date'],'a deleted table is recreated after the cache expires');
  assert.throws(()=>ensure(['請問姓名']),/Invalid call_sessions columns/);
  console.log('PASS call_sessions: table and opening-answer columns created on first use');
}
