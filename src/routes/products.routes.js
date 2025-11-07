import { Router } from "express";
import {
  createProduct,
  listProducts,
  findByCode,
} from "../controllers/products.controller.js";
const r = Router();

r.get("/", listProducts);
r.post("/", createProduct);
r.get("/find-by-code", findByCode);

export default r;
