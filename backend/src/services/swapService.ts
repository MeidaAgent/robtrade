import { ethers } from "ethers";
import { env } from "../config/env";
import { ApiError } from "../middleware/errorHandler";

export interface SwapQuoteParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  takerAddress: string;
}

export interface SwapQuote {
  provider: "0x";
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  minAmountOut: string;
  to: string;
  data: string;
  value: string;
  estimatedGas: string;
  expiresAt: string;
}

function assertToken(value: string, label: string) {
  if (!ethers.isAddress(value)) throw new ApiError(400, `${label} bukan alamat EVM yang valid.`);
  return ethers.getAddress(value);
}

function assertUint(value: string, field: string, allowZero = false) {
  if (!/^[0-9]+$/.test(value)) throw new ApiError(400, `${field} harus berupa integer.`);
  const amount = BigInt(value);
  if ((!allowZero && amount <= 0n) || amount > (1n << 256n) - 1n) {
    throw new ApiError(400, `${field} berada di luar range uint256.`);
  }
  return value;
}

export async function getSwapQuote(params: SwapQuoteParams): Promise<SwapQuote> {
  if (!env.ZEROX_API_KEY) {
    throw new ApiError(503, "ZEROX_API_KEY belum diset.");
  }

  const tokenIn = assertToken(params.tokenIn, "tokenIn");
  const tokenOut = assertToken(params.tokenOut, "tokenOut");
  const takerAddress = assertToken(params.takerAddress, "takerAddress");
  const amountIn = assertUint(params.amountIn, "amountIn");

  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
    throw new ApiError(400, "tokenIn dan tokenOut tidak boleh sama.");
  }

  const url = new URL(env.ZEROX_API_URL);
  url.searchParams.set("sellToken", tokenIn);
  url.searchParams.set("buyToken", tokenOut);
  url.searchParams.set("sellAmount", amountIn);
  url.searchParams.set("takerAddress", takerAddress);
  url.searchParams.set("chainId", String(env.CHAIN_ID));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "0x-api-key": env.ZEROX_API_KEY, accept: "application/json", "0x-version": "2" },
      signal: controller.signal,
    });
  } catch (error) {
    throw new ApiError(502, error instanceof Error && error.name === "AbortError" ? "Quote provider timeout." : "Quote provider tidak dapat dihubungi.");
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(502, `Gagal ambil quote dari 0x (${res.status}).`, body.slice(0, 500));
  }

  const raw = await res.json() as any;
  const buyAmount = raw.buyAmount;
  const tx = raw.transaction ?? raw;
  const to = tx.to ?? raw.to;
  const data = tx.data ?? raw.data;
  const value = tx.value ?? raw.value ?? "0";
  const estimatedGas = raw.gas ?? raw.estimatedGas ?? tx.gas ?? "0";

  if (!buyAmount || !to || data === undefined || value === undefined) {
    throw new ApiError(502, "Response quote provider tidak lengkap.");
  }

  assertUint(buyAmount, "buyAmount");
  assertUint(String(value), "value", true);
  assertUint(String(estimatedGas), "estimatedGas", true);
  if (!ethers.isHexString(data)) throw new ApiError(502, "Quote provider mengembalikan calldata yang invalid.");
  const minAmountOut = (BigInt(buyAmount) * BigInt(10_000 - env.SWAP_MAX_SLIPPAGE_BPS) / 10_000n).toString();
  if (!ethers.isAddress(to)) throw new ApiError(502, "Quote provider mengembalikan target transaksi yang invalid.");

  const expiresAt = new Date(Date.now() + env.SWAP_QUOTE_TTL_SECONDS * 1000);

  return {
    provider: "0x",
    chainId: env.CHAIN_ID,
    tokenIn,
    tokenOut,
    amountIn,
    amountOut: String(buyAmount),
    minAmountOut,
    to: ethers.getAddress(to),
    data,
    value: String(value),
    estimatedGas: String(estimatedGas),
    expiresAt: expiresAt.toISOString(),
  };
}

export function assertQuoteNotExpired(expiresAt: Date) {
  if (expiresAt.getTime() <= Date.now()) throw new ApiError(410, "Quote sudah kedaluwarsa. Ambil quote baru.");
}
