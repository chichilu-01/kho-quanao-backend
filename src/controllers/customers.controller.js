import { pool } from "../db.js";

// ✅ Tạo khách hàng mới
export const createCustomer = async (req, res) => {
  const { name, phone, address, facebook_url, notes } = req.body;
  if (!name) return res.status(400).json({ message: "Thiếu tên khách hàng" });

  try {
    const [result] = await pool.query(
      `INSERT INTO customers (name, phone, address, facebook_url, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [
        name,
        phone || null,
        address || null,
        facebook_url || null,
        notes || null,
      ],
    );
    res.status(201).json({
      id: result.insertId,
      message: "Thêm khách hàng thành công",
    });
  } catch (err) {
    console.error("❌ createCustomer error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Lấy danh sách khách hàng
export const listCustomers = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM customers ORDER BY id DESC`);
    res.json(rows);
  } catch (err) {
    console.error("❌ listCustomers error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Lấy thông tin + lịch sử mua hàng của 1 khách
export const getCustomerDetail = async (req, res) => {
  const { id } = req.params;
  try {
    // 1️⃣ Lấy thông tin khách
    const [customers] = await pool.query(
      `SELECT * FROM customers WHERE id = ? LIMIT 1`,
      [id],
    );
    if (customers.length === 0)
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });

    const customer = customers[0];

    // 2️⃣ Lấy danh sách đơn hàng của khách
    const [orders] = await pool.query(
      `SELECT id, subtotal, total, note, created_at
       FROM orders
       WHERE customer_id = ?
       ORDER BY id DESC`,
      [id],
    );

    // 3️⃣ Lấy toàn bộ sản phẩm trong các đơn hàng
    const [items] = await pool.query(`
      SELECT 
        oi.order_id,
        oi.quantity,
        oi.price,
        p.name AS product_name,
        p.cover_image
      FROM order_items oi
      JOIN product_variants v ON oi.variant_id = v.id
      JOIN products p ON v.product_id = p.id
      ORDER BY oi.order_id DESC
    `);

    // 4️⃣ Gắn items vào đơn hàng tương ứng
    const orderMap = {};
    for (const o of orders) {
      o.items = [];
      orderMap[o.id] = o;
    }
    for (const it of items) {
      if (orderMap[it.order_id]) {
        orderMap[it.order_id].items.push(it);
      }
    }

    customer.orders = orders;

    res.json(customer);
  } catch (err) {
    console.error("❌ getCustomerDetail error:", err);
    res.status(500).json({ message: err.message });
  }
};
