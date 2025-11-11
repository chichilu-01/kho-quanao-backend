// controllers/orders.controller.js
import { pool } from "../db.js";

//
// 🆕 Lấy trạng thái đơn hàng
//
export const getOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      "SELECT id, status FROM orders WHERE id = ?",
      [id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }
    res.json({ id: rows[0].id, status: rows[0].status });
  } catch (err) {
    console.error("❌ getOrderStatus:", err);
    res.status(500).json({ message: "Lỗi server khi lấy trạng thái đơn hàng" });
  }
};

//
// ✅ Tạo đơn hàng mới
//
export const createOrder = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { customer_id, note, items } = req.body;

    if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Thiếu dữ liệu đầu vào (customer_id hoặc items)" });
    }

    await connection.beginTransaction();

    // 1️⃣ Tính tổng tiền
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // 2️⃣ Tạo đơn hàng
    const [orderResult] = await connection.query(
      `INSERT INTO orders (customer_id, subtotal, total, note, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', NOW())`,
      [customer_id, subtotal, subtotal, note || null],
    );
    const orderId = orderResult.insertId;

    // 3️⃣ Ghi các dòng chi tiết và trừ kho
    for (const item of items) {
      const { variant_id, quantity, price } = item;
      if (!variant_id || !quantity)
        throw new Error(`Thiếu dữ liệu biến thể cho đơn #${orderId}`);

      await connection.query(
        `INSERT INTO order_items (order_id, variant_id, quantity, price)
         VALUES (?, ?, ?, ?)`,
        [orderId, variant_id, quantity, price],
      );

      const [updateResult] = await connection.query(
        `UPDATE product_variants
         SET stock = stock - ?
         WHERE id = ? AND stock >= ?`,
        [quantity, variant_id, quantity],
      );

      if (updateResult.affectedRows === 0)
        throw new Error(`❌ Biến thể ${variant_id} không đủ hàng trong kho`);

      await connection.query(
        `INSERT INTO stock_movements (variant_id, change_qty, reason, reference_id, created_at)
         VALUES (?, ?, 'order', ?, NOW())`,
        [variant_id, -quantity, orderId],
      );

      await connection.query(
        `UPDATE products
         SET stock = (
           SELECT COALESCE(SUM(stock), 0)
           FROM product_variants
           WHERE product_id = (
             SELECT product_id FROM product_variants WHERE id = ?
           )
         )
         WHERE id = (
           SELECT product_id FROM product_variants WHERE id = ?
         )`,
        [variant_id, variant_id],
      );
    }

    await connection.commit();
    console.log(`✅ Đơn hàng #${orderId} đã tạo thành công`);

    res.status(201).json({
      id: orderId,
      message: "✅ Tạo đơn hàng thành công!",
      total: subtotal,
    });
  } catch (err) {
    await connection.rollback();
    console.error("❌ Lỗi createOrder:", err.message);
    res
      .status(500)
      .json({ message: err.message || "Lỗi server khi tạo đơn hàng" });
  } finally {
    connection.release();
  }
};

//
// ✅ Lấy danh sách đơn hàng (kèm khách hàng + sản phẩm)
//
export const listOrders = async (_req, res) => {
  try {
    const [orders] = await pool.query(`
      SELECT o.*, c.name AS customer_name, c.phone, c.address
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      ORDER BY o.id DESC
    `);

    const [items] = await pool.query(`
      SELECT 
        oi.order_id,
        oi.quantity,
        oi.price,
        pv.size,
        pv.color,
        p.name AS product_name,
        p.sku,
        p.cover_image
      FROM order_items oi
      JOIN product_variants pv ON oi.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      ORDER BY oi.order_id DESC
    `);

    const map = Object.fromEntries(
      orders.map((o) => [o.id, { ...o, items: [] }]),
    );
    for (const it of items) {
      if (map[it.order_id]) map[it.order_id].items.push(it);
    }

    res.json(Object.values(map));
  } catch (err) {
    console.error("❌ Lỗi listOrders:", err);
    res.status(500).json({ message: "Lỗi server khi lấy danh sách đơn hàng" });
  }
};

//
// ✅ Cập nhật trạng thái đơn hàng
//
//
// ✅ Cập nhật trạng thái đơn hàng (đầy đủ 5 trạng thái ENUM)
//
export const updateOrderStatus = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { status } = req.body;

    // ⚙️ Danh sách hợp lệ (khớp ENUM trong MySQL)
    const validStatuses = [
      "pending",
      "confirmed",
      "shipped",
      "completed",
      "cancelled",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Trạng thái không hợp lệ: ${status}. Hợp lệ gồm: ${validStatuses.join(
          ", ",
        )}`,
      });
    }

    // ⚙️ Cập nhật trạng thái
    const [result] = await connection.query(
      "UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?",
      [status, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    console.log(`🔄 Đơn hàng #${id} => ${status}`);
    res.json({
      message: `✅ Cập nhật trạng thái đơn hàng #${id} thành công (${status})`,
    });
  } catch (err) {
    console.error("❌ updateOrderStatus:", err);
    res.status(500).json({ message: "Lỗi server khi cập nhật trạng thái" });
  } finally {
    connection.release();
  }
};
