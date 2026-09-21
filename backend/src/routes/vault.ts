import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { getHistory, getNotes, getPoolState, prepareShield, prepareUnshield, attachNote } from "../controllers/vaultController";

const router = Router();
const moneyLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
router.use(requireAuth, moneyLimit);
router.post("/shield/prepare", asyncHandler<AuthedRequest>(prepareShield));
router.post("/unshield/prepare", asyncHandler<AuthedRequest>(prepareUnshield));
router.post("/notes/attach", asyncHandler<AuthedRequest>(attachNote));
router.get("/notes", asyncHandler<AuthedRequest>(getNotes));
router.get("/pool", asyncHandler<AuthedRequest>(getPoolState));
router.get("/history", asyncHandler<AuthedRequest>(getHistory));
export default router;
