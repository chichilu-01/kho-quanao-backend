import { pool } from "../db.js";

// ✅ Size
export const getSizes = async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM sizes ORDER BY id ASC");
  res.json(rows);
};

export const addSize = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: "Thiếu tên size" });
  try {
    await pool.query("INSERT IGNORE INTO sizes (name) VALUES (?)", [name]);
    res.json({ message: "Đã thêm size mới" });
  } catch (e) {
    res.status(500).json({ message: "Lỗi khi thêm size" });
  }
};

// ✅ Color
export const getColors = async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM colors ORDER BY id ASC");
  res.json(rows);
};

export const addColor = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: "Thiếu tên màu" });
  try {
    await pool.query("INSERT IGNORE INTO colors (name) VALUES (?)", [name]);
    res.json({ message: "Đã thêm màu mới" });
  } catch (e) {
    res.status(500).json({ message: "Lỗi khi thêm màu" });
  }
};
