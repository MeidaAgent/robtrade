import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const circuit = path.join(root, 'circuits', 'withdraw.circom');
const out = path.join(root, 'circuits', 'build');
fs.mkdirSync(out, { recursive: true });
if (!fs.existsSync(circuit)) {
  console.error(`Missing circuit: ${circuit}`);
  process.exit(1);
}
const candidates = [
  process.env.CIRCOM_BIN,
  path.join(root, '..', 'circom-bin', 'circom.exe'),
  'circom'
].filter(Boolean);
let last;
for (const binary of candidates) {
  const result = spawnSync(binary, [circuit, '--r1cs', '--wasm', '-o', out], { stdio: 'inherit', shell: process.platform === 'win32' && binary === 'circom' });
  last = result;
  if (!result.error && result.status === 0) {
    console.log('Circuit compilation finished.');
    process.exit(0);
  }
}
console.error('Circom compiler was not found or compilation failed. Set CIRCOM_BIN to the full path of circom.exe.');
process.exit(last?.status || 1);
