import { pool } from "./db.js";

const testConnection = async () => {
  try {
    const [rows] = await pool.query("SELECT NOW() AS time");
    console.log("✅ Kết nối MySQL thành công:", rows[0]);
  } catch (err) {
    console.error("❌ Kết nối thất bại:", err.message);
  }
};

testConnection();
