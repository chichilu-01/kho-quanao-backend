import { Router } from "express";
import {
  createCustomer,
  listCustomers,
  getCustomerDetail,
  updateCustomer,
  deleteCustomer,
} from "../controllers/customers.controller.js";

const router = Router();

// 🔹 Thêm khách hàng
router.post("/", createCustomer);

// 🔹 Lấy danh sách khách hàng
router.get("/", listCustomers);

// 🔹 Xem chi tiết 1 khách (bao gồm lịch sử mua hàng)
router.get("/:id", getCustomerDetail);

// 🔹 Cập nhật thông tin khách hàng
router.put("/:id", updateCustomer);

// 🔹 Xoá khách hàng
router.delete("/:id", deleteCustomer);

export default router;
