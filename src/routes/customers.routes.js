import { Router } from "express";
import {
  createCustomer,
  listCustomers,
  getCustomerDetail,
} from "../controllers/customers.controller.js";

const router = Router();

router.post("/", createCustomer);
router.get("/", listCustomers);
router.get("/:id", getCustomerDetail);

export default router;
