import express from "express";
import {
  getSizes,
  addSize,
  getColors,
  addColor,
} from "../controllers/options.controller.js";
const router = express.Router();

// 🔹 Size
router.get("/sizes", getSizes);
router.post("/sizes", addSize);

// 🔹 Color
router.get("/colors", getColors);
router.post("/colors", addColor);

export default router;
