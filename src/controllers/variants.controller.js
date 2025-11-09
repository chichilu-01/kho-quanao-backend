// controllers/variants.controller.js
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
// ✅ Lấy danh sách biến thể theo product_id
//
export const listVariantsByProduct = async (req, res) => {
  // Cho phép đọc cả /by-product/:id và /:productId
  const productId = req.params.id || req.params.productId;

  if (!productId) return res.status(400).json({ message: "Thiếu ID sản phẩm" });

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
// ✅ Cập nhật biến thể
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

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Không tìm thấy biến thể" });

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

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Không tìm thấy biến thể" });

    res.json({ message: "🗑️ Xoá biến thể thành công" });
  } catch (err) {
    console.error("❌ deleteVariant:", err);
    res.status(500).json({ message: "Lỗi server khi xoá biến thể" });
  }
};

//
// 🔻 Giảm tồn kho khi bán hàng
//
export const reduceStock = async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity <= 0)
    return res.status(400).json({ message: "Số lượng không hợp lệ" });

  try {
    const [[variant]] = await pool.query(
      "SELECT stock FROM product_variants WHERE id = ?",
      [id],
    );

    if (!variant)
      return res.status(404).json({ message: "Không tìm thấy biến thể" });

    if (variant.stock < quantity) {
      return res.status(400).json({
        message: `Tồn kho không đủ (hiện còn ${variant.stock})`,
      });
    }

    await pool.query(
      "UPDATE product_variants SET stock = stock - ? WHERE id = ?",
      [quantity, id],
    );

    res.json({ message: `✅ Đã trừ ${quantity} sản phẩm khỏi tồn kho` });
  } catch (err) {
    console.error("❌ reduceStock:", err);
    res.status(500).json({ message: "Lỗi server khi giảm tồn kho" });
  }
};

//
// 🔺 Cộng lại tồn kho khi huỷ đơn hàng
//
export const restoreStock = async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity <= 0)
    return res.status(400).json({ message: "Số lượng không hợp lệ" });

  try {
    await pool.query(
      "UPDATE product_variants SET stock = stock + ? WHERE id = ?",
      [quantity, id],
    );

    res.json({ message: `🔁 Đã hoàn lại ${quantity} sản phẩm vào tồn kho` });
  } catch (err) {
    console.error("❌ restoreStock:", err);
    res.status(500).json({ message: "Lỗi server khi hoàn lại tồn kho" });
  }
};
