-- Harden event identity, add quote/order reconciliation data, and add durable indexer state.

ALTER TABLE "ShieldedBalanceEvent"
  ADD COLUMN "chainId" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "logIndex" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "actorAddress" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "commitmentOrNullifier" TEXT;

UPDATE "ShieldedBalanceEvent"
SET
  "actorAddress" = COALESCE((SELECT "address" FROM "User" u WHERE u."id" = "ShieldedBalanceEvent"."userId"), ''),
  "commitmentOrNullifier" = "encryptedNote";

ALTER TABLE "ShieldedBalanceEvent"
  DROP CONSTRAINT IF EXISTS "ShieldedBalanceEvent_txHash_key";
ALTER TABLE "ShieldedBalanceEvent"
  DROP COLUMN "encryptedNote";
ALTER TABLE "ShieldedBalanceEvent"
  ALTER COLUMN "commitmentOrNullifier" SET NOT NULL;
ALTER TABLE "ShieldedBalanceEvent"
  ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "ShieldedBalanceEvent"
  DROP CONSTRAINT IF EXISTS "ShieldedBalanceEvent_userId_fkey";
ALTER TABLE "ShieldedBalanceEvent"
  ADD CONSTRAINT "ShieldedBalanceEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ShieldedBalanceEvent_chainId_txHash_logIndex_key"
  ON "ShieldedBalanceEvent"("chainId", "txHash", "logIndex");
CREATE INDEX "ShieldedBalanceEvent_userId_blockNumber_idx"
  ON "ShieldedBalanceEvent"("userId", "blockNumber");
CREATE INDEX "ShieldedBalanceEvent_actorAddress_blockNumber_idx"
  ON "ShieldedBalanceEvent"("actorAddress", "blockNumber");
CREATE INDEX "ShieldedBalanceEvent_chainId_blockNumber_idx"
  ON "ShieldedBalanceEvent"("chainId", "blockNumber");

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
  CONSTRAINT "SwapQuote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SwapQuote_userId_createdAt_idx" ON "SwapQuote"("userId", "createdAt");
CREATE INDEX "SwapQuote_expiresAt_idx" ON "SwapQuote"("expiresAt");
ALTER TABLE "SwapQuote"
  ADD CONSTRAINT "SwapQuote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SwapOrder"
  ADD COLUMN "quoteId" TEXT,
  ADD COLUMN "chainId" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "expectedTo" TEXT,
  ADD COLUMN "expectedData" TEXT,
  ADD COLUMN "expectedValue" TEXT;

UPDATE "SwapOrder"
SET "chainId" = 0;

CREATE UNIQUE INDEX "SwapOrder_quoteId_key" ON "SwapOrder"("quoteId");
CREATE INDEX "SwapOrder_userId_createdAt_idx" ON "SwapOrder"("userId", "createdAt");
CREATE INDEX "SwapOrder_status_updatedAt_idx" ON "SwapOrder"("status", "updatedAt");

ALTER TABLE "SwapOrder"
  ADD CONSTRAINT "SwapOrder_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "SwapQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Settlement"
  ADD COLUMN "chainId" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "swapOrderId" TEXT;

CREATE UNIQUE INDEX "Settlement_swapOrderId_key" ON "Settlement"("swapOrderId");
CREATE INDEX "Settlement_userId_createdAt_idx" ON "Settlement"("userId", "createdAt");
CREATE INDEX "Settlement_status_updatedAt_idx" ON "Settlement"("status", "updatedAt");
CREATE INDEX "Settlement_chainId_blockNumber_idx" ON "Settlement"("chainId", "blockNumber");
ALTER TABLE "Settlement"
  ADD CONSTRAINT "Settlement_swapOrderId_fkey"
  FOREIGN KEY ("swapOrderId") REFERENCES "SwapOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "IndexerState" (
  "name" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "nextBlock" BIGINT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IndexerState_pkey" PRIMARY KEY ("name")
);
CREATE UNIQUE INDEX "IndexerState_chainId_key" ON "IndexerState"("chainId");
