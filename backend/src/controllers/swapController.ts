import { Response } from "express";
import { z } from "zod";
import { ethers } from "ethers";
import { AuthedRequest } from "../middleware/auth";
import { getSwapQuote, assertQuoteNotExpired } from "../services/swapService";
import { prisma } from "../lib/prisma";
import { provider } from "../lib/chain";
import { env } from "../config/env";
import { ApiError } from "../middleware/errorHandler";

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const amountSchema = z.string().regex(/^\d+$/).min(1).max(78);

const quoteSchema = z.object({
  tokenIn: addressSchema,
  tokenOut: addressSchema,
  amountIn: amountSchema,
});

export async function quote(req: AuthedRequest, res: Response) {
  const { tokenIn, tokenOut, amountIn } = quoteSchema.parse(req.body);
  const result = await getSwapQuote({ tokenIn, tokenOut, amountIn, takerAddress: req.walletAddress! });
  const saved = await prisma.swapQuote.create({
    data: {
      userId: req.userId!,
      chainId: result.chainId,
      tokenIn: result.tokenIn,
      tokenOut: result.tokenOut,
      amountIn: result.amountIn,
      amountOut: result.amountOut,
      minAmountOut: result.minAmountOut,
      to: result.to,
      data: result.data,
      value: result.value,
      estimatedGas: result.estimatedGas,
      quoteProvider: result.provider,
      expiresAt: new Date(result.expiresAt),
    },
  });

  res.setHeader("Cache-Control", "no-store");
  res.json({ quoteId: saved.id, quote: result });
}

const orderSchema = z.object({ quoteId: z.string().cuid() });

export async function createOrder(req: AuthedRequest, res: Response) {
  const { quoteId } = orderSchema.parse(req.body);
  const quote = await prisma.swapQuote.findFirst({ where: { id: quoteId, userId: req.userId! } });
  if (!quote) throw new ApiError(404, "Quote tidak ditemukan.");
  assertQuoteNotExpired(quote.expiresAt);
  if (quote.usedAt) throw new ApiError(409, "Quote sudah digunakan.");

  const order = await prisma.$transaction(async (tx) => {
    const consumed = await tx.swapQuote.updateMany({
      where: { id: quote.id, userId: req.userId!, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) throw new ApiError(409, "Quote sudah digunakan atau tidak tersedia.");

    return tx.swapOrder.create({
      data: {
        userId: req.userId!,
        quoteId: quote.id,
        chainId: quote.chainId,
        tokenIn: quote.tokenIn,
        tokenOut: quote.tokenOut,
        amountIn: quote.amountIn,
        minAmountOut: quote.minAmountOut,
        expectedTo: quote.to,
        expectedData: quote.data,
        expectedValue: quote.value,
        quoteProvider: quote.quoteProvider,
      },
    });
  });

  res.status(201).json({ order });
}

const submitSchema = z.object({ txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) });

export async function submitOrder(req: AuthedRequest, res: Response) {
  const { orderId } = req.params;
  const { txHash } = submitSchema.parse(req.body);

  const existing = await prisma.swapOrder.findFirst({ where: { id: orderId, userId: req.userId! } });
  if (!existing) throw new ApiError(404, "Order tidak ditemukan.");
  if (!["PENDING", "SUBMITTED"].includes(existing.status)) {
    return res.json({ order: existing });
  }
  if (existing.txHash && existing.txHash.toLowerCase() !== txHash.toLowerCase()) {
    throw new ApiError(409, "Order sudah memiliki transaction hash yang berbeda.");
  }

  let transaction: ethers.TransactionResponse | null;
  try {
    transaction = await provider.getTransaction(txHash);
  } catch {
    throw new ApiError(502, "Gagal mengambil transaksi dari RPC.");
  }
  if (!transaction) throw new ApiError(404, "Transaksi belum ditemukan di network.");

  const expectedFrom = req.walletAddress!;
  if (transaction.from.toLowerCase() !== expectedFrom.toLowerCase()) {
    throw new ApiError(400, "Transaksi bukan berasal dari wallet yang login.");
  }
  if (transaction.chainId !== BigInt(env.CHAIN_ID)) {
    throw new ApiError(400, "Transaksi menggunakan chain yang salah.");
  }
  if (!existing.expectedTo || !existing.expectedData || existing.expectedValue === null) {
    throw new ApiError(409, "Order lama tidak memiliki data quote yang bisa diverifikasi; buat order baru.");
  }
  if ((transaction.to ?? "").toLowerCase() !== existing.expectedTo.toLowerCase()) {
    throw new ApiError(400, "Target transaksi tidak cocok dengan quote.");
  }
  if (transaction.data.toLowerCase() !== existing.expectedData.toLowerCase()) {
    throw new ApiError(400, "Calldata transaksi tidak cocok dengan quote.");
  }
  if (transaction.value.toString() !== existing.expectedValue.toString()) {
    throw new ApiError(400, "Nilai native asset transaksi tidak cocok dengan quote.");
  }

  const receipt = await provider.getTransactionReceipt(txHash);
  const status = receipt ? (receipt.status === 1 ? "CONFIRMED" : "FAILED") : "SUBMITTED";
  const blockNumber = receipt ? BigInt(receipt.blockNumber) : null;

  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.swapOrder.update({
      where: { id: existing.id },
      data: { txHash, status },
    });

    await tx.settlement.upsert({
      where: { txHash },
      create: {
        userId: req.userId!,
        txHash,
        kind: "SWAP",
        status,
        chainId: env.CHAIN_ID,
        blockNumber,
        swapOrderId: existing.id,
      },
      update: { status, blockNumber, swapOrderId: existing.id },
    });

    return updated;
  });

  res.json({ order });
}
