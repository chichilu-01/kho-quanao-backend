import { Router } from "express";
import {
  createCustomer,
  listCustomers,
} from "../controllers/customers.controller.js";
const router = Router();

router.post("/", createCustomer);
router.get("/", listCustomers);

export default router;
