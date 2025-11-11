import express from "express";
import {
  createProduct,
  updateProduct,
  listProducts,
  findByCode,
  uploadImage,
  getVariantsByProduct,
  getProductWithVariants, // 🟢 thêm dòng này
  deleteProduct,
} from "../controllers/products.controller.js";

const router = express.Router();

// 📋 Danh sách sản phẩm
router.get("/", listProducts);

// 🔍 Tìm theo mã hoặc tên
router.get("/search", findByCode);

// 📦 Lấy sản phẩm + toàn bộ biến thể (full detail)
router.get("/:id/full", getProductWithVariants); // 🟢 thêm dòng này

// 🧩 Lấy danh sách biến thể theo product_id
router.get("/:product_id/variants", getVariantsByProduct);

// ➕ Tạo sản phẩm mới
router.post("/", uploadImage, createProduct);

// ✏️ Cập nhật sản phẩm
router.put("/:id", uploadImage, updateProduct);

// 🗑️ Xóa sản phẩm
router.delete("/:id", deleteProduct);

export default router;
