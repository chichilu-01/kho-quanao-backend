import { pool } from "../db.js";

// ✅ Tạo đơn hàng mới
export const createOrder = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { customer_id, note, items } = req.body;

    if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Thiếu dữ liệu đầu vào" });
    }

    await connection.beginTransaction();

    // 1️⃣ Tính tổng tiền
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.price * item.quantity;
    }

    // 2️⃣ Tạo đơn hàng
    const [orderResult] = await connection.query(
      `INSERT INTO orders (customer_id, subtotal, total, note)
       VALUES (?, ?, ?, ?)`,
      [customer_id, subtotal, subtotal, note || null],
    );
    const orderId = orderResult.insertId;

    // 3️⃣ Thêm từng item và trừ tồn kho
    for (const item of items) {
      await connection.query(
        `INSERT INTO order_items (order_id, variant_id, quantity, price)
         VALUES (?, ?, ?, ?)`,
        [orderId, item.variant_id, item.quantity, item.price],
      );

      // Cập nhật tồn kho
      await connection.query(
        `UPDATE product_variants
         SET stock = stock - ?
         WHERE id = ? AND stock >= ?`,
        [item.quantity, item.variant_id, item.quantity],
      );

      // Ghi log chuyển động kho
      await connection.query(
        `INSERT INTO stock_movements (variant_id, change_qty, reason, reference_id)
         VALUES (?, ?, 'order', ?)`,
        [item.variant_id, -item.quantity, orderId],
      );
    }

    await connection.commit();

    res.status(201).json({
      id: orderId,
      message: "Tạo đơn hàng thành công",
    });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    connection.release();
  }
};

// ✅ Lấy danh sách đơn hàng (có ảnh sản phẩm + thông tin khách hàng)
export const listOrders = async (req, res) => {
  try {
    // Lấy danh sách đơn hàng + khách
    const [orders] = await pool.query(`
      SELECT o.*, c.name AS customer_name, c.phone, c.address
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      ORDER BY o.id DESC
    `);

    // Lấy chi tiết từng sản phẩm trong đơn
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

    // Gắn items vào từng đơn hàng
    const orderMap = {};
    for (const order of orders) {
      order.items = [];
      orderMap[order.id] = order;
    }

    for (const it of items) {
      if (orderMap[it.order_id]) {
        orderMap[it.order_id].items.push(it);
      }
    }

    res.json(orders);
  } catch (err) {
    console.error("❌ Lỗi listOrders:", err);
    res.status(500).json({ message: err.message });
  }
};
