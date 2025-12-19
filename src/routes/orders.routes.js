// routes/orders.routes.js
import express from "express";
import {
  createOrder,
  listOrders,
  updateOrderStatus,
  getOrderStatus,
  updateTrackingCode, // 🆕 1. Nhớ import hàm này vào
} from "../controllers/orders.controller.js";

const router = express.Router();
console.log("✅ Orders routes loaded");

// Tạo đơn và Lấy danh sách (đã hỗ trợ tìm kiếm ?q=...)
router.post("/", createOrder);
router.get("/", listOrders);

// Lấy trạng thái đơn (Test)
router.get("/:id/status", getOrderStatus);

// Cập nhật trạng thái (Pending -> Shipping -> Completed)
router.put("/:id/status", updateOrderStatus);

// 🆕 2. [MỚI] API để lưu Mã Vận Đơn từ giao diện chi tiết
// Frontend sẽ gọi: axios.put(`/api/orders/${id}/tracking`, { china_tracking_code: "..." })
router.put("/:id/tracking", updateTrackingCode);

export default router;
