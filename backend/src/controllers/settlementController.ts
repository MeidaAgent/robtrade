import { Response } from "express";
import { z } from "zod";
import { AuthedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { provider } from "../lib/chain";
import { env } from "../config/env";
import { ApiError } from "../middleware/errorHandler";

const txHashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);

function serializeBigInt<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)));
}

export async function getSettlement(req: AuthedRequest, res: Response) {
  const txHash = txHashSchema.parse(req.params.txHash).toLowerCase();
  let settlement = await prisma.settlement.findUnique({ where: { txHash } });

  if (!settlement || settlement.userId !== req.userId) {
    throw new ApiError(404, "Settlement tidak ditemukan.");
  }

  if (settlement.chainId !== env.CHAIN_ID) {
    throw new ApiError(409, "Settlement tercatat pada chain yang berbeda.");
  }

  if (settlement.status === "PENDING" || settlement.status === "CONFIRMED") {
    const receipt = await provider.getTransactionReceipt(settlement.txHash);
    if (receipt && (settlement.status === "PENDING" || !settlement.blockNumber)) {
      const status = receipt.status === 1 ? "CONFIRMED" : "FAILED";
      settlement = await prisma.settlement.update({
        where: { id: settlement.id },
        data: { status, blockNumber: BigInt(receipt.blockNumber) },
      });
    }
  }

  res.json(serializeBigInt(settlement));
}

export async function listSettlements(req: AuthedRequest, res: Response) {
  const settlements = await prisma.settlement.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(serializeBigInt({ settlements }));
}
