import { pool } from "../db.js";

// ✅ Ghi lịch sử xuất nhập kho
async function recordMovement(
  variant_id,
  change_qty,
  reason,
  reference_id = null,
) {
  await pool.query(
    `INSERT INTO stock_movements (variant_id, change_qty, reason, reference_id)
     VALUES (?, ?, ?, ?)`,
    [variant_id, change_qty, reason, reference_id],
  );
}

// ✅ Tính lại tổng tồn kho cho sản phẩm cha
async function updateProductStock(variant_id) {
  await pool.query(
    `UPDATE products p
     JOIN product_variants v2 ON v2.id = ?
     SET p.stock = (
       SELECT COALESCE(SUM(v.stock), 0)
       FROM product_variants v
       WHERE v.product_id = v2.product_id
     )
     WHERE p.id = v2.product_id`,
    [variant_id],
  );
}

// ✅ Nhập hàng (Import)
export const importStock = async (req, res) => {
  const { variant_id, quantity } = req.body;
  if (!variant_id || !quantity)
    return res.status(400).json({ message: "Thiếu variant_id hoặc quantity" });

  try {
    // Kiểm tra xem variant_id này có tồn tại trong product_variants không
    const [checkVar] = await pool.query(
      `SELECT * FROM product_variants WHERE id = ?`,
      [variant_id],
    );

    if (checkVar.length) {
      // ✅ Trường hợp có biến thể
      await pool.query(
        `UPDATE product_variants SET stock = stock + ? WHERE id = ?`,
        [quantity, variant_id],
      );

      // Ghi lịch sử
      await recordMovement(variant_id, quantity, "import");

      // Cập nhật tổng stock sản phẩm cha
      await updateProductStock(variant_id);
    } else {
      // ✅ Trường hợp không có biến thể (nhập trực tiếp sản phẩm)
      await pool.query(`UPDATE products SET stock = stock + ? WHERE id = ?`, [
        quantity,
        variant_id,
      ]);

      // Ghi lịch sử (không có variant)
      await pool.query(
        `INSERT INTO stock_movements (variant_id, change_qty, reason)
         VALUES (NULL, ?, 'import')`,
        [quantity],
      );
    }

    res.json({ message: `✅ Đã nhập thêm ${quantity} sản phẩm vào kho` });
  } catch (err) {
    console.error("❌ importStock:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Xuất kho (Bán hàng)
export const sellStock = async (req, res) => {
  const { variant_id, quantity } = req.body;
  if (!variant_id || !quantity)
    return res.status(400).json({ message: "Thiếu variant_id hoặc quantity" });

  try {
    const [rows] = await pool.query(
      `SELECT stock FROM product_variants WHERE id = ?`,
      [variant_id],
    );
    if (!rows.length)
      return res.status(404).json({ message: "Không tìm thấy biến thể" });

    const currentStock = rows[0].stock;
    if (currentStock < quantity)
      return res.status(400).json({ message: "Không đủ hàng trong kho" });

    await pool.query(
      `UPDATE product_variants SET stock = stock - ? WHERE id = ?`,
      [quantity, variant_id],
    );

    await recordMovement(variant_id, -quantity, "export");
    await updateProductStock(variant_id);

    res.json({ message: `✅ Đã xuất ${quantity} sản phẩm khỏi kho` });
  } catch (err) {
    console.error("❌ sellStock:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Lịch sử xuất nhập kho (hiển thị đúng sản phẩm)
export const listStockMovements = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        sm.id,
        sm.created_at,
        sm.change_qty,
        sm.reason,
        pv.variant_sku,
        pv.size,
        pv.color,
        p.name AS product_name,
        p.brand,
        p.sku AS product_sku
      FROM stock_movements sm
      JOIN product_variants pv ON sm.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      ORDER BY sm.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("❌ listStockMovements:", err);
    res.status(500).json({ message: err.message });
  }
};
