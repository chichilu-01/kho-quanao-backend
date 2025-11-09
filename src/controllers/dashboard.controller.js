import { pool } from "../db.js";

// ✅ Tổng hợp dữ liệu dashboard
export const getDashboardStats = async (req, res) => {
  try {
    // Tổng đơn, tổng khách, tổng doanh thu
    const [[ordersCount]] = await pool.query(
      `SELECT COUNT(*) AS total_orders, COALESCE(SUM(total), 0) AS total_revenue FROM orders`,
    );
    const [[customersCount]] = await pool.query(
      `SELECT COUNT(*) AS total_customers FROM customers`,
    );

    // Doanh thu theo tháng
    const [monthlyRows] = await pool.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') AS month, 
        SUM(total) AS total
      FROM orders
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `);

    // Tính tăng trưởng tháng gần nhất
    const current = monthlyRows[monthlyRows.length - 1]?.total || 0;
    const prev = monthlyRows[monthlyRows.length - 2]?.total || 0;
    const growth = prev ? (((current - prev) / prev) * 100).toFixed(1) : 0;

    res.json({
      total_orders: ordersCount.total_orders,
      total_revenue: ordersCount.total_revenue,
      total_customers: customersCount.total_customers,
      growth,
      monthly: monthlyRows,
    });
  } catch (err) {
    console.error("❌ getDashboardStats:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Top thương hiệu (tính theo tồn kho)
export const getTopBrands = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        brand AS name, 
        COALESCE(SUM(stock), 0) AS value
      FROM products
      GROUP BY brand
      ORDER BY value DESC
      LIMIT 5
    `);
    res.json(rows);
  } catch (err) {
    console.error("❌ getTopBrands:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Top sản phẩm bán chạy (theo order_items)
export const getTopProducts = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.id,
        p.name,
        p.cover_image,
        p.sale_price,
        COALESCE(SUM(oi.quantity), 0) AS sold
      FROM products p
      LEFT JOIN product_variants pv ON pv.product_id = p.id
      LEFT JOIN order_items oi ON oi.variant_id = pv.id
      GROUP BY p.id
      ORDER BY sold DESC
      LIMIT 5
    `);
    res.json(rows);
  } catch (err) {
    console.error("❌ getTopProducts:", err);
    res.status(500).json({ message: err.message });
  }
};
