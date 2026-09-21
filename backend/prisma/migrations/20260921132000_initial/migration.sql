CREATE TYPE "ShieldDirection" AS ENUM ('SHIELD', 'UNSHIELD');
CREATE TYPE "SwapStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED');
CREATE TYPE "SettlementKind" AS ENUM ('SHIELD', 'UNSHIELD', 'SWAP', 'PAYMENT');
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastLoginAt" TIMESTAMP(3),
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

CREATE TABLE "ShieldedBalanceEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "txHash" TEXT NOT NULL,
  "direction" "ShieldDirection" NOT NULL,
  "encryptedNote" TEXT NOT NULL,
  "blockNumber" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShieldedBalanceEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShieldedBalanceEvent_txHash_key" ON "ShieldedBalanceEvent"("txHash");
ALTER TABLE "ShieldedBalanceEvent"
  ADD CONSTRAINT "ShieldedBalanceEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SwapOrder" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenIn" TEXT NOT NULL,
  "tokenOut" TEXT NOT NULL,
  "amountIn" TEXT NOT NULL,
  "minAmountOut" TEXT NOT NULL,
  "quoteProvider" TEXT NOT NULL,
  "status" "SwapStatus" NOT NULL DEFAULT 'PENDING',
  "txHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SwapOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SwapOrder_txHash_key" ON "SwapOrder"("txHash");
ALTER TABLE "SwapOrder"
  ADD CONSTRAINT "SwapOrder_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Settlement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "txHash" TEXT NOT NULL,
  "kind" "SettlementKind" NOT NULL,
  "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
  "blockNumber" BIGINT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Settlement_txHash_key" ON "Settlement"("txHash");
ALTER TABLE "Settlement"
  ADD CONSTRAINT "Settlement_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
