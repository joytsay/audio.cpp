import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runInNewContext} from 'node:vm';
import {bootstrap,importMissing,exists,mergedWorkflowMigration,repairLocalCredentialUrls,workflowIdMigration,prepareStartupWorkflow} from '../../../examples/docker/agx-one-container/n8n/bootstrap-local.mjs';
import {knowledgeToolsId,managedWorkflowIds,scenarioAdminId,splitManagedWorkflow,workflowLayoutRevision} from '../../../examples/docker/agx-one-container/n8n/workflow-layout.mjs';
const templates=new URL('../../../examples/docker/agx-one-container/n8n',import.meta.url).pathname;
const realImportMissing=importMissing;
const retired=[];
const installMissing=options=>realImportMissing({repairCredentials:async()=>{},retireWorkflow:async id=>{retired.push(id);entities.set(id,{...entities.get(id),active:false,activeVersionId:null});},...options});
const readTemplate=async name=>JSON.parse(await fs.readFile(path.join(templates,name),'utf8'));
const credentials=await readTemplate('local-credentials.json');
const template=await readTemplate('workflow.json');
const mcp=await readTemplate('maintenance-mcp-tools.json');
const rag=await readTemplate('maintenance-knowledge-rag.json');
const entities=new Map([[credentials[0].id,credentials[0]]]);
const imports=[];
const run=async args=>{
 imports.push(args[0]);
 const data=JSON.parse(await fs.readFile(args[1].slice('--input='.length),'utf8'));
 for(const entity of Array.isArray(data)?data:[data])entities.set(entity.id,entity);
};
const has=async(_kind,id)=>entities.has(id);
const listWorkflows=async()=>new Map([...entities].filter(([,entity])=>Array.isArray(entity.nodes)));
await installMissing({templates,has,listWorkflows,run,log:()=>{}});
assert.deepEqual(imports,['import:credentials','import:workflow']);
assert.equal(entities.get(template.id).name,'GeoVision · Workflow');
assert.ok(!entities.has(rag.id),'new installs omit legacy workflows');
assert.ok(managedWorkflowIds.every(id=>entities.has(id)));
const installedMain=entities.get(template.id);
assert.equal(installedMain.nodes.length,16);
assert.equal(installedMain.meta.ivrWorkflowRevision,workflowLayoutRevision);
assert.equal(entities.get(knowledgeToolsId).nodes.find(n=>n.name==='retrieve_knowledge').parameters.workflowId.value,knowledgeToolsId);
await installMissing({templates,has,listWorkflows,run:async()=>assert.fail('preserve existing unified edits'),log:()=>{}});
await assert.rejects(installMissing({templates,has:async()=>false,listWorkflows:async()=>new Map(),run:async()=>{},log:()=>{}}),/import incomplete/);
assert.equal(await exists('workflow','missing',{run:async()=>{throw Error('No workflows found');}}),false);
await assert.rejects(exists('workflow','missing',{run:async()=>{throw Error('database unavailable');}}),/database unavailable/);

