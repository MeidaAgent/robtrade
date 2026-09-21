import { ethers } from "ethers";
import { SHIELDED_POOL_ABI } from "../lib/chain";
import { env } from "../config/env";
import { ApiError } from "../middleware/errorHandler";

const iface = new ethers.Interface(SHIELDED_POOL_ABI);

function requireContract() {
  if (!env.SHIELDED_POOL_CONTRACT_ADDRESS) {
    throw new ApiError(503, "SHIELDED_POOL_CONTRACT_ADDRESS belum diset di .env.");
  }
  if (!ethers.isAddress(env.SHIELDED_POOL_CONTRACT_ADDRESS)) {
    throw new ApiError(503, "SHIELDED_POOL_CONTRACT_ADDRESS invalid.");
  }
  return ethers.getAddress(env.SHIELDED_POOL_CONTRACT_ADDRESS);
}

function requireBytes32(value: string, field: string) {
  if (!ethers.isHexString(value, 32)) throw new ApiError(400, `${field} harus bytes32 hex.`);
  return value;
}

function requireBytes(value: string, field: string) {
  if (!ethers.isHexString(value)) throw new ApiError(400, `${field} harus hex bytes.`);
  return value;
}

function requireWei(value: string) {
  if (!/^\d+$/.test(value)) throw new ApiError(400, "amountWei harus integer dalam wei.");
  const amount = BigInt(value);
  if (amount <= 0n || amount > (1n << 256n) - 1n) throw new ApiError(400, "amountWei di luar range uint256.");
  return value;
}

export function buildShieldCalldata(commitment: string, amountWei: string) {
  const to = requireContract();
  const normalizedCommitment = requireBytes32(commitment, "commitment");
  const value = requireWei(amountWei);
  const data = iface.encodeFunctionData("shield", [normalizedCommitment]);
  return { chainId: env.CHAIN_ID, to, data, value };
}

export function buildUnshieldCalldata(proof: string, root: string, nullifier: string, recipient: string, amountWei: string) {
  const to = requireContract();
  const normalizedProof = requireBytes(proof, "proof");
  const normalizedRoot = requireBytes32(root, "root");
  const normalizedNullifier = requireBytes32(nullifier, "nullifier");
  const amount = requireWei(amountWei);
  if (!ethers.isAddress(recipient)) throw new ApiError(400, "recipient bukan alamat EVM yang valid.");
  const normalizedRecipient = ethers.getAddress(recipient);
  const data = iface.encodeFunctionData("unshield", [normalizedProof, normalizedRoot, normalizedNullifier, normalizedRecipient, amount]);
  return { chainId: env.CHAIN_ID, to, data, value: "0" };
}
