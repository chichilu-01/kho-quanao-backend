import express from "express";
import {
  createVariant,
  listVariantsByProduct,
  updateVariant,
  deleteVariant,
} from "../controllers/variants.controller.js";

const router = express.Router();

// ➕ Tạo biến thể
router.post("/", createVariant);

// 📦 Lấy danh sách biến thể của sản phẩm
router.get("/:productId", listVariantsByProduct);

// ✏️ Cập nhật biến thể
router.put("/:id", updateVariant);

// ❌ Xoá biến thể
router.delete("/:id", deleteVariant);

export default router;
