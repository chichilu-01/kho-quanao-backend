import { pool } from "../db.js";

// ✅ Tạo sản phẩm mới
export const createProduct = async (req, res) => {
  const { sku, name, category, cost_price, sale_price, cover_image } = req.body;
  if (!sku || !name)
    return res.status(400).json({ message: "Thiếu SKU hoặc tên sản phẩm" });

  try {
    const [result] = await pool.query(
      "INSERT INTO products (sku, name, category, cost_price, sale_price, cover_image) VALUES (?, ?, ?, ?, ?, ?)",
      [
        sku.trim().toUpperCase(),
        name.trim(),
        category || null,
        cost_price || 0,
        sale_price || 0,
        cover_image || null,
      ],
    );
    res
      .status(201)
      .json({ id: result.insertId, message: "Tạo sản phẩm thành công" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "SKU đã tồn tại" });
    }
    res.status(500).json({ message: err.message });
  }
};

// ✅ Lấy danh sách sản phẩm (tìm theo tên hoặc SKU)
export const listProducts = async (req, res) => {
  const { q } = req.query;
  let sql = "SELECT * FROM products";
  const params = [];
  if (q) {
    sql += " WHERE name LIKE ? OR sku LIKE ?";
    params.push(`%${q}%`, `%${q}%`);
  }
  const [rows] = await pool.query(sql, params);
  res.json(rows);
};

// ✅ Tìm kiếm nhanh theo mã hàng (SKU)
export const findByCode = async (req, res) => {
  const code = (req.query.code || "").trim().toUpperCase();
  if (!code) return res.status(400).json({ message: "Thiếu mã sản phẩm" });

  const [rows] = await pool.query(
    "SELECT * FROM products WHERE sku = ? LIMIT 1",
    [code],
  );
  if (rows.length === 0)
    return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

  res.json(rows[0]);
};
