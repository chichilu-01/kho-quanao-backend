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
    [variant_id || null, change_qty, reason, reference_id],
  );
}

// ✅ Tính lại tổng tồn kho cho sản phẩm cha
async function updateProductStockByVariant(variant_id) {
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

// ✅ Tính lại tổng tồn kho cho sản phẩm theo product_id
async function updateProductStockByProduct(product_id) {
  await pool.query(
    `UPDATE products p
     SET p.stock = (
       SELECT COALESCE(SUM(v.stock), 0)
       FROM product_variants v
       WHERE v.product_id = p.id
     )
     WHERE p.id = ?`,
    [product_id],
  );
}

// ✅ Nhập hàng (Import)
export const importStock = async (req, res) => {
  const { product_id, variant_id, quantity } = req.body;
  if (!quantity || quantity <= 0) {
    return res.status(400).json({ message: "Thiếu hoặc sai số lượng nhập" });
  }

  try {
    // ✅ Ưu tiên nhập theo variant_id (nếu có)
    if (variant_id) {
      const [checkVar] = await pool.query(
        `SELECT id, product_id FROM product_variants WHERE id = ?`,
        [variant_id],
      );

      if (!checkVar.length)
        return res.status(404).json({ message: "Không tìm thấy biến thể" });

      await pool.query(
        `UPDATE product_variants SET stock = stock + ? WHERE id = ?`,
        [quantity, variant_id],
      );

      // Ghi lịch sử và cập nhật tổng tồn kho
      await recordMovement(variant_id, quantity, "import");
      await updateProductStockByVariant(variant_id);

      return res.json({
        message: `✅ Đã nhập thêm ${quantity} sản phẩm cho biến thể #${variant_id}`,
      });
    }

    // ✅ Nếu không có variant → nhập trực tiếp cho sản phẩm cha
    if (product_id) {
      // Kiểm tra có tồn tại sản phẩm không
      const [checkProduct] = await pool.query(
        `SELECT id FROM products WHERE id = ?`,
        [product_id],
      );

      if (!checkProduct.length)
        return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

      await pool.query(`UPDATE products SET stock = stock + ? WHERE id = ?`, [
        quantity,
        product_id,
      ]);

      await recordMovement(null, quantity, "import");
      return res.json({
        message: `✅ Đã nhập thêm ${quantity} sản phẩm vào kho`,
      });
    }

    res.status(400).json({ message: "Thiếu product_id hoặc variant_id" });
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
    await updateProductStockByVariant(variant_id);

    res.json({ message: `✅ Đã xuất ${quantity} sản phẩm khỏi kho` });
  } catch (err) {
    console.error("❌ sellStock:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Lịch sử xuất nhập kho (có cả sản phẩm không có biến thể)
export const listStockMovements = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        sm.id,
        sm.created_at,
        sm.change_qty,
        sm.reason,
        pv.id AS variant_id,
        pv.size,
        pv.color,
        p.name AS product_name,
        p.brand,
        p.sku AS product_sku
      FROM stock_movements sm
      LEFT JOIN product_variants pv ON sm.variant_id = pv.id
      LEFT JOIN products p ON 
        (pv.product_id = p.id OR sm.variant_id IS NULL AND p.id IS NOT NULL)
      ORDER BY sm.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("❌ listStockMovements:", err);
    res.status(500).json({ message: err.message });
  }
};
