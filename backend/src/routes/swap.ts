import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { createOrder, quote, submitOrder } from "../controllers/swapController";

const router = Router();
const moneyLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

router.use(requireAuth, moneyLimit);
router.post("/quote", asyncHandler<AuthedRequest>(quote));
router.post("/orders", asyncHandler<AuthedRequest>(createOrder));
router.post("/orders/:orderId/submit", asyncHandler<AuthedRequest>(submitOrder));

export default router;
