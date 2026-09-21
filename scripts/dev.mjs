import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const backendDir = path.join(root, 'backend');
const frontendDir = path.join(root, 'frontend');
const frontendServer = path.join(root, 'scripts', 'static-server.mjs');

function runShell(cmd) {
  if (process.platform === 'win32') {
    return spawn('cmd.exe', ['/d', '/s', '/c', cmd], { cwd: root, stdio: 'inherit', windowsHide: true });
  }
  return spawn('sh', ['-lc', cmd], { cwd: root, stdio: 'inherit' });
}

const children = [
  runShell(`npm --prefix "${backendDir}" run dev`),
  runShell(`"${process.execPath}" "${frontendServer}" "${frontendDir}" 3000`)
];

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try { child.kill(); } catch {}
  }
  setTimeout(() => process.exit(code), 250);
}

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (!shuttingDown && code !== 0 && signal !== 'SIGTERM') {
      console.error(`[dev] child exited with code=${code} signal=${signal}`);
      shutdown(code ?? 1);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('exit', () => {
  for (const child of children) {
    try { child.kill(); } catch {}
  }
});

console.log('[dev] Starting frontend + backend…');
console.log('[dev] Frontend: http://localhost:3000');
console.log('[dev] Backend:  http://localhost:4000');
