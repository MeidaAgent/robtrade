import { randomUUID } from "crypto";
import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { env, corsOrigins, privacyReady } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { provider } from "./lib/chain";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth";
import vaultRoutes from "./routes/vault";
import swapRoutes from "./routes/swap";
import settlementRoutes from "./routes/settlement";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "100kb", strict: true }));
app.use(pinoHttp({ logger, genReqId: (req) => req.headers["x-request-id"]?.toString() || randomUUID() }));

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: "Terlalu banyak request. Coba lagi nanti." }),
  }),
);

app.get("/health", (_req: Request, res: Response) => res.json({ ok: true, service: "robtrade-api" }));

app.get("/config", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ chainName: env.CHAIN_NAME, chainId: env.CHAIN_ID, siweDomain: env.SIWE_DOMAIN, siweUri: env.SIWE_URI, privacyMode: env.PRIVACY_MODE, privacyReady });
});

app.get("/ready", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const network = await provider.getNetwork();
    const ready = Number(network.chainId) === env.CHAIN_ID;
    res.status(ready ? 200 : 503).json({ ok: ready, database: "ok", chainId: network.chainId.toString() });
  } catch (err) {
    logger.warn({ err }, "Readiness check failed");
    res.status(503).json({ ok: false });
  }
});

app.use("/auth", authRoutes);
app.use("/vault", vaultRoutes);
app.use("/swap", swapRoutes);
app.use("/settlements", settlementRoutes);

app.use(errorHandler);

