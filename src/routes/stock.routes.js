import { Router } from "express";
import {
  importStock,
  sellStock,
  listStockMovements,
} from "../controllers/stock.controller.js";

const router = Router();

router.post("/import", importStock); // Nhập hàng
router.post("/sell", sellStock); // Bán hàng
router.get("/history", listStockMovements); // Lịch sử

export default router;
