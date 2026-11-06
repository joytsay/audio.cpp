import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const folder=fileURLToPath(new URL('../../../examples/docker/agx-one-container/',import.meta.url));
const config=JSON.parse(execFileSync('docker',['compose','--env-file',folder+'.env.example','-f',folder+'compose.yml','config','--format','json'],{encoding:'utf8'}));
const n8n=config.services.n8n;
assert.deepEqual(n8n.entrypoint,['/bin/sh','/templates/start-n8n.sh']);
assert.ok(n8n.volumes.some(v=>v.target==='/templates'&&v.read_only),'startup scripts/templates must be mounted');
assert.ok(n8n.volumes.some(v=>v.target==='/home/node/.n8n'&&v.source==='audiocpp-n8n-data'),'existing n8n database volume must be preserved');
assert.equal(n8n.volumes.length,2,'document mounts belong on knowledge, not on n8n');
assert.ok(!n8n.depends_on?.knowledge,'the editor must start even if knowledge files are missing');
const documents=config.services.knowledge.volumes;
assert.equal(documents.length,4);
assert.equal(new Set(documents.map(v=>v.target)).size,4);
for(const mount of documents){assert.equal(mount.read_only,true);assert.equal(mount.bind.create_host_path,false);assert.ok(mount.target.startsWith('/files/'));}
console.log('PASS Compose: n8n data/templates/entrypoint, independent editor startup, and isolated read-only knowledge files');
