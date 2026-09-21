import { ethers } from "ethers";
import { env } from "../config/env";

export const provider = new ethers.JsonRpcProvider(env.CHAIN_RPC_URL, env.CHAIN_ID, {
  staticNetwork: true,
});

export const SHIELDED_POOL_ABI = [
  "event Shield(bytes32 indexed commitment)",
  "event Unshield(bytes32 indexed nullifier, address indexed recipient, uint256 amount)",
  "function shield(bytes32 commitment) external payable",
  "function unshield(bytes calldata proof, bytes32 root, bytes32 nullifier, address recipient, uint256 amount) external",
  "function currentRoot() external view returns (bytes32)",
  "function isKnownRoot(bytes32 root) external view returns (bool)",
  "function isNullifierUsed(bytes32 nullifier) external view returns (bool)",
] as const;

export function getShieldedPoolContract(): ethers.Contract | null {
  if (!env.SHIELDED_POOL_CONTRACT_ADDRESS) return null;
  if (!ethers.isAddress(env.SHIELDED_POOL_CONTRACT_ADDRESS)) {
    throw new Error("SHIELDED_POOL_CONTRACT_ADDRESS is not a valid EVM address.");
  }
  return new ethers.Contract(env.SHIELDED_POOL_CONTRACT_ADDRESS, SHIELDED_POOL_ABI, provider);
}

export function assertExpectedChain(chainId: number | bigint) {
  if (BigInt(chainId) !== BigInt(env.CHAIN_ID)) {
    throw new Error(`Unexpected chainId: expected ${env.CHAIN_ID}, received ${chainId}`);
  }
}
