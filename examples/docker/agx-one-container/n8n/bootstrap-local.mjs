import {publishWorkflow} from './publish-workflow.mjs';
import {unpublishWorkflow,upgradeResultsColumn} from './unpublish-workflow.mjs';
import {createScenarioManager} from './scenario-workflows.mjs';
import {knowledgeToolsId, managedWorkflowIds, removeLegacyScenarioUpload, scenarioAdminId, splitManagedWorkflow} from './workflow-layout.mjs';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

async function runCli(args) {
  await new Promise((resolve, reject) => {
    const child = spawn('n8n', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const collect = data => { output = (output + data).slice(-8192); };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error(output || `n8n exited ${code}`)));
  });
}

// Export to a temporary file instead of trusting CLI exit codes: some n8n
// commands report a missing entity in their logs but still exit successfully.
export async function exists(kind, id, { run = runCli, files = fs } = {}) {
  const dir = await files.mkdtemp(path.join(os.tmpdir(), 'ivr-n8n-export-'));
  const output = path.join(dir, 'entity.json');
  try {
    await run([`export:${kind}`, `--id=${id}`, `--output=${output}`]);
    const data = JSON.parse(await files.readFile(output, 'utf8'));
    return (Array.isArray(data) ? data : [data]).some(entity => entity.id === id);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    if (/No (?:workflows|credentials) found/i.test(error.message)) return false;
    // Failed exports are retried by the outer loop, not mistaken for an empty DB.
    throw error;
  } finally {
    await files.rm(dir, { recursive: true, force: true });
  }
}

async function readWorkflowIndex({ run, files }) {
  const dir = await files.mkdtemp(path.join(os.tmpdir(), 'ivr-n8n-workflow-'));
  try {
    const output = path.join(dir, 'workflows.json');
    await run(['export:workflow', '--all', `--output=${output}`]);
    const data = JSON.parse(await files.readFile(output, 'utf8'));
    return new Map(data.map(workflow=>[workflow.id,workflow]));
  } catch (error) {
    if (error.code === 'ENOENT' || /No workflows found/i.test(error.message)) return new Map();
    throw error;
  } finally { await files.rm(dir, { recursive: true, force: true }); }
}