const directory=await fs.mkdtemp(path.join(os.tmpdir(),'ivr-unified-migration-'));
try {
 const oldRag=structuredClone(rag),oldMcp=structuredClone(mcp);
 oldRag.nodes.find(n=>n.name==='Local Embeddings').credentials.openAiApi.id='custom-embeddings';
 oldRag.nodes.find(n=>n.name==='Retrieve guidance').parameters.topK=7;
 oldMcp.nodes.push({id:'custom-tool',name:'Custom read-only tool',type:'@n8n/n8n-nodes-langchain.toolCode',position:[0,0],parameters:{jsCode:'return "custom";'}});
 oldMcp.connections['Custom read-only tool']={ai_tool:[[{node:'Maintenance MCP Server',type:'ai_tool',index:0}]]};
 oldMcp.active=true;
 entities.delete(template.id);
 entities.set(mcp.id,oldMcp);entities.set(rag.id,oldRag);
 imports.length=0;
 await installMissing({templates,has,listWorkflows,run,backupDir:directory,log:()=>{}});
 assert.deepEqual(imports,['import:workflow']);
 const merged=entities.get(template.id);
 const tools=entities.get(knowledgeToolsId);
 assert.equal(merged.id,'ivrWorkflow');
 assert.deepEqual(retired,[mcp.id]);
 assert.equal(entities.get(mcp.id).active,false);
 assert.ok(!merged.nodes.some(n=>n.name==='Local Embeddings'));
 assert.equal(tools.nodes.find(n=>n.name==='Retrieve guidance').parameters.url,'http://knowledge:8085/rag');
 assert.ok(!merged.nodes.some(n=>n.name==='Custom read-only tool'),'requested two-tool set removes old tools');
 assert.deepEqual(tools.connections.retrieve_knowledge.ai_tool[0].map(e=>e.node),['Scenario MCP']);
 assert.equal(tools.nodes.find(n=>n.name==='retrieve_knowledge').parameters.workflowId.value,knowledgeToolsId);
 assert.equal(merged.name,'GeoVision · Workflow');
 assert.equal(merged.nodes.filter(n=>n.type==='n8n-nodes-base.stickyNote').length,1);
 assert.equal(new Set(merged.nodes.map(n=>n.id)).size,merged.nodes.length);
 assert.deepEqual(entities.get(rag.id),oldRag,'legacy source remains recoverable');
 const backups=await fs.readdir(directory);assert.equal(backups.length,1);
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory,backups[0]),'utf8')),{mcp:oldMcp,rag:oldRag});
 assert.equal(mergedWorkflowMigration(merged,null,template),null);
 await installMissing({templates,has,listWorkflows,run:async()=>assert.fail('migration must be idempotent'),log:()=>{}});
 const onlyMcp=mergedWorkflowMigration(mcp,null,template);
 assert.ok(onlyMcp.nodes.some(n=>n.name==='Return guidance'),'missing legacy RAG uses bundled RAG');
 const marker=path.join(directory,'installed');
 let calls=0,installs=0,waits=0;
 await bootstrap({marker,log:()=>{},fetchImpl:async()=>({ok:true,json:async()=>({data:{userManagement:{showSetupOnFirstLoad:++calls===1}}})}),wait:async()=>{waits++;},install:async()=>{if(++installs===1)throw Error('database busy');}});
 assert.equal(calls,3);assert.equal(installs,2);assert.equal(waits,2);await fs.access(marker);
 let repaired=false;
 await bootstrap({marker,log:()=>{},fetchImpl:async()=>({ok:true,json:async()=>({data:{userManagement:{showSetupOnFirstLoad:false}}})}),install:async()=>{repaired=true;}});
 assert.ok(repaired,'marker cannot suppress verification');
} finally {await fs.rm(directory,{recursive:true,force:true});}
const previousMerged=structuredClone(template);
previousMerged.meta.ivrWorkflowRevision=1;
previousMerged.nodes=previousMerged.nodes.filter(n=>n.id!=='retrieve-ivr-turn');
previousMerged.nodes.push(structuredClone(rag.nodes.find(n=>n.name==='Local Embeddings')));
previousMerged.nodes.find(n=>n.name==='Retrieve guidance').parameters.topK=9;
previousMerged.nodes.find(n=>n.name==='Local Chat Model').parameters.options.maxTokens=2048;
const updatedMerged=mergedWorkflowMigration(previousMerged,null,template);
assert.ok(updatedMerged.nodes.some(n=>n.id==='retrieve-ivr-turn'));
assert.ok(!updatedMerged.nodes.some(n=>n.name==='Local Embeddings'));
assert.equal(updatedMerged.nodes.find(n=>n.name==='Retrieve guidance').parameters.method,'POST');
assert.equal(updatedMerged.nodes.find(n=>n.name==='Local Chat Model').parameters.options.maxTokens,160);
assert.equal(mergedWorkflowMigration(updatedMerged,null,template),null);
const installedOldId=structuredClone(template);
installedOldId.id=mcp.id;
installedOldId.active=true;
installedOldId.activeVersionId='previous-published-version';
installedOldId.versionId='previous-draft-version';
installedOldId.nodes.find(n=>n.name==='retrieve_knowledge').parameters.workflowId.value=mcp.id;
installedOldId.nodes.find(n=>n.name==='AI Agent').parameters.options.maxIterations=2;
const renamed=workflowIdMigration(installedOldId,template.id);
assert.equal(renamed.id,'ivrWorkflow');
assert.equal(renamed.active,false);
assert.ok(!('activeVersionId' in renamed)&&!('versionId' in renamed));
assert.equal(renamed.nodes.find(n=>n.name==='retrieve_knowledge').parameters.workflowId.value,'ivrWorkflow');
assert.equal(renamed.nodes.find(n=>n.name==='AI Agent').parameters.options.maxIterations,2);
assert.equal(installedOldId.id,mcp.id,'original workflow is untouched');
const renameDir=await fs.mkdtemp(path.join(os.tmpdir(),'ivr-workflow-id-test-'));
try{
 entities.delete(template.id);entities.set(mcp.id,installedOldId);
 imports.length=0;retired.length=0;
 await installMissing({templates,has,listWorkflows,run,backupDir:renameDir,log:()=>{}});
 assert.equal(entities.get(template.id).nodes.find(n=>n.name==='AI Agent').parameters.options.maxIterations,2,'ID migration preserves current-revision user edits');
 assert.deepEqual(retired,[mcp.id]);
 await installMissing({templates,has,listWorkflows,run:async()=>assert.fail('rename must be idempotent'),backupDir:renameDir,log:()=>{}});
 // An interrupted retirement must resume without overwriting target edits.
 entities.set(mcp.id,installedOldId);
 entities.get(template.id).name='Custom installed title';
 await installMissing({templates,has,listWorkflows,run:async()=>assert.fail('preserve existing target'),backupDir:renameDir,log:()=>{}});
 assert.equal(entities.get(template.id).name,'Custom installed title');
 assert.deepEqual(retired,[mcp.id,mcp.id]);
}finally{await fs.rm(renameDir,{recursive:true,force:true});}
console.log('PASS workflow ID migration: preserved edits, rebound self-reference, released legacy routes, retry and idempotence');
const revisionTwo=structuredClone(template);revisionTwo.meta.ivrWorkflowRevision=2;
assert.equal(mergedWorkflowMigration(revisionTwo,null,template).meta.ivrWorkflowRevision,template.meta.ivrWorkflowRevision,'existing revision 2 must receive the routing/save fixes');
const revisionThree=structuredClone(template);revisionThree.meta.ivrWorkflowRevision=3;
assert.equal(mergedWorkflowMigration(revisionThree,null,template).meta.ivrWorkflowRevision,template.meta.ivrWorkflowRevision,'revision 3 upgrades to native Data Table intake');
const revisionFour=structuredClone(template);revisionFour.meta.ivrWorkflowRevision=4;
assert.equal(mergedWorkflowMigration(revisionFour,null,template).meta.ivrWorkflowRevision,template.meta.ivrWorkflowRevision,'revision 4 upgrades to one-question Data Table saving');
console.log('PASS workflow bootstrap, legacy backups, MCP tool bindings, retry and idempotence');

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

