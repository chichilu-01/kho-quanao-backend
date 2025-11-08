import { Router } from "express";
import {
  createCustomer,
  listCustomers,
  getCustomerDetail,
} from "../controllers/customers.controller.js";

const router = Router();

// ➕ Thêm khách hàng
router.post("/", createCustomer);

// 📋 Lấy danh sách khách hàng
router.get("/", listCustomers);

// 🔍 Xem chi tiết khách + lịch sử mua hàng
router.get("/:id", getCustomerDetail);

export default router;
