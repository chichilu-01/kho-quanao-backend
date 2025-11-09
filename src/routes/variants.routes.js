// routes/variants.routes.js
import express from "express";
import {
  createVariant,
  listVariantsByProduct,
  updateVariant,
  deleteVariant,
  reduceStock,
  restoreStock,
} from "../controllers/variants.controller.js";

const router = express.Router();

// ➕ Tạo biến thể
router.post("/", createVariant);

// 📦 Lấy danh sách biến thể theo sản phẩm (theo đúng frontend gọi)
router.get("/by-product/:id", listVariantsByProduct);

// ⚙️ Giữ tương thích route cũ (nếu có chỗ nào gọi /variants/:productId)
router.get("/:productId", listVariantsByProduct);

// ✏️ Cập nhật biến thể
router.put("/:id", updateVariant);

// ❌ Xoá biến thể
router.delete("/:id", deleteVariant);

// 🔻 Giảm tồn kho sau khi bán
router.post("/:id/reduce-stock", reduceStock);

// 🔺 Cộng lại tồn kho khi huỷ đơn hàng
router.post("/:id/restore-stock", restoreStock);

export default router;
