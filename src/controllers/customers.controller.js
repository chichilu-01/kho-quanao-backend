import { pool } from "../db.js";

// ✅ Tạo khách hàng mới
export const createCustomer = async (req, res) => {
  const { name, phone, address, facebook_url, notes } = req.body;
  if (!name) return res.status(400).json({ message: "Thiếu tên khách hàng" });

  try {
    const [result] = await pool.query(
      `INSERT INTO customers (name, phone, address, facebook_url, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [
        name,
        phone || null,
        address || null,
        facebook_url || null,
        notes || null,
      ],
    );
    res
      .status(201)
      .json({ id: result.insertId, message: "Thêm khách hàng thành công" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Lấy danh sách khách hàng
export const listCustomers = async (req, res) => {
  const [rows] = await pool.query(`SELECT * FROM customers ORDER BY id DESC`);
  res.json(rows);
};
