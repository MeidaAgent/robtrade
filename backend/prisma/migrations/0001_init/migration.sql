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
CREATE INDEX "User_lastLoginAt_idx" ON "User"("lastLoginAt");

CREATE TABLE "VaultNote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "commitment" TEXT NOT NULL,
  "txHash" TEXT NOT NULL,
  "encryptedNote" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "spentAt" TIMESTAMP(3),
  CONSTRAINT "VaultNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VaultNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VaultNote_commitment_key" ON "VaultNote"("commitment");
CREATE INDEX "VaultNote_userId_txHash_idx" ON "VaultNote"("userId", "txHash");
CREATE INDEX "VaultNote_userId_createdAt_idx" ON "VaultNote"("userId", "createdAt");

CREATE TABLE "ShieldedBalanceEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "chainId" INTEGER NOT NULL,
  "txHash" TEXT NOT NULL,
  "logIndex" INTEGER NOT NULL,
  "direction" "ShieldDirection" NOT NULL,
  "actorAddress" TEXT NOT NULL,
  "commitmentOrNullifier" TEXT NOT NULL,
  "blockNumber" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShieldedBalanceEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShieldedBalanceEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShieldedBalanceEvent_chainId_txHash_logIndex_key" ON "ShieldedBalanceEvent"("chainId", "txHash", "logIndex");
CREATE INDEX "ShieldedBalanceEvent_userId_blockNumber_idx" ON "ShieldedBalanceEvent"("userId", "blockNumber");
CREATE INDEX "ShieldedBalanceEvent_actorAddress_blockNumber_idx" ON "ShieldedBalanceEvent"("actorAddress", "blockNumber");
CREATE INDEX "ShieldedBalanceEvent_chainId_blockNumber_idx" ON "ShieldedBalanceEvent"("chainId", "blockNumber");

CREATE TABLE "SwapQuote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "tokenIn" TEXT NOT NULL,
  "tokenOut" TEXT NOT NULL,
  "amountIn" TEXT NOT NULL,
  "amountOut" TEXT NOT NULL,
  "minAmountOut" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  "data" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "estimatedGas" TEXT NOT NULL,
  "quoteProvider" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SwapQuote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SwapQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SwapQuote_id_key" ON "SwapQuote"("id");
CREATE INDEX "SwapQuote_userId_createdAt_idx" ON "SwapQuote"("userId", "createdAt");
CREATE INDEX "SwapQuote_expiresAt_idx" ON "SwapQuote"("expiresAt");

CREATE TABLE "SwapOrder" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "quoteId" TEXT,
  "chainId" INTEGER NOT NULL,
  "tokenIn" TEXT NOT NULL,
  "tokenOut" TEXT NOT NULL,
  "amountIn" TEXT NOT NULL,
  "minAmountOut" TEXT NOT NULL,
  "expectedTo" TEXT,
  "expectedData" TEXT,
  "expectedValue" TEXT,
  "quoteProvider" TEXT NOT NULL,
  "status" "SwapStatus" NOT NULL DEFAULT 'PENDING',
  "txHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SwapOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SwapOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SwapOrder_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "SwapQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SwapOrder_quoteId_key" ON "SwapOrder"("quoteId");
CREATE UNIQUE INDEX "SwapOrder_txHash_key" ON "SwapOrder"("txHash");
CREATE INDEX "SwapOrder_userId_createdAt_idx" ON "SwapOrder"("userId", "createdAt");
CREATE INDEX "SwapOrder_status_updatedAt_idx" ON "SwapOrder"("status", "updatedAt");

CREATE TABLE "Settlement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "txHash" TEXT NOT NULL,
  "kind" "SettlementKind" NOT NULL,
  "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
  "chainId" INTEGER NOT NULL,
  "blockNumber" BIGINT,
  "swapOrderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Settlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Settlement_swapOrderId_fkey" FOREIGN KEY ("swapOrderId") REFERENCES "SwapOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Settlement_txHash_key" ON "Settlement"("txHash");
CREATE UNIQUE INDEX "Settlement_swapOrderId_key" ON "Settlement"("swapOrderId");
CREATE INDEX "Settlement_userId_createdAt_idx" ON "Settlement"("userId", "createdAt");
CREATE INDEX "Settlement_status_updatedAt_idx" ON "Settlement"("status", "updatedAt");
CREATE INDEX "Settlement_chainId_blockNumber_idx" ON "Settlement"("chainId", "blockNumber");

CREATE TABLE "IndexerState" (
  "name" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "nextBlock" BIGINT NOT NULL,
  "lastBlockHash" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IndexerState_pkey" PRIMARY KEY ("name")
);
CREATE UNIQUE INDEX "IndexerState_chainId_key" ON "IndexerState"("chainId");