const {repairTableRow}=await import('../../../examples/docker/agx-one-container/n8n/unpublish-workflow.mjs');
const repaired=repairTableRow({order_id:'GV-F0FF402E0DED',reference_number:'',dispatch_date:'2026-11-12',transcripts:JSON.stringify(['回要回報工單。','2026年11月12號 A >一二三四五。']),createdAt:'2026-11-11T23:16:41.115Z'});
assert.equal(repaired.reference_number,'A12345');
assert.equal(JSON.parse(repaired.results).fields.派工單號,'A12345');
console.log('PASS existing CSV row repair recovers spaced work-order number without changing internal ID');

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

const revisionTen=structuredClone(template);revisionTen.meta.ivrWorkflowRevision=10;
revisionTen.nodes=revisionTen.nodes.filter(n=>!['Fixed reply?','Return fixed reply'].includes(n.name));
const intakeUpgrade=mergedWorkflowMigration(revisionTen,null,template);
assert.ok(intakeUpgrade.nodes.some(n=>n.name==='Return fixed reply'));
assert.equal(intakeUpgrade.connections['Register caller turn'].main[0][0].node,'Fixed reply?');
assert.equal(mergedWorkflowMigration(intakeUpgrade,null,template),null);

const revisionEleven=structuredClone(template);revisionEleven.meta.ivrWorkflowRevision=11;
revisionEleven.nodes=revisionEleven.nodes.filter(n=>n.name!=='Remove uploaded scenario');
const removalUpgrade=mergedWorkflowMigration(revisionEleven,null,template);
assert.equal(removalUpgrade.meta.ivrWorkflowRevision,template.meta.ivrWorkflowRevision);
assert.ok(removalUpgrade.nodes.some(n=>n.name==='Remove uploaded scenario'));
assert.equal(mergedWorkflowMigration(removalUpgrade,null,template),null);

