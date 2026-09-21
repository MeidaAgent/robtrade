import "dotenv/config";
import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === undefined || value === "" ? undefined : value),
  z.string().optional(),
);

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET minimal 32 karakter random."),
  DATABASE_URL: z.string().url(),

  CHAIN_NAME: z.string().default("Robinhood Chain"),
  CHAIN_ID: z.coerce.number().int().positive().default(4663),
  CHAIN_RPC_URL: z.string().url(),
  SHIELDED_POOL_CONTRACT_ADDRESS: optionalString.default(""),
  PROOF_VERIFIER_ADDRESS: optionalString.default(""),
  SETTLEMENT_CONTRACT_ADDRESS: optionalString.default(""),
  PRIVACY_MODE: z.enum(["disabled", "scaffold", "production"]).default("scaffold"),

  ZEROX_API_KEY: optionalString.default(""),
  ZEROX_API_URL: z.string().url().default("https://api.0x.org/swap/v1/quote"),
  ONEINCH_API_KEY: optionalString.default(""),

  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  SIWE_DOMAIN: z.string().default("localhost:3000"),
  SIWE_URI: z.string().url().default("http://localhost:3000"),
  SWAP_QUOTE_TTL_SECONDS: z.coerce.number().int().min(15).max(300).default(60),
  SWAP_MAX_SLIPPAGE_BPS: z.coerce.number().int().min(1).max(5000).default(50),
  INDEXER_POLL_MS: z.coerce.number().int().min(1000).max(300000).default(10000),
  INDEXER_CHUNK_SIZE: z.coerce.number().int().min(1).max(5000).default(1000),
  INDEXER_CONFIRMATIONS: z.coerce.number().int().min(0).max(100).default(3),
  INDEXER_REORG_REWIND_BLOCKS: z.coerce.number().int().min(1).max(500).default(20),
  INDEXER_START_BLOCK: z.coerce.number().int().min(0).optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid .env configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const corsOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);

export const privacyReady = Boolean(
  env.PRIVACY_MODE === "production" &&
  env.SHIELDED_POOL_CONTRACT_ADDRESS &&
  env.PROOF_VERIFIER_ADDRESS,
);
