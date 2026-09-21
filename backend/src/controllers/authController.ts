import { Request, Response } from "express";
import { z } from "zod";
import { issueNonce, verifySiwe } from "../services/authService";

const nonceSchema = z.object({ address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) });
const verifySchema = z.object({
  message: z.string().min(1).max(10_000),
  signature: z.string().min(1).max(2_000),
});

export async function getNonce(req: Request, res: Response) {
  const { address } = nonceSchema.parse(req.body);
  const nonce = await issueNonce(address);
  res.setHeader("Cache-Control", "no-store");
  res.json({ nonce });
}

export async function verify(req: Request, res: Response) {
  const body = verifySchema.parse(req.body);
  const { token, address } = await verifySiwe(body);
  res.setHeader("Cache-Control", "no-store");
  res.json({ token, address });
}