const revisionNineteen=structuredClone(template);revisionNineteen.meta.ivrWorkflowRevision=19;
revisionNineteen.nodes.find(n=>n.name==='AI Agent').parameters.text='custom caller prompt';
const htmlUpgrade=mergedWorkflowMigration(revisionNineteen,null,template);
assert.equal(htmlUpgrade.nodes.find(n=>n.name==='AI Agent').parameters.text,'custom caller prompt');
assert.equal(mergedWorkflowMigration(htmlUpgrade,null,template),null);
const revisionTwenty=structuredClone(revisionNineteen);revisionTwenty.meta.ivrWorkflowRevision=20;
revisionTwenty.nodes=revisionTwenty.nodes.filter(n=>n.id!=='scenario-report-input');
delete revisionTwenty.connections['Scenario Report Input'];
revisionTwenty.nodes.find(n=>n.id==='ivr-route-scenario-result').parameters.conditions.conditions[0].leftValue='old condition';
const scenarioUpgrade=mergedWorkflowMigration(revisionTwenty,null,template);
assert.equal(scenarioUpgrade.connections['Scenario Report Input'].main[0][0].node,'Prepare IVR input');
assert.match(scenarioUpgrade.nodes.find(n=>n.id==='ivr-route-scenario-result').parameters.conditions.conditions[0].leftValue,/scenarioReport/);
assert.equal(scenarioUpgrade.nodes.find(n=>n.name==='AI Agent').parameters.text,'custom caller prompt');
assert.equal(mergedWorkflowMigration(scenarioUpgrade,null,template),null);
const revisionTwentyTwo=structuredClone(template);
revisionTwentyTwo.meta.ivrWorkflowRevision=22;
revisionTwentyTwo.nodes=revisionTwentyTwo.nodes.filter(node=>!node.id.startsWith('document-rag-'));
for(const node of template.nodes.filter(node=>node.id.startsWith('document-rag-')))delete revisionTwentyTwo.connections[node.name];
const persistentUpgrade=mergedWorkflowMigration(revisionTwentyTwo,null,template);
assert.equal(persistentUpgrade.connections['Document RAG input'].main[0][0].node,'Prepare document RAG');
assert.ok(persistentUpgrade.nodes.some(node=>node.name==='Save vectors in Qdrant'));
assert.equal(mergedWorkflowMigration(persistentUpgrade,null,template),null);

const revisionTwentyThree=structuredClone(template);
revisionTwentyThree.meta.ivrWorkflowRevision=23;
const bundledQdrant=revisionTwentyThree.nodes.filter(node=>node.parameters?.url?.includes('http://knowledge:6333/'));
assert.equal(bundledQdrant.length,5);
for (const node of bundledQdrant) {
  node.parameters.url=node.parameters.url.replace('http://knowledge:6333/', 'http://qdrant:6333/');
  node.parameters.options={...node.parameters.options,timeout:12345};
}
const bundledUpgrade=mergedWorkflowMigration(revisionTwentyThree,null,template);
assert.equal(bundledUpgrade.meta.ivrWorkflowRevision,24);
assert.deepEqual(bundledUpgrade.connections,revisionTwentyThree.connections);
for (const node of bundledQdrant) {
  const updated=bundledUpgrade.nodes.find(candidate=>candidate.id===node.id);
  assert.equal(updated.parameters.url,template.nodes.find(candidate=>candidate.id===node.id).parameters.url);
  assert.equal(updated.parameters.options.timeout,12345);
}
assert.equal(mergedWorkflowMigration(bundledUpgrade,null,template),null);

const localWorkflow=structuredClone(template);
const scenarioTool={id:'scenario-file-fixture',name:'Local scenario',position:[990,100],type:'@n8n/n8n-nodes-langchain.toolWorkflow',parameters:{workflowId:{value:'local-scenario-workflow'}}};
localWorkflow.nodes.push(scenarioTool);
localWorkflow.connections[scenarioTool.name]={ai_tool:[[{node:'Scenario MCP',type:'ai_tool',index:0}]]};
localWorkflow.nodes.find(node=>node.name==='Local Chat Model').parameters.options.temperature=0.42;
localWorkflow.nodes.find(node=>node.id==='document-rag-embed-query').parameters.url='http://local-model.test/embedding';
const [splitMain,splitTools,splitScenarios,splitRag]=splitManagedWorkflow(localWorkflow);
assert.equal(splitMain.nodes.find(node=>node.name==='Local Chat Model').parameters.options.temperature,0.42);
assert.equal(splitTools.nodes.find(node=>node.id===scenarioTool.id).parameters.workflowId.value,'local-scenario-workflow');
assert.deepEqual(splitTools.connections[scenarioTool.name],localWorkflow.connections[scenarioTool.name]);
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
for (const workflow of [splitMain,splitTools,splitScenarios,splitRag]) {
 const names=new Set(workflow.nodes.map(node=>node.name));
 for (const [name,outputs] of Object.entries(workflow.connections)) {
  assert.ok(names.has(name));
  for (const groups of Object.values(outputs)) for (const edges of groups) for (const edge of edges) assert.ok(names.has(edge.node));
 }
}

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
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(adminBackupDir,file),'utf8')),oldAdmin);
 await installMissing({templates,has,listWorkflows,run:async()=>assert.fail('migration must be idempotent'),backupDir:adminBackupDir,log:()=>{}});
}finally{await fs.rm(adminBackupDir,{recursive:true,force:true});}
console.log('PASS legacy upload removal preserves the current upload and local Scenario Admin edits');
