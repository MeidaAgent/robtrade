import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";

export default async function handler(req: any, res: any) {
  try {
    if (!req.url) {
      req.url = "/";
    }

    if (process.env.NODE_ENV !== "production") {
      logger.info({ url: req.url }, "Vercel handler invoked");
    }

    return app(req, res);
  } catch (error) {
    logger.error({ error }, "Unhandled Vercel request error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

if (process.env.NODE_ENV !== "production") {
  const port = env.PORT || 4000;
  app.listen(port, () => {
    logger.info({ port }, "RobTrade backend started locally");
  });
}

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
