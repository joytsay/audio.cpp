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

async function readWorkflow(id, { run, files }) {
  const dir = await files.mkdtemp(path.join(os.tmpdir(), 'ivr-n8n-workflow-'));
  try {
    const output = path.join(dir, 'workflow.json');
    await run(['export:workflow', `--id=${id}`, `--output=${output}`]);
    const data = JSON.parse(await files.readFile(output, 'utf8'));
    const workflow = (Array.isArray(data) ? data : [data]).find(item => item.id === id);
    if (!workflow) throw new Error('Cannot read the existing knowledge workflow for migration');
    return workflow;
  } finally { await files.rm(dir, { recursive: true, force: true }); }
}

// Upgrade only the bundled source wiring, leaving model credentials and other
// settings intact. Every migration is backed up and requires republishing.
export function promptSourceMigration(existing, template) {
  if (!existing) return null;
  if (existing.nodes.some(node => node.name === 'Load knowledge files')) {
    const prepare=existing.nodes.find(node=>node.name==='Prepare guidance');
    if (!prepare) return null;
    const testNames=['Test RAG','Test query','Validate query'];
    if (testNames.every(name=>existing.nodes.some(node=>node.name===name))) return null;
    const next=structuredClone(existing);
    const codeNode=next.nodes.find(node=>node.name==='Prepare guidance');
    const original=codeNode.parameters.jsCode || '';
    const replaced=original.replace(/\$\(['"]RAG tool input['"]\)\.first\(\)\.json\.query/g,"$('Validate query').first().json.query");
    codeNode.parameters.jsCode=replaced===original && !original.includes("$('Validate query')")
      ? original.replace(/^const query\s*=[^\n]*;/m,"const query = $('Validate query').first().json.query;") : replaced;
    for (const name of testNames)
      if (!next.nodes.some(node=>node.name===name)) next.nodes.push(structuredClone(template.nodes.find(node=>node.name===name)));
    for (const name of ['Test RAG','Test query','RAG tool input','Validate query'])
      next.connections[name]=structuredClone(template.connections[name]);
    for (const node of next.nodes) {
      const bundled=template.nodes.find(candidate=>candidate.name===node.name);
      if(bundled)node.position=structuredClone(bundled.position);
    }
    return next;
  }
  const prepare = existing.nodes.find(node => node.id === 'prepare-guidance');
  if (!prepare || !/knowledge:|knowledgeSource/.test(prepare.parameters?.jsCode || '')) return null;
  const next = structuredClone(existing);
  next.nodes = next.nodes.filter(node => !['read-prompt-csv','decode-prompt-text'].includes(node.id));
  next.nodes.find(node => node.id === 'prepare-guidance').parameters.jsCode =
    template.nodes.find(node => node.id === 'prepare-guidance').parameters.jsCode;
  next.nodes.push(structuredClone(template.nodes.find(node => node.id === 'load-knowledge-files')));
  for (const name of ['Read prompt.csv','Decode prompt text']) delete next.connections[name];
  for (const id of ['manual-rag-test','rag-test-query','validate-rag-query'])
    if (!next.nodes.some(node=>node.id===id)) next.nodes.push(structuredClone(template.nodes.find(node=>node.id===id)));
  for (const name of ['Test RAG','Test query','RAG tool input','Validate query','Load knowledge files']) next.connections[name] = structuredClone(template.connections[name]);
  next.nodes.find(node => node.name === 'Return guidance').parameters.jsCode =
    template.nodes.find(node => node.name === 'Return guidance').parameters.jsCode;
  next.settings = {...next.settings, executionTimeout:300};
  return next;
}

// Remove the discarded CRUD toolbox from existing installations, with the
// standard import path below backing up the previous workflow first.
export function readOnlyMcpMigration(existing, template) {
  if(!existing)return null;
  const names=new Set(['create_work_order','read_work_order','update_work_order','delete_work_order','get_work_order','replace_work_order','list_work_orders']);
  const removed=new Set(existing.nodes.filter(node=>names.has(node.name)||names.has(node.parameters?.name)).map(node=>node.name));
  const trigger=existing.nodes.find(node=>node.type==='@n8n/n8n-nodes-langchain.mcpTrigger');
  const staleInstructions=/CRUD|create_work_order|update_work_order|delete_work_order/.test(trigger?.parameters.instructions||'');
  if(!removed.size&&!staleInstructions)return null;
  const next=structuredClone(existing);
  next.nodes=next.nodes.filter(node=>!removed.has(node.name));
  for(const name of removed)delete next.connections[name];
  for(const outputs of Object.values(next.connections))for(const [type,groups] of Object.entries(outputs))outputs[type]=groups.map(edges=>edges.filter(edge=>!removed.has(edge.node)));
  for(const node of next.nodes){
    const source=template.nodes.find(n=>n.name===node.name||n.type==='@n8n/n8n-nodes-langchain.mcpTrigger'&&n.type===node.type);
    if(source && node.type==='@n8n/n8n-nodes-langchain.mcpTrigger')node.parameters.instructions=source.parameters.instructions;
    if(source && node.name==='lookup_maintenance_guidance')node.parameters.description=source.parameters.description;
    if(source && node.type==='n8n-nodes-base.stickyNote')node.parameters.content=source.parameters.content;
  }
  return next;
}

export function originalSourceMigration(existing) {
  if(!existing)return null;
  const text=JSON.stringify(existing);
  if(!text.includes('ivrDataBase.csv')&&!text.includes('all CSV worksheets')&&!text.includes('use list_work_orders for the complete dispatch list.'))return null;
  return JSON.parse(text.replaceAll('ivrDataBase.csv','CSD資料庫.xlsx').replaceAll('all CSV worksheets','all XLSX worksheets').replaceAll('use list_work_orders for the complete dispatch list.','do not claim a complete dispatch list from these passages.'));
}

export function resultWorkflowMigration(existing,template){
  if(!existing)return null;
  const names=['Load knowledge files','Prepare guidance','Return guidance'];
  if(names.some(name=>!existing.nodes.some(n=>n.name===name)))return null;
  const load=existing.nodes.find(n=>n.name===names[0]);
  const prep=existing.nodes.find(n=>n.name===names[1]);
  const ret=existing.nodes.find(n=>n.name===names[2]);
  if(load.parameters.sendQuery&&load.parameters.queryParameters?.parameters?.some(p=>p.name==='query'&&p.value==='={{ $json.query }}')&&prep.parameters.jsCode.includes('const result = $input.first().json.result')&&ret.parameters.jsCode.includes('if (prepared.result)'))return null;
  const next=structuredClone(existing);
  const target=next.nodes.find(n=>n.name===names[0]).parameters;
  target.sendQuery=true;
  target.queryParameters??={parameters:[]};
  target.queryParameters.parameters=target.queryParameters.parameters.filter(p=>p.name!=='query');
  target.queryParameters.parameters.push({name:'query',value:'={{ $json.query }}'});
  for(const name of names.slice(1))next.nodes.find(n=>n.name===name).parameters.jsCode=template.nodes.find(n=>n.name===name).parameters.jsCode;
  return next;
}

export async function importMissing({ templates = '/templates', run = runCli, has = exists, files = fs, log = console.log, read = readWorkflow, backupDir = '/home/node/.n8n/ivr-backups' } = {}) {
  const credentials = JSON.parse(await files.readFile(path.join(templates, 'local-credentials.json'), 'utf8'));
  const workflows = [];
  for (const name of ['maintenance-knowledge-rag.json', 'maintenance-mcp-tools.json']) {
    const file = path.join(templates, name);
    workflows.push({ file, data: JSON.parse(await files.readFile(file, 'utf8')) });
  }
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
  for (const workflow of workflows) {
    if (!await has('workflow', workflow.data.id, { run, files })) {
      log(`[ivr-n8n] Importing workflow: ${workflow.data.name} (${workflow.data.id}).`);
      await run(['import:workflow', `--input=${workflow.file}`]);
    } else if (['ivrMaintenanceKnowledge','ivrMaintenanceMcp'].includes(workflow.data.id)) {
      const existing = await read(workflow.data.id, { run, files });
      const migrate = workflow.data.id === 'ivrMaintenanceKnowledge' ? promptSourceMigration : readOnlyMcpMigration;
      let next = migrate(existing, workflow.data);
      if(workflow.data.id==='ivrMaintenanceKnowledge')next=resultWorkflowMigration(next??existing,workflow.data)??next;
      next = originalSourceMigration(next ?? existing) ?? next;
      const oldNames = {
        ivrMaintenanceMcp: ['IVR Maintenance MCP Tools', 'GeoVision · IVR · MCP'],
        ivrMaintenanceKnowledge: ['IVR Maintenance Knowledge · RAG Tool', 'GeoVision · IVR · RAG'],
      };
      if (existing && oldNames[workflow.data.id]?.includes(existing.name)) {
        next ??= structuredClone(existing);
        next.name = workflow.data.name;
      }
      if (next) {
        await files.mkdir(backupDir, { recursive: true });
        const backup = path.join(backupDir, `${workflow.data.id}-before-files-${Date.now()}.json`);
        await files.writeFile(backup, JSON.stringify(existing), { mode: 0o600 });
        const dir = await files.mkdtemp(path.join(os.tmpdir(), 'ivr-rag-upgrade-'));
        try {
          const input = path.join(dir, 'workflow.json');
          await files.writeFile(input, JSON.stringify(next), { mode: 0o600 });
          await run(['import:workflow', `--input=${input}`]);
        } finally { await files.rm(dir, { recursive: true, force: true }); }
        const installed = await read(workflow.data.id, { run, files });
        if (migrate(installed, workflow.data)) throw new Error('Knowledge files migration did not complete');
        log(`[ivr-n8n] Updated ${workflow.data.name} for local knowledge files. Previous workflow saved to ${backup}. Republish the updated workflow.`);
      }
    }
  }
  for (const credential of credentials) {
    if (!await has('credentials', credential.id, { run, files })) throw new Error(`Credential import incomplete: ${credential.name}`);
  }
  for (const workflow of workflows) {
    if (!await has('workflow', workflow.data.id, { run, files })) throw new Error(`Workflow import incomplete: ${workflow.data.name}`);
  }
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
        log('[ivr-n8n] Scenario 1 is ready. Existing edits were preserved. Publish /workflow/ivrMaintenanceKnowledge and /workflow/ivrMaintenanceMcp.');
        return;
      }
    } catch (error) {
      log(`[ivr-n8n] Waiting to import Scenario 1: ${error.message}`);
    }
    await wait(10000);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  bootstrap().catch(error => { console.error('[ivr-n8n] Bootstrap failed:', error.message); process.exitCode = 1; });
}
