import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const rpcUrl = process.env.CHAIN_RPC_URL;
const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
const chainId = Number(process.env.CHAIN_ID || "4663");
const rootManager = process.env.ROOT_MANAGER_ADDRESS;
const useMock = process.env.DEPLOY_MOCK_VERIFIER === "true";

if (!rpcUrl || !privateKey) throw new Error("Set CHAIN_RPC_URL and DEPLOYER_PRIVATE_KEY.");
if (!rootManager || !ethers.isAddress(rootManager)) throw new Error("Set ROOT_MANAGER_ADDRESS to an EVM address.");

const provider = new ethers.JsonRpcProvider(rpcUrl, chainId, { staticNetwork: true });
const signer = new ethers.Wallet(privateKey, provider);
const network = await provider.getNetwork();
if (Number(network.chainId) !== chainId) throw new Error(`Wrong chain: expected ${chainId}, got ${network.chainId}`);

function artifact(name) {
  const file = path.join(root, "artifacts", `${name}.json`);
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run npm run compile first.`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const poolArtifact = artifact("PrivacyPool");
const pool = await new ethers.ContractFactory(poolArtifact.abi, poolArtifact.bytecode, signer).deploy(rootManager);
await pool.waitForDeployment();
console.log(`SHIELDED_POOL_CONTRACT_ADDRESS=${await pool.getAddress()}`);

if (useMock) {
  const mockArtifact = artifact("MockPrivacyVerifier");
  const mock = await new ethers.ContractFactory(mockArtifact.abi, mockArtifact.bytecode, signer).deploy();
  await mock.waitForDeployment();
  const tx1 = await pool.setVerifier(await mock.getAddress());
  await tx1.wait();
  const tx2 = await pool.setWithdrawalsEnabled(true);
  await tx2.wait();
  console.log(`PROOF_VERIFIER_ADDRESS=${await mock.getAddress()}`);
  console.warn("MOCK VERIFIER ENABLED — DEVELOPMENT ONLY; DO NOT USE WITH REAL FUNDS.");
}
