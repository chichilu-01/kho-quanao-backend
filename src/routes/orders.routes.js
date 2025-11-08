import express from "express";
import { createOrder, listOrders } from "../controllers/orders.controller.js";

const router = express.Router();

// Tạo đơn hàng
router.post("/", createOrder);

// Lấy danh sách đơn hàng kèm ảnh sản phẩm
router.get("/", listOrders);

export default router;
