import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const sources = {};
function add(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) add(full);
    else if (entry.name.endsWith(".sol")) sources[path.relative(root, full).replaceAll(path.sep, "/")] = { content: fs.readFileSync(full, "utf8") };
  }
}
add(path.join(root, "contracts"));
const input = {
  language: "Solidity",
  sources,
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
for (const error of output.errors ?? []) {
  if (error.severity === "error") console.error(error.formattedMessage);
}
if ((output.errors ?? []).some((e) => e.severity === "error")) process.exit(1);
fs.rmSync(path.join(root, "artifacts"), { recursive: true, force: true });
for (const [file, contracts] of Object.entries(output.contracts)) {
  for (const [name, artifact] of Object.entries(contracts)) {
    const dest = path.join(root, "artifacts", `${name}.json`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify({ contractName: name, sourceName: file, abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}` }, null, 2));
  }
}
console.log("Compiled", Object.keys(output.contracts).length, "source files.");
