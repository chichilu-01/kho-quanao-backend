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

    // 3️⃣ Thêm từng item vào order_items + cập nhật kho
    for (const item of items) {
      const { variant_id, quantity, price } = item;

      // Thêm dòng chi tiết sản phẩm
      await connection.query(
        `INSERT INTO order_items (order_id, variant_id, quantity, price)
         VALUES (?, ?, ?, ?)`,
        [orderId, variant_id, quantity, price],
      );

      // Trừ tồn kho của biến thể
      const [updateResult] = await connection.query(
        `UPDATE product_variants
         SET stock = stock - ?
         WHERE id = ? AND stock >= ?`,
        [quantity, variant_id, quantity],
      );

      if (updateResult.affectedRows === 0) {
        throw new Error(`❌ Biến thể ID ${variant_id} không đủ hàng trong kho`);
      }

      // Ghi log vào stock_movements
      await connection.query(
        `INSERT INTO stock_movements (variant_id, change_qty, reason, reference_id)
         VALUES (?, ?, 'order', ?)`,
        [variant_id, -quantity, orderId],
      );

      // ✅ Cập nhật tổng tồn kho sản phẩm chính
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

    res.status(201).json({
      id: orderId,
      message: "✅ Tạo đơn hàng thành công!",
    });
  } catch (err) {
    await connection.rollback();
    console.error("❌ Lỗi createOrder:", err);
    res.status(500).json({ message: err.message });
  } finally {
    connection.release();
  }
};

// ✅ Lấy danh sách đơn hàng (kèm ảnh sản phẩm + thông tin khách hàng)
export const listOrders = async (req, res) => {
  try {
    // Lấy danh sách đơn hàng + thông tin khách hàng
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

// ✅ Cập nhật trạng thái đơn hàng
export const updateOrderStatus = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "shipped", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ" });
    }

    const [result] = await connection.query(
      "UPDATE orders SET status = ? WHERE id = ?",
      [status, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    res.json({
      message: `✅ Đã cập nhật trạng thái đơn hàng #${id} thành '${status}'`,
    });
  } catch (err) {
    console.error("❌ updateOrderStatus:", err);
    res.status(500).json({ message: "Lỗi server khi cập nhật trạng thái" });
  } finally {
    connection.release();
  }
};