// Versioned upgrade: save the old flow first, preserve inference credentials and
// retrieval tuning, and replace the bundled behavior/layout/tool set together.
export function mergedWorkflowMigration(existing, rag, template) {
  if (!existing || existing.meta?.ivrWorkflowRevision>=(template.meta?.ivrWorkflowRevision??12)) return null;
  if (existing.meta?.ivrWorkflowRevision===23 && template.meta?.ivrWorkflowRevision===24) {
    const next=structuredClone(existing);
    for (const node of next.nodes) {
      const url=node.parameters?.url;
      if (node.id.startsWith('document-rag-') && typeof url==='string') {
        node.parameters.url=url.replace('http://qdrant:6333/', 'http://knowledge:6333/');
      }
    }
    next.meta.ivrWorkflowRevision=template.meta.ivrWorkflowRevision;
    return next;
  }
  if ([19,20,21,22].includes(existing.meta?.ivrWorkflowRevision) && template.meta?.ivrWorkflowRevision===24) {
    const next=structuredClone(existing);
    const changes={
      'prepare-ivr-input':'jsCode',
      'register-ivr-turn':'jsonBody',
      'ivr-return-fixed-reply':'jsCode',
      'prepare-ivr-output':'jsCode',
      'ivr-route-scenario-result':'conditions',
      'load-knowledge-files':'jsonBody',
    };
    for(const [id,key] of Object.entries(changes)){
      const node=next.nodes.find(candidate=>candidate.id===id);
      const source=template.nodes.find(candidate=>candidate.id===id);
      if(node&&source)node.parameters[key]=structuredClone(source.parameters[key]);
    }
    const webhook=template.nodes.find(node=>node.id==='scenario-report-input');
    if(!next.nodes.some(node=>node.id===webhook.id))next.nodes.push(structuredClone(webhook));
    next.connections[webhook.name]=structuredClone(template.connections[webhook.name]);
    const replaced=['prepare-guidance','retrieve-guidance','return-guidance','workflow-group-3'];
    const obsolete=['seed-simple-vector-store','default-document-loader','recursive-text-splitter','local-embeddings'];
    const removedNames=next.nodes.filter(node=>obsolete.includes(node.id)).map(node=>node.name);
    next.nodes=next.nodes.filter(node=>![...replaced,...obsolete].includes(node.id));
    next.nodes.push(...template.nodes.filter(node=>replaced.includes(node.id)).map(node=>structuredClone(node)));
    for(const name of removedNames)delete next.connections[name];
    for(const id of replaced){
      const name=template.nodes.find(node=>node.id===id).name;
      if(template.connections[name])next.connections[name]=structuredClone(template.connections[name]);
    }
    for(const node of template.nodes.filter(node=>node.id.startsWith('document-rag-'))){
      if(!next.nodes.some(existing=>existing.id===node.id))next.nodes.push(structuredClone(node));
      if(template.connections[node.name])next.connections[node.name]=structuredClone(template.connections[node.name]);
    }
    for(const value of Object.values(next.connections))for(const groups of Object.values(value)){
      for(const edges of groups)for(let index=edges.length-1;index>=0;index--)if(removedNames.includes(edges[index].node))edges.splice(index,1);
    }
    next.meta.ivrWorkflowRevision=template.meta.ivrWorkflowRevision;
    return next;
  }
  const next={...structuredClone(existing),...structuredClone(template),id:existing.id,active:existing.active};
  next.meta={...existing.meta,...template.meta};
  next.settings={...existing.settings,...template.settings};
  const sources=[...(rag?.nodes??[]),...existing.nodes];
  for(const node of next.nodes){
    const old=sources.find(n=>n.id===node.id||n.name===node.name);
    if(!old)continue;
    if(old.credentials)node.credentials=structuredClone(old.credentials);
    if(node.name==='Local Embeddings')node.parameters=structuredClone(old.parameters);
    if(node.name==='AI Agent'&&typeof old.parameters.text==='string')node.parameters.text=old.parameters.text;
    if(node.name==='Local Chat Model')node.parameters.options={...old.parameters.options,...node.parameters.options};
    if(node.name==='Retrieve guidance'&&old.type===node.type){
      node.parameters.topK=old.parameters.topK??node.parameters.topK;
      node.parameters.options={...old.parameters.options};
    }
    if(node.name==='Load knowledge files')node.parameters={...structuredClone(old.parameters),...node.parameters,url:old.parameters.url??node.parameters.url};
  }
  const embedding=next.nodes.find(n=>n.name==='Local Embeddings');
  if(/^http:\/\/192\.168\.5\.151:8084\/v1\/?$/.test(embedding?.parameters.options?.baseURL??''))embedding.parameters.options.baseURL='http://voice-ai:8084/v1';
  const legacyLookup=next.nodes.find(n=>n.name==='retrieve_knowledge');
  if(legacyLookup)legacyLookup.parameters.workflowId={__rl:true,value:next.id,mode:'id'};
  return next;
}

// Preserve the installed workflow's edits while assigning the new editor URL.
export function workflowIdMigration(existing, id) {
  const next=structuredClone(existing),previous=next.id;
  next.id=id;
  next.active=false;
  for(const key of ['versionId','activeVersionId','versionCounter','createdAt','updatedAt'])delete next[key];
  for(const node of next.nodes){
    const target=node.parameters?.workflowId;
    if(target===previous)node.parameters.workflowId=id;
    else if(target?.value===previous)target.value=id;
  }
  return next;
}

// Repair only the old bundled LAN endpoints; custom URLs and API keys survive.
export async function repairLocalCredentialUrls({credentials,run,files=fs,backupDir,log=console.log}) {
  const dir = await files.mkdtemp(path.join(os.tmpdir(), 'ivr-credential-upgrade-'));
  try {
    for (const credential of credentials) {
      const exported = path.join(dir, `${credential.id}.json`);
      await run(['export:credentials', `--id=${credential.id}`, '--decrypted', `--output=${exported}`]);
      const data = JSON.parse(await files.readFile(exported, 'utf8'));
      const current = (Array.isArray(data) ? data : [data]).find(c=>c.id===credential.id);
      if (!current || !/^http:\/\/192\.168\.5\.151:(8082|8084)\/v1\/?$/.test(current.data?.url ?? '')) continue;
      await files.mkdir(backupDir, {recursive:true});
      const backup = path.join(backupDir, `${credential.id}-before-url-${Date.now()}.json`);
      await run(['export:credentials', `--id=${credential.id}`, `--output=${backup}`]);
      await files.chmod(backup, 0o600);
      current.data.url = credential.data.url;
      await files.writeFile(exported, JSON.stringify([current]), {mode:0o600});
      await run(['import:credentials', `--input=${exported}`]);
      log(`[ivr-n8n] Updated bundled local endpoint for ${credential.name}; encrypted backup: ${backup}`);
    }
  } finally { await files.rm(dir, {recursive:true,force:true}); }
}

