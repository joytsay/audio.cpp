import { spawn, execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

const storage = '/qdrant/storage';
const nodeHome = '/home/node';
const { uid, gid } = statSync(nodeHome);

// Standalone Qdrant used root to write this volume.
if (process.getuid() === 0) {
  execFileSync('find', [
    storage, '(', '!', '-uid', String(uid), '-o', '!', '-gid', String(gid), ')',
    '-exec', 'chown', '-h', `${uid}:${gid}`, '{}', '+',
  ], { stdio: 'inherit' });
  process.setgroups([]);
  process.setgid(gid);
  process.setuid(uid);
  process.env.HOME = nodeHome;
}

const children = [
  spawn('/qdrant/qdrant', {
    cwd: '/qdrant',
    env: { ...process.env, RUN_MODE: 'production', QDRANT_INIT_FILE_PATH: '/qdrant/snapshots/.qdrant-initialized' },
    stdio: 'inherit',
  }),
  spawn(process.execPath, ['/app/server.mjs'], { stdio: 'inherit' }),
];

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
}

for (const child of children) {
  child.once('error', error => {
    console.error('[ivr-knowledge]', error);
    stop(1);
  });
  child.once('exit', (code, signal) => {
    if (stopping) return;
    console.error(`[ivr-knowledge] ${child.spawnfile} exited (${signal ?? code})`);
    stop(code || 1);
  });
}

process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));
