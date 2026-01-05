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
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ getOrderStatus:", err);
    res.status(500).json({ message: "Lỗi server khi lấy trạng thái đơn hàng" });
  }
};

//
// ✅ Tạo đơn hàng mới (Đã thêm: china_tracking_code)
//
export const createOrder = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    // 👇 Thêm tracking_code vào body nhận
    const { customer_id, note, items, china_tracking_code } = req.body;

    if (!customer_id || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Thiếu dữ liệu (customer_id hoặc items)" });
    }

    await connection.beginTransaction();

    // 1️⃣ Tính tổng tiền
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // 2️⃣ Tạo đơn hàng (Đã sửa SQL để lưu tracking code)
    const [orderResult] = await connection.query(
      `INSERT INTO orders (customer_id, subtotal, total, note, china_tracking_code, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
      [
        customer_id,
        subtotal,
        subtotal,
        note || null,
        china_tracking_code || null,
      ],
    );
    const orderId = orderResult.insertId;

    // 3️⃣ Thêm sản phẩm & trừ kho
    for (const item of items) {
      const { variant_id, quantity, price } = item;
      if (!variant_id || !quantity)
        throw new Error(`Thiếu dữ liệu biến thể cho đơn #${orderId}`);

      await connection.query(
        `INSERT INTO order_items (order_id, variant_id, quantity, price)
         VALUES (?, ?, ?, ?)`,
        [orderId, variant_id, quantity, price],
      );

      // Trừ kho
      const [updateResult] = await connection.query(
        `UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ?`,
        [quantity, variant_id, quantity],
      );
      if (updateResult.affectedRows === 0)
        throw new Error(`❌ Biến thể ${variant_id} không đủ hàng trong kho`);

      // Ghi lịch sử kho
      await connection.query(
        `INSERT INTO stock_movements (variant_id, change_qty, reason, reference_id, created_at)
         VALUES (?, ?, 'order', ?, NOW())`,
        [variant_id, -quantity, orderId],
      );

      // Update parent product stock... (Giữ nguyên logic của bạn)
      await connection.query(
        `UPDATE products SET stock = (SELECT COALESCE(SUM(stock), 0) FROM product_variants WHERE product_id = (SELECT product_id FROM product_variants WHERE id = ?)) WHERE id = (SELECT product_id FROM product_variants WHERE id = ?)`,
        [variant_id, variant_id],
      );
    }

    await connection.commit();
    res.status(201).json({
      id: orderId,
      message: "✅ Tạo đơn hàng thành công!",
      total: subtotal,
    });
  } catch (err) {
    await connection.rollback();
    console.error("❌ createOrder:", err.message);
    res
      .status(500)
      .json({ message: err.message || "Lỗi server khi tạo đơn hàng" });
  } finally {
    connection.release();
  }
};

//
// 🔍 Lấy danh sách đơn hàng (Nâng cấp: Hỗ trợ tìm kiếm Search)
//
export const listOrders = async (req, res) => {
  try {
    const { q } = req.query; // Nhận từ khóa tìm kiếm từ URL (?q=...)

    // Câu query cơ bản
    let sqlOrders = `
      SELECT o.*, c.name AS customer_name, c.phone, c.address
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
    `;

    const params = [];

    // 👇 Logic tìm kiếm thông minh: Tìm theo ID đơn, SĐT, Tên khách hoặc Mã Vận Đơn
    if (q) {
      sqlOrders += `
        WHERE o.id LIKE ? 
        OR c.phone LIKE ? 
        OR c.name LIKE ? 
        OR o.china_tracking_code LIKE ?
      `;
      const keyword = `%${q}%`;
      params.push(keyword, keyword, keyword, keyword);
    }

    sqlOrders += ` ORDER BY o.id DESC`;

    const [orders] = await pool.query(sqlOrders, params);

    // Nếu không có đơn nào thì trả về mảng rỗng luôn
    if (orders.length === 0) return res.json([]);

    // Lấy danh sách items cho các đơn hàng tìm được
    // (Chỉ lấy items của các orderID vừa tìm thấy để tối ưu)
    const orderIds = orders.map((o) => o.id);
    const [items] = await pool.query(
      `
      SELECT 
        oi.order_id, oi.quantity, oi.price,
        pv.size, pv.color,
        p.name AS product_name, p.sku, p.cover_image
      FROM order_items oi
      JOIN product_variants pv ON oi.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      WHERE oi.order_id IN (?)
      ORDER BY oi.order_id DESC
    `,
      [orderIds],
    );

    // Map items vào order
    const map = Object.fromEntries(
      orders.map((o) => [o.id, { ...o, items: [] }]),
    );
    for (const it of items) {
      if (map[it.order_id]) map[it.order_id].items.push(it);
    }

    res.json(Object.values(map));
  } catch (err) {
    console.error("❌ listOrders:", err);
    res.status(500).json({ message: "Lỗi server khi lấy danh sách đơn hàng" });
  }
};

//
// ✅ Cập nhật trạng thái đơn hàng
//
export const updateOrderStatus = async (req, res) => {
  // ... (Giữ nguyên code của bạn) ...
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = [
      "pending",
      "confirmed",
      "shipping",
      "completed",
      "cancelled",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ" });
    }

    const [result] = await connection.query(
      "UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?",
      [status, id],
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });

    res.json({ message: `✅ Cập nhật trạng thái đơn #${id} thành công` });
  } catch (err) {
    console.error("❌ updateOrderStatus:", err);
    res.status(500).json({ message: "Lỗi server" });
  } finally {
    connection.release();
  }
};

//
// 🆕 [MỚI] Cập nhật Mã Vận Đơn Trung Quốc
// API này dùng cho ô Input bạn mới thêm ở giao diện chi tiết
//
export const updateTrackingCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { china_tracking_code } = req.body; // Nhận mã từ Client

    const [result] = await pool.query(
      "UPDATE orders SET china_tracking_code = ? WHERE id = ?",
      [china_tracking_code, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    res.json({
      message: "✅ Đã lưu mã vận đơn thành công",
      china_tracking_code,
    });
  } catch (err) {
    console.error("❌ updateTrackingCode:", err);
    res.status(500).json({ message: "Lỗi server khi lưu mã vận đơn" });
  }
};

//
// 🆕 [MỚI] Lấy chi tiết đơn hàng (Dùng cho trang Order Detail)
//
//
// 🆕 [ĐÃ SỬA LỖI] Lấy chi tiết đơn hàng
//
export const getOrderDetail = async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ Lấy thông tin đơn hàng + JOIN với bảng customers để lấy SĐT, Địa chỉ
    const [orders] = await pool.query(
      `SELECT 
        o.*,
        c.name AS customer_name,
        c.phone AS customer_phone,      -- Lấy SĐT
        c.address AS customer_address   -- Lấy Địa chỉ
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?`,
      [id],
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    const order = orders[0];

    // 2️⃣ Lấy danh sách sản phẩm (Items)
    // 🚩 ĐÃ SỬA: Đổi 'JOIN variants' thành 'JOIN product_variants'
    const [items] = await pool.query(
      `SELECT 
        oi.*,
        p.name AS product_name,
        p.cover_image,
        v.size,
        v.color
      FROM order_items oi
      JOIN product_variants v ON oi.variant_id = v.id 
      JOIN products p ON v.product_id = p.id
      WHERE oi.order_id = ?`,
      [id],
    );

    // 3️⃣ Trả về dữ liệu gộp
    res.json({ ...order, items });
  } catch (error) {
    console.error("Lỗi lấy chi tiết đơn hàng:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
