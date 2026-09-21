import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const build = path.join(root, 'circuits', 'build');
const r1cs = path.join(build, 'withdraw.r1cs');
const wasm = path.join(build, 'withdraw_js', 'withdraw.wasm');
console.log(`R1CS: ${fs.existsSync(r1cs) ? 'OK' : 'MISSING'} ${r1cs}`);
console.log(`WASM: ${fs.existsSync(wasm) ? 'OK' : 'MISSING'} ${wasm}`);
process.exit(fs.existsSync(r1cs) && fs.existsSync(wasm) ? 0 : 1);
