import express from "express";
import {
  getDashboardStats,
  getTopBrands,
  getTopProducts,
} from "../controllers/dashboard.controller.js";

const router = express.Router();

// 📊 Tổng hợp thống kê
router.get("/stats", getDashboardStats);

// 🏷️ Top thương hiệu tồn kho
router.get("/top-brands", getTopBrands);

// 🏆 Top sản phẩm bán chạy
router.get("/top-products", getTopProducts);

export default router;
