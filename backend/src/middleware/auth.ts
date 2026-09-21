import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AuthedRequest extends Request {
  userId?: string;
  walletAddress?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token tidak ada. Login lewat /auth/nonce + /auth/verify dulu." });
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token || token.length > 8192) {
    return res.status(401).json({ error: "Token tidak valid." });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "robtrade-api",
      audience: "robtrade-web",
    }) as jwt.JwtPayload & { address?: string };

    if (typeof payload.sub !== "string" || !payload.address) {
      return res.status(401).json({ error: "Token tidak valid." });
    }

    req.userId = payload.sub;
    req.walletAddress = payload.address.toLowerCase();
    next();
  } catch {
    return res.status(401).json({ error: "Token tidak valid atau kedaluwarsa." });
  }
}
