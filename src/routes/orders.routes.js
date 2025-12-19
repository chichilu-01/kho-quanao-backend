import express from "express";
import {
  createOrder,
  listOrders,
  getOrderDetail, // 👈 1. Thêm cái này
  updateOrderStatus,
  getOrderStatus,
  updateTrackingCode,
} from "../controllers/orders.controller.js";

const router = express.Router();
console.log("✅ Orders routes loaded");

// Tạo đơn và Lấy danh sách
router.post("/", createOrder);
router.get("/", listOrders);

// 🆕 2. [QUAN TRỌNG] Route lấy chi tiết đơn hàng (Cần cái này để hiện SĐT, Địa chỉ)
router.get("/:id", getOrderDetail);

// Lấy trạng thái đơn
router.get("/:id/status", getOrderStatus);

// Cập nhật trạng thái
router.put("/:id/status", updateOrderStatus);

// Cập nhật mã vận đơn
router.put("/:id/tracking", updateTrackingCode);

export default router;
