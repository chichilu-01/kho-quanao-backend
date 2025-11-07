import { Router } from "express";
import {
  createVariant,
  listVariantsByProduct,
} from "../controllers/variants.controller.js";

const router = Router();

router.post("/", createVariant);
router.get("/by-product/:productId", listVariantsByProduct);

export default router;
