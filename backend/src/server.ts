import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { startShieldedPoolIndexer, stopShieldedPoolIndexer } from "./services/indexerService";

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "RobTrade backend started");
  startShieldedPoolIndexer();
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  stopShieldedPoolIndexer();
  server.close(async (error) => {
    try {
      await prisma.$disconnect();
    } finally {
      if (error) process.exitCode = 1;
      process.exit();
    }
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
