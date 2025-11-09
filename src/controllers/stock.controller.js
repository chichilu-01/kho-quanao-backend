import { pool } from "../db.js";

// ✅ Ghi lịch sử thay đổi kho
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

// ✅ Nhập hàng (tăng số lượng)
export const importStock = async (req, res) => {
  try {
    const { variant_id, quantity } = req.body;
    if (!variant_id || !quantity)
      return res
        .status(400)
        .json({ message: "Thiếu variant_id hoặc quantity" });

    // Cập nhật số lượng
    await pool.query(
      `UPDATE product_variants SET stock = stock + ? WHERE id = ?`,
      [quantity, variant_id],
    );

    // Ghi lịch sử
    await recordMovement(variant_id, quantity, "import");

    res.json({ message: `✅ Đã nhập thêm ${quantity} sản phẩm vào kho` });
  } catch (err) {
    console.error("❌ Lỗi importStock:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Bán hàng (giảm số lượng)
export const sellStock = async (req, res) => {
  try {
    const { variant_id, quantity } = req.body;
    if (!variant_id || !quantity)
      return res
        .status(400)
        .json({ message: "Thiếu variant_id hoặc quantity" });

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

    await recordMovement(variant_id, -quantity, "order");

    res.json({ message: `✅ Đã bán ${quantity} sản phẩm` });
  } catch (err) {
    console.error("❌ Lỗi sellStock:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Xem lịch sử nhập / xuất
export const listStockMovements = async (req, res) => {
  try {
    const { reason, start, end } = req.query;
    let sql = `
      SELECT sm.*, pv.variant_sku
      FROM stock_movements sm
      JOIN product_variants pv ON sm.variant_id = pv.id
      WHERE 1=1
    `;
    const params = [];

    if (reason && reason !== "all") {
      sql += " AND sm.reason = ?";
      params.push(reason);
    }

    if (start) {
      sql += " AND sm.created_at >= ?";
      params.push(start);
    }

    if (end) {
      sql += " AND sm.created_at <= ?";
      params.push(end + " 23:59:59");
    }

    sql += " ORDER BY sm.created_at DESC";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("❌ Lỗi listStockMovements:", err);
    res.status(500).json({ message: err.message });
  }
};
