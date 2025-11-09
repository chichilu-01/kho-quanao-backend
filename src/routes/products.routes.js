import express from "express";
import {
  createProduct,
  updateProduct,
  listProducts,
  findByCode,
  uploadImage,
  getVariantsByProduct,
  deleteProduct,
} from "../controllers/products.controller.js";

const router = express.Router();

router.get("/", listProducts);
router.get("/search", findByCode);
router.get("/:product_id/variants", getVariantsByProduct);
router.post("/", uploadImage, createProduct);
router.put("/:id", uploadImage, updateProduct);
router.delete("/:id", deleteProduct);

export default router;
