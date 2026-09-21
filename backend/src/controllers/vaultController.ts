import { Response } from "express";
import { z } from "zod";
import { ethers } from "ethers";
import { AuthedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { buildShieldCalldata, buildUnshieldCalldata } from "../services/vaultService";
import { env } from "../config/env";
import { provider, getShieldedPoolContract } from "../lib/chain";
import { ApiError } from "../middleware/errorHandler";

const shieldSchema = z.object({
  commitment: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  amountWei: z.string().regex(/^\d+$/).max(78),
});

const unshieldSchema = z.object({
  proof: z.string().regex(/^0x(?:[0-9a-fA-F]{2})*$/).max(200_000),
  root: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  nullifier: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amountWei: z.string().regex(/^\d+$/).max(78),
});

const attachSchema = z.object({
  commitment: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  encryptedNote: z.string().min(1).max(50_000),
});

function serializeBigInt<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)));
}

export function prepareShield(req: AuthedRequest, res: Response) {
  const { commitment, amountWei } = shieldSchema.parse(req.body);
  const tx = buildShieldCalldata(commitment, amountWei);
  res.setHeader("Cache-Control", "no-store");
  res.json({ tx, privacyMode: env.PRIVACY_MODE });
}

export function prepareUnshield(req: AuthedRequest, res: Response) {
  const body = unshieldSchema.parse(req.body);
  const tx = buildUnshieldCalldata(body.proof, body.root, body.nullifier, body.recipient, body.amountWei);
  res.setHeader("Cache-Control", "no-store");
  res.json({ tx, privacyMode: env.PRIVACY_MODE });
}

export async function attachNote(req: AuthedRequest, res: Response) {
  const { commitment, txHash, encryptedNote } = attachSchema.parse(req.body);
  if (!env.SHIELDED_POOL_CONTRACT_ADDRESS) throw new ApiError(503, "Shielded pool belum dikonfigurasi.");

  const tx = await provider.getTransaction(txHash);
  if (!tx) throw new ApiError(404, "Transaksi belum ditemukan di network.");
  if (tx.from.toLowerCase() !== req.walletAddress!.toLowerCase()) throw new ApiError(400, "Transaksi bukan dari wallet yang login.");
  if ((tx.to ?? "").toLowerCase() !== env.SHIELDED_POOL_CONTRACT_ADDRESS.toLowerCase()) throw new ApiError(400, "Target transaksi bukan shielded pool.");
  if (tx.chainId !== BigInt(env.CHAIN_ID)) throw new ApiError(400, "Transaksi menggunakan chain yang salah.");

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) throw new ApiError(409, "Transaksi belum dikonfirmasi.");
  if (receipt.status !== 1) throw new ApiError(400, "Transaksi shield gagal.");

  const contract = getShieldedPoolContract();
  const expected = commitment.toLowerCase();
  let found = false;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== env.SHIELDED_POOL_CONTRACT_ADDRESS.toLowerCase()) continue;
    try {
      const parsed = contract!.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "Shield" && String(parsed.args[0]).toLowerCase() === expected) {
        found = true;
        break;
      }
    } catch {
      // Ignore unrelated logs.
    }
  }
  if (!found) throw new ApiError(400, "Transaction tidak mengandung Shield event untuk commitment ini.");

  const note = await prisma.vaultNote.upsert({
    where: { commitment: commitment.toLowerCase() },
    create: { userId: req.userId!, commitment: commitment.toLowerCase(), txHash: txHash.toLowerCase(), encryptedNote },
    update: { userId: req.userId!, txHash: txHash.toLowerCase(), encryptedNote },
  });

  res.status(201).json({ note: { id: note.id, commitment: note.commitment, txHash: note.txHash, createdAt: note.createdAt } });
}

export async function getNotes(req: AuthedRequest, res: Response) {
  const notes = await prisma.vaultNote.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, commitment: true, txHash: true, encryptedNote: true, createdAt: true, spentAt: true },
  });
  res.setHeader("Cache-Control", "no-store");
  res.json({ notes });
}

export async function getHistory(req: AuthedRequest, res: Response) {
  const events = await prisma.shieldedBalanceEvent.findMany({
    where: { userId: req.userId },
    orderBy: [{ blockNumber: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  res.json(serializeBigInt({ events }));
}

export async function getPoolState(_req: AuthedRequest, res: Response) {
  const contract = getShieldedPoolContract();
  if (!contract) throw new ApiError(503, "Shielded pool belum dikonfigurasi.");
  const root: string = await contract.currentRoot();
  res.json({
    chainId: env.CHAIN_ID,
    contract: env.SHIELDED_POOL_CONTRACT_ADDRESS,
    currentRoot: root,
    verifierConfigured: Boolean(env.PROOF_VERIFIER_ADDRESS),
    withdrawalsEnabled: env.PRIVACY_MODE === "production" && Boolean(env.PROOF_VERIFIER_ADDRESS),
  });
}