export async function importMissing({ templates = '/templates', run = runCli, has = exists, files = fs, log = console.log, listWorkflows = readWorkflowIndex, backupDir = '/home/node/.n8n/ivr-backups', repairCredentials = repairLocalCredentialUrls, retireWorkflow = unpublishWorkflow } = {}) {
  const credentials = JSON.parse(await files.readFile(path.join(templates, 'local-credentials.json'), 'utf8'));
  const template = JSON.parse(await files.readFile(path.join(templates, 'workflow.json'), 'utf8'));
  const missing = [];
  for (const credential of credentials) {
    if (!await has('credentials', credential.id, { run, files })) missing.push(credential);
  }
  if (missing.length) {
    log(`[ivr-n8n] Importing ${missing.length} missing local credential(s).`);
    const dir = await files.mkdtemp(path.join(os.tmpdir(), 'ivr-n8n-import-'));
    const input = path.join(dir, 'credentials.json');
    try {
      await files.writeFile(input, JSON.stringify(missing), { mode: 0o600 });
      await run(['import:credentials', `--input=${input}`]);
    } finally {
      await files.rm(dir, { recursive: true, force: true });
    }
  }
  let installed = await listWorkflows({run, files});
  const legacyId = 'ivrMaintenanceMcp';
  const legacy = installed.get(legacyId);
  const existing = installed.get(template.id) ?? legacy;
  const bundled = splitManagedWorkflow(template);
  const changes = bundled.filter(workflow =>
    (installed.get(workflow.id)?.meta?.ivrWorkflowRevision ?? 0) < workflow.meta.ivrWorkflowRevision);
  let backup;
  const workflows = changes.map(workflow => {
    const old = installed.get(workflow.id) ?? (workflow.id===template.id ? existing : undefined);
    if (workflow.id===scenarioAdminId && old) {
      return removeLegacyScenarioUpload(old) ?? {...old,meta:{...old.meta,...workflow.meta}};
    }
    const replacement = old && mergedWorkflowMigration(old, null, workflow);
    if (!replacement) return workflow;
    return replacement.id === workflow.id ? replacement : workflowIdMigration(replacement, workflow.id);
  });
  const prior = changes.map(workflow => installed.get(workflow.id) ?? (workflow.id === template.id ? existing : undefined)).filter(Boolean);
  if (prior.length) {
    await files.mkdir(backupDir, {recursive:true});
    backup = path.join(backupDir, `merged-workflow-${Date.now()}.json`);
    await files.writeFile(backup, JSON.stringify(prior), {mode:0o600});
    await repairCredentials({credentials,run,files,backupDir,log});
  }

  const scenarioAdmin = installed.get(scenarioAdminId);
  const updatedAdmin = scenarioAdmin && !changes.some(workflow=>workflow.id===scenarioAdminId) &&
    removeLegacyScenarioUpload(scenarioAdmin);
  if (updatedAdmin) {
    await files.mkdir(backupDir, {recursive:true});
    const adminBackup = path.join(backupDir, `scenario-admin-${Date.now()}.json`);
    await files.writeFile(adminBackup, JSON.stringify(scenarioAdmin), {mode:0o600});
    workflows.push(updatedAdmin);
    log(`[ivr-n8n] Backed up Scenario Admin before removing the legacy upload: ${adminBackup}`);
  }

  if (workflows.length) {
    // Import the main workflow last so an interrupted import can resume safely.
    const ordered = [...workflows.filter(workflow=>workflow.id!==template.id), ...workflows.filter(workflow=>workflow.id===template.id)];
    const dir = await files.mkdtemp(path.join(os.tmpdir(), 'ivr-workflow-import-'));
    try {
      const input = path.join(dir, 'workflows.json');
      await files.writeFile(input, JSON.stringify(ordered), {mode:0o600});
      await run(['import:workflow', `--input=${input}`]);
    } finally { await files.rm(dir, {recursive:true,force:true}); }
    installed = await listWorkflows({run, files});
    for (const workflow of workflows) {
      if (installed.get(workflow.id)?.meta?.ivrWorkflowRevision !== workflow.meta.ivrWorkflowRevision)
        throw new Error(`Workflow import incomplete: ${workflow.name}`);
    }
    log(`[ivr-n8n] Imported ${workflows.map(workflow=>workflow.name).join(', ')}.${backup ? ' Backup: '+backup : ''}`);
  }

  // Revision 30 runs calls in the knowledge service; unpublish the old
  // Knowledge Tools sub-workflow (kept, with its edits, for reference).
  const tools = installed.get(knowledgeToolsId);
  if (tools && (tools.active || tools.activeVersionId)) {
    await files.mkdir(backupDir,{recursive:true});
    await files.writeFile(path.join(backupDir,`knowledge-tools-${Date.now()}.json`),JSON.stringify(tools),{mode:0o600});
    await retireWorkflow(knowledgeToolsId);
    log(`[ivr-n8n] Unpublished ${knowledgeToolsId}; the IVR engine in the knowledge service replaces it.`);
  }

  if (legacy && (legacy.active || legacy.activeVersionId)) {
    if (!installed.has(template.id)) throw new Error('Cannot retire the legacy workflow before the new workflow exists');
    if (!backup || existing?.id !== legacyId) {
      await files.mkdir(backupDir,{recursive:true});
      await files.writeFile(path.join(backupDir,`legacy-workflow-id-${Date.now()}.json`),JSON.stringify(legacy),{mode:0o600});
    }
    await retireWorkflow(legacyId);
    log(`[ivr-n8n] Unpublished ${legacyId} to release its old routes.`);
  }
  for (const credential of credentials) {
    if (!await has('credentials', credential.id, { run, files })) throw new Error(`Credential import incomplete: ${credential.name}`);
  }
}

