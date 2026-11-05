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

export async function importMissing({ templates = '/templates', run = runCli, has = exists, files = fs, log = console.log } = {}) {
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
