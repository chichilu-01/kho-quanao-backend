import { pool } from "../db.js";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

// ⚙️ Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ⚙️ Multer xử lý upload file tạm trong bộ nhớ
const upload = multer({ storage: multer.memoryStorage() });
export const uploadImage = upload.single("image");

// ✅ Tạo sản phẩm mới (có thể có ảnh, brand và biến thể)
export const createProduct = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      sku,
      name,
      category,
      brand,
      cost_price,
      sale_price,
      stock = 0, // ✅ Thêm tồn kho mặc định (frontend gửi)
      variants,
    } = req.body;

    if (!sku || !name)
      return res.status(400).json({ message: "Thiếu SKU hoặc tên sản phẩm" });

    let imageUrl = null;

    // 🖼️ Upload ảnh lên Cloudinary
    if (req.file) {
      imageUrl = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "kho_quanao",
            resource_type: "image",
          },
          (error, result) => {
            if (error) {
              console.error("❌ Upload thất bại:", error);
              return reject(error);
            }
            resolve(result.secure_url);
          },
        );
        stream.end(req.file.buffer);
      });
    }

    await conn.beginTransaction();

    // 💾 Lưu sản phẩm vào DB (tồn kho nhập trực tiếp)
    const [resultDB] = await conn.query(
      `INSERT INTO products (sku, name, category, brand, cost_price, sale_price, stock, cover_image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sku.trim().toUpperCase(),
        name.trim(),
        category || null,
        brand || null,
        cost_price || 0,
        sale_price || 0,
        stock || 0,
        imageUrl,
      ],
    );

    const productId = resultDB.insertId;

    // 🧩 Nếu có biến thể thì thêm vào bảng product_variants
    if (variants && Array.isArray(JSON.parse(variants))) {
      const variantList = JSON.parse(variants);
      for (const v of variantList) {
        await conn.query(
          `INSERT INTO product_variants (product_id, size, color, stock)
           VALUES (?, ?, ?, ?)`,
          [productId, v.size || null, v.color || null, v.stock || 0],
        );
      }

      // ✅ Sau khi thêm variant, cập nhật tổng tồn kho
      await conn.query(
        `UPDATE products SET stock = (
          SELECT COALESCE(SUM(stock), 0)
          FROM product_variants
          WHERE product_id = ?
        ) WHERE id = ?`,
        [productId, productId],
      );
    }

    await conn.commit();

    res.status(201).json({
      id: productId,
      message: "✅ Tạo sản phẩm thành công!",
      image_url: imageUrl,
    });
  } catch (err) {
    await conn.rollback();
    console.error("❌ Lỗi createProduct:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "SKU đã tồn tại" });
    }
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};

// ✅ Lấy danh sách sản phẩm (hiển thị đúng tồn kho)
export const listProducts = async (req, res) => {
  try {
    const { q } = req.query;
    const params = [];
    let sql = `
      SELECT 
        p.id, p.sku, p.name, p.category, p.brand, 
        p.cost_price, p.sale_price, p.cover_image,
        CASE 
          WHEN COUNT(v.id) > 0 THEN COALESCE(SUM(v.stock), 0)
          ELSE p.stock
        END AS stock
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id
    `;

    if (q) {
      sql += " WHERE p.name LIKE ? OR p.sku LIKE ?";
      params.push(`%${q}%`, `%${q}%`);
    }

    sql += " GROUP BY p.id ORDER BY p.id DESC";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("❌ Lỗi listProducts:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Lấy danh sách biến thể theo sản phẩm
export const getVariantsByProduct = async (req, res) => {
  try {
    const { product_id } = req.params;
    const [rows] = await pool.query(
      "SELECT * FROM product_variants WHERE product_id = ? ORDER BY id DESC",
      [product_id],
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ getVariantsByProduct error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Tìm sản phẩm theo SKU
export const findByCode = async (req, res) => {
  try {
    const code = (req.query.code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ message: "Thiếu mã sản phẩm" });

    const [rows] = await pool.query(
      "SELECT * FROM products WHERE sku = ? LIMIT 1",
      [code],
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
