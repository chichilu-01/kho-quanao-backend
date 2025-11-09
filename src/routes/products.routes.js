import express from "express";
import {
  createProduct,
  listProducts,
  findByCode,
  uploadImage,
  getVariantsByProduct,
} from "../controllers/products.controller.js";

const router = express.Router();

router.get("/", listProducts);
router.get("/search", findByCode);
router.get("/:product_id/variants", getVariantsByProduct);
router.post("/", uploadImage, createProduct);

export default router;
