import { pool } from "../db.js";

//
// ✅ Tạo biến thể mới
//
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

    res.status(201).json({
      id: result.insertId,
      message: "✅ Tạo biến thể thành công",
    });
  } catch (err) {
    console.error("❌ createVariant:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "variant_sku đã tồn tại" });
    }
    res.status(500).json({ message: "Lỗi server khi tạo biến thể" });
  }
};

//
// ✅ Lấy tất cả biến thể của 1 sản phẩm
//
export const listVariantsByProduct = async (req, res) => {
  const { productId } = req.params;
  try {
    const [rows] = await pool.query(
      "SELECT * FROM product_variants WHERE product_id = ? ORDER BY id DESC",
      [productId],
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ listVariantsByProduct:", err);
    res.status(500).json({ message: "Lỗi server khi lấy danh sách biến thể" });
  }
};

//
// ✅ Cập nhật thông tin biến thể
//
export const updateVariant = async (req, res) => {
  const { id } = req.params;
  const { size, color, variant_sku, stock } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE product_variants 
       SET size = ?, color = ?, variant_sku = ?, stock = ?
       WHERE id = ?`,
      [size || null, color || null, variant_sku || null, stock || 0, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Không tìm thấy biến thể" });
    }

    res.json({ message: "✅ Cập nhật biến thể thành công" });
  } catch (err) {
    console.error("❌ updateVariant:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "variant_sku đã tồn tại" });
    }
    res.status(500).json({ message: "Lỗi server khi cập nhật biến thể" });
  }
};

//
// ✅ Xoá biến thể
//
export const deleteVariant = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      "DELETE FROM product_variants WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Không tìm thấy biến thể" });
    }

    res.json({ message: "🗑️ Xoá biến thể thành công" });
  } catch (err) {
    console.error("❌ deleteVariant:", err);
    res.status(500).json({ message: "Lỗi server khi xoá biến thể" });
  }
};
