import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db.js";

import productsRouter from "./routes/products.routes.js";
import variantsRouter from "./routes/variants.routes.js";
import stockRouter from "./routes/stock.routes.js";
import customersRouter from "./routes/customers.routes.js";
import ordersRouter from "./routes/orders.routes.js";

dotenv.config();
const app = express();
app.use(
  cors({
    origin:
      "https://f5afe18c-a293-4f59-8649-cc82af0d7d46-00-1144g3c0jfi8g.sisko.replit.dev/",
  }),
);
app.use(express.json());

// ✅ Kiểm tra kết nối DB
app.get("/api/health", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({ ok: rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ✅ Gắn routes
app.use("/api/products", productsRouter);
app.use("/api/variants", variantsRouter);
app.use("/api/stock", stockRouter);
app.use("/api/customers", customersRouter);
app.use("/api/orders", ordersRouter);

// ✅ Route mặc định để kiểm tra nhanh
app.get("/", (req, res) => {
  res.send("Server running! Try /api/health or /api/orders");
});

// ✅ Cuối cùng mới khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