export async function prepareStartupWorkflow({
  install=importMissing,
  upgradeTables=async()=>{
    await upgradeResultsColumn();
    const scenarios=createScenarioManager();
    await scenarios.repairDispatchDates();
  },
  publish=publishWorkflow,
  autoPublish=process.env.N8N_AUTO_PUBLISH_WORKFLOW!=='false',
  log=console.log,
}={}){
  await install();
  await upgradeTables();
  if(autoPublish){
    for (const id of managedWorkflowIds) {
      if (await publish(id)) log(`[ivr-n8n] Published /workflow/${id}.`);
    }
  }else log('[ivr-n8n] Automatic publishing disabled. Publish GeoVision · Workflow, Scenario Admin and Document RAG.');
}

export async function bootstrap({
  marker = '/home/node/.n8n/.ivr-scenario-1-installed',
  fetchImpl = fetch,
  wait = delay,
  install = importMissing,
  files = fs,
  log = console.log,
} = {}) {
  // A marker alone cannot prove the workflow still exists (for example, after
  // a database restore). Verify missing entities each boot, preserving edits.
  log('[ivr-n8n] Verifying Scenario 1 workflow and local credentials.');
  let waitingForOwner = false;
  for (;;) {
    try {
      const response = await fetchImpl('http://127.0.0.1:5678/rest/settings', { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`n8n settings HTTP ${response.status}`);
      const result = await response.json();
      const management = (result.data ?? result).userManagement;
      if (management?.showSetupOnFirstLoad !== false) {
        if (!waitingForOwner) log('[ivr-n8n] Complete owner account setup in the editor; Scenario 1 will then import automatically.');
        waitingForOwner = true;
      } else {
        log('[ivr-n8n] Owner account is ready; checking the n8n database.');
        await install();
        await files.writeFile(marker, 'Scenario 1 and local credentials imported\n', { mode: 0o600 });
        log('[ivr-n8n] Scenario 1 is ready. Existing edits were preserved. GeoVision · Workflow: /workflow/ivrWorkflow.');
        return;
      }
    } catch (error) {
      log(`[ivr-n8n] Waiting to import Scenario 1: ${error.message}`);
    }
    await wait(10000);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  bootstrap({install:prepareStartupWorkflow}).catch(error => { console.error('[ivr-n8n] Bootstrap failed:', error.message); process.exitCode = 1; });
}
