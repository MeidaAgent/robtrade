import { getShieldedPoolContract, provider } from "../lib/chain";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { logger } from "../lib/logger";

const STATE_NAME = "shielded-pool";
let timer: ReturnType<typeof setInterval> | undefined;
let running = false;

function eventLogIndex(event: any): number {
  return Number(event?.index ?? event?.log?.index ?? event?.log?.logIndex ?? 0);
}

async function processLog(log: any) {
  const contract = getShieldedPoolContract();
  if (!contract) return;
  const parsed = log?.args?.length !== undefined
    ? log
    : contract.interface.parseLog({ topics: log.topics, data: log.data });
  if (!parsed) return;

  const direction = parsed.name === "Shield" ? "SHIELD" : parsed.name === "Unshield" ? "UNSHIELD" : null;
  if (!direction) return;

  const commitmentOrNullifier = String(parsed.args[0]).toLowerCase();
  const txHash = String(log.transactionHash).toLowerCase();
  const blockNumber = BigInt(log.blockNumber);
  const logIndex = eventLogIndex(log);

  let actorAddress: string;
  if (direction === "SHIELD") {
    const tx = await provider.getTransaction(txHash);
    actorAddress = (tx?.from ?? ethersZeroAddress).toLowerCase();
  } else {
    actorAddress = String(parsed.args[1]).toLowerCase();
  }

  const note = await prisma.vaultNote.findUnique({ where: { commitment: commitmentOrNullifier } });
  const user = note
    ? await prisma.user.findUnique({ where: { id: note.userId } })
    : await prisma.user.findUnique({ where: { address: actorAddress } });

  await prisma.shieldedBalanceEvent.upsert({
    where: { chainId_txHash_logIndex: { chainId: env.CHAIN_ID, txHash, logIndex } },
    create: {
      userId: user?.id,
      chainId: env.CHAIN_ID,
      txHash,
      logIndex,
      direction,
      actorAddress,
      commitmentOrNullifier,
      blockNumber,
    },
    update: {
      userId: user?.id,
      direction,
      actorAddress,
      commitmentOrNullifier,
      blockNumber,
    },
  });

  if (user) {
    await prisma.settlement.upsert({
      where: { txHash },
      create: { userId: user.id, txHash, kind: direction, status: "CONFIRMED", chainId: env.CHAIN_ID, blockNumber },
      update: { userId: user.id, status: "CONFIRMED", blockNumber, chainId: env.CHAIN_ID },
    });
  }
}

const ethersZeroAddress = "0x0000000000000000000000000000000000000000";

async function getOrCreateState(latestFinalizedBlock: number) {
  const state = await prisma.indexerState.findUnique({ where: { name: STATE_NAME } });
  if (state) return state;
  const initial = env.INDEXER_START_BLOCK ?? latestFinalizedBlock + 1;
  return prisma.indexerState.create({
    data: { name: STATE_NAME, chainId: env.CHAIN_ID, nextBlock: BigInt(initial) },
  });
}

async function reconcileReorg(state: Awaited<ReturnType<typeof getOrCreateState>>) {
  if (!state.lastBlockHash || state.nextBlock <= 0n) return state;
  const lastProcessed = await provider.getBlock(Number(state.nextBlock - 1n));
  if (!lastProcessed?.hash || lastProcessed.hash.toLowerCase() === state.lastBlockHash.toLowerCase()) return state;

  const rewindTo = Math.max(0, Number(state.nextBlock) - env.INDEXER_REORG_REWIND_BLOCKS);
  logger.warn({ expected: state.lastBlockHash, actual: lastProcessed?.hash, rewindTo }, "Indexer detected a reorg; rewinding checkpoint");

  await prisma.$transaction([
    prisma.shieldedBalanceEvent.deleteMany({ where: { chainId: env.CHAIN_ID, blockNumber: { gte: BigInt(rewindTo) } } }),
    prisma.settlement.deleteMany({ where: { chainId: env.CHAIN_ID, blockNumber: { gte: BigInt(rewindTo) }, kind: { in: ["SHIELD", "UNSHIELD"] } } }),
    prisma.indexerState.update({ where: { name: STATE_NAME }, data: { nextBlock: BigInt(rewindTo), lastBlockHash: null } }),
  ]);
  return (await prisma.indexerState.findUniqueOrThrow({ where: { name: STATE_NAME } }));
}

async function syncOnce() {
  if (running) return;
  const contract = getShieldedPoolContract();
  if (!contract) return;

  running = true;
  try {
    const latest = await provider.getBlockNumber();
    const finalized = latest - env.INDEXER_CONFIRMATIONS;
    if (finalized < 0) return;

    let state = await getOrCreateState(finalized);
    state = await reconcileReorg(state);
    let from = Number(state.nextBlock);
    if (from > finalized) return;

    while (from <= finalized) {
      const to = Math.min(from + env.INDEXER_CHUNK_SIZE - 1, finalized);
      const [shields, unshields] = await Promise.all([
        contract.queryFilter(contract.filters.Shield(), from, to),
        contract.queryFilter(contract.filters.Unshield(), from, to),
      ]);

      const logs = [...shields, ...unshields].sort(
        (a: any, b: any) => a.blockNumber - b.blockNumber || eventLogIndex(a) - eventLogIndex(b),
      );
      for (const log of logs) await processLog(log);

      const block = await provider.getBlock(to);
      await prisma.indexerState.update({
        where: { name: STATE_NAME },
        data: { nextBlock: BigInt(to + 1), lastBlockHash: block?.hash ?? null },
      });
      from = to + 1;
    }
  } catch (err) {
    logger.error({ err }, "Indexer sync failed");
  } finally {
    running = false;
  }
}

export function startShieldedPoolIndexer() {
  if (timer) return;
  if (!env.SHIELDED_POOL_CONTRACT_ADDRESS) {
    logger.warn("Indexer disabled: SHIELDED_POOL_CONTRACT_ADDRESS is not configured.");
    return;
  }
  timer = setInterval(() => void syncOnce(), env.INDEXER_POLL_MS);
  void syncOnce();
  logger.info({ pollMs: env.INDEXER_POLL_MS, confirmations: env.INDEXER_CONFIRMATIONS }, "Shielded pool indexer started");
}

export function stopShieldedPoolIndexer() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
