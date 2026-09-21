import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../lib/asyncHandler";
import { getNonce, verify } from "../controllers/authController";

const router = Router();
const authLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authLimit);
router.post("/nonce", asyncHandler(getNonce));
router.post("/verify", asyncHandler(verify));

export default router;
