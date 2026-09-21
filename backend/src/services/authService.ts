import { randomBytes } from "crypto";
import { SiweMessage } from "siwe";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { ApiError } from "../middleware/errorHandler";

const SIWE_MAX_AGE_MS = 10 * 60 * 1000;

export async function issueNonce(address: string) {
  const normalized = address.toLowerCase();
  const nonce = randomBytes(16).toString("hex");

  await prisma.user.upsert({
    where: { address: normalized },
    create: { address: normalized, nonce },
    update: { nonce },
  });

  return nonce;
}

interface VerifyParams {
  message: string;
  signature: string;
}

export async function verifySiwe({ message, signature }: VerifyParams) {
  if (message.length > 10_000 || signature.length > 2_000) {
    throw new ApiError(400, "Pesan atau signature terlalu panjang.");
  }

  let siweMessage: SiweMessage;
  try {
    siweMessage = new SiweMessage(message);
  } catch {
    throw new ApiError(401, "Format pesan SIWE tidak valid.");
  }

  const address = siweMessage.address.toLowerCase();
  const user = await prisma.user.findUnique({ where: { address } });
  if (!user || user.nonce !== siweMessage.nonce) {
    throw new ApiError(401, "Nonce tidak cocok atau sudah dipakai. Minta nonce baru.");
  }

  if (siweMessage.domain !== env.SIWE_DOMAIN) {
    throw new ApiError(401, "Domain SIWE tidak cocok.");
  }

  if (siweMessage.uri !== env.SIWE_URI) {
    throw new ApiError(401, "URI SIWE tidak cocok.");
  }

  if (Number(siweMessage.chainId) !== env.CHAIN_ID) {
    throw new ApiError(401, "Chain SIWE tidak cocok.");
  }

  const issuedAt = siweMessage.issuedAt ? Date.parse(siweMessage.issuedAt) : NaN;
  if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > SIWE_MAX_AGE_MS) {
    throw new ApiError(401, "Pesan SIWE sudah kedaluwarsa atau issuedAt tidak valid.");
  }

  const expirationTime = siweMessage.expirationTime ? Date.parse(siweMessage.expirationTime) : NaN;
  if (Number.isFinite(expirationTime) && Date.now() >= expirationTime) {
    throw new ApiError(401, "Pesan SIWE sudah kedaluwarsa.");
  }

  const result = await siweMessage.verify({ signature });
  if (!result.success) {
    throw new ApiError(401, "Verifikasi signature gagal.");
  }

  // One-time nonce consumption must be atomic so two concurrent verify requests
  // cannot both exchange the same SIWE message for a JWT.
  const rotatedNonce = randomBytes(16).toString("hex");
  const consumed = await prisma.user.updateMany({
    where: { id: user.id, nonce: siweMessage.nonce },
    data: { nonce: rotatedNonce, lastLoginAt: new Date() },
  });

  if (consumed.count !== 1) {
    throw new ApiError(401, "Nonce sudah dipakai. Minta nonce baru.");
  }

  // Re-associate public-chain events that happened before this address
  // created a RobTrade user, so history does not depend on login timing.
  await prisma.shieldedBalanceEvent.updateMany({
    where: { actorAddress: address, userId: null },
    data: { userId: user.id },
  });

  const token = jwt.sign(
    { address },
    env.JWT_SECRET,
    {
      subject: user.id,
      expiresIn: "12h",
      issuer: "robtrade-api",
      audience: "robtrade-web",
      algorithm: "HS256",
    },
  );

  return { token, address };
}
