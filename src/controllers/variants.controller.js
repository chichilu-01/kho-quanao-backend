import { pool } from "../db.js";

// ✅ Tạo biến thể mới
export const createVariant = async (req, res) => {
  const { product_id, size, color, variant_sku, stock } = req.body;

  if (!product_id) return res.status(400).json({ message: "Thiếu product_id" });

  try {
    const [result] = await pool.query(
      `INSERT INTO product_variants (product_id, size, color, variant_sku, stock)
       VALUES (?, ?, ?, ?, ?)`,
      [
        product_id,
        size || null,
        color || null,
        variant_sku || null,
        stock || 0,
      ],
    );

    res
      .status(201)
      .json({ id: result.insertId, message: "Tạo biến thể thành công" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "variant_sku đã tồn tại" });
    }
    res.status(500).json({ message: err.message });
  }
};

// ✅ Lấy tất cả biến thể của 1 sản phẩm
export const listVariantsByProduct = async (req, res) => {
  const { productId } = req.params;

  const [rows] = await pool.query(
    "SELECT * FROM product_variants WHERE product_id = ?",
    [productId],
  );

  res.json(rows);
};
