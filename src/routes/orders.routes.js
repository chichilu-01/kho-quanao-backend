// routes/orders.routes.js
import express from "express";
import {
  createOrder,
  listOrders,
  updateOrderStatus,
  getOrderStatus, // 🆕
} from "../controllers/orders.controller.js";

const router = express.Router();

router.post("/", createOrder);
router.get("/", listOrders);

// 🆕 Cho phép GET để test trực tiếp (fix lỗi Cannot GET)
router.get("/:id/status", getOrderStatus);

// ✅ Dành cho frontend cập nhật
router.put("/:id/status", updateOrderStatus);

export default router;
