import express from "express";
import {
  createProduct,
  listProducts,
  findByCode,
  uploadImage,
} from "../controllers/products.controller.js";

const router = express.Router();

router.get("/", listProducts);
router.get("/search", findByCode);

// 🆕 Route POST hỗ trợ upload ảnh
router.post("/", uploadImage, createProduct);

export default router;
