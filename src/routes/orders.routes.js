import express from "express";
import {
  createOrder,
  listOrders,
  updateOrderStatus,
} from "../controllers/orders.controller.js";

const router = express.Router();

router.post("/", createOrder);
router.get("/", listOrders);
router.put("/:id/status", updateOrderStatus);

export default router;
