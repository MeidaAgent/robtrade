import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { getSettlement, listSettlements } from "../controllers/settlementController";

const router = Router();

router.use(requireAuth);
router.get("/", asyncHandler<AuthedRequest>(listSettlements));
router.get("/:txHash", asyncHandler<AuthedRequest>(getSettlement));

export default router;
