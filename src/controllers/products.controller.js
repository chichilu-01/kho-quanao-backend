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

//
// ✅ Tạo sản phẩm mới
//
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
      stock = 0,
    } = req.body;

    if (!sku || !name)
      return res.status(400).json({ message: "Thiếu SKU hoặc tên sản phẩm" });

    let imageUrl = null;
    if (req.file) {
      imageUrl = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "kho_quanao", resource_type: "image" },
          (error, result) => {
            if (error) return reject(error);
            resolve(result.secure_url);
          },
        );
        stream.end(req.file.buffer);
      });
    }

    await conn.beginTransaction();
    const [result] = await conn.query(
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

    await conn.commit();
    res.status(201).json({
      id: result.insertId,
      message: "✅ Tạo sản phẩm thành công!",
      image_url: imageUrl,
    });
  } catch (err) {
    await conn.rollback();
    console.error("❌ Lỗi createProduct:", err);
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};

//
// ✅ Lấy danh sách sản phẩm (có tìm kiếm)
//
export const listProducts = async (req, res) => {
  try {
    const { q } = req.query;
    const params = [];
    let sql = `
      SELECT p.id, p.sku, p.name, p.category, p.brand, 
             p.cost_price, p.sale_price, p.stock, p.cover_image
      FROM products p
    `;
    if (q) {
      sql += " WHERE p.name LIKE ? OR p.sku LIKE ?";
      params.push(`%${q}%`, `%${q}%`);
    }
    sql += " ORDER BY p.id DESC";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//
// ✅ Tìm sản phẩm theo mã SKU hoặc tên
//
export const findByCode = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code)
      return res.status(400).json({ message: "Thiếu mã hoặc tên sản phẩm" });

    const [rows] = await pool.query(
      "SELECT * FROM products WHERE sku LIKE ? OR name LIKE ? LIMIT 50",
      [`%${code}%`, `%${code}%`],
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ findByCode error:", err);
    res.status(500).json({ message: err.message });
  }
};

//
// ✅ Cập nhật sản phẩm
//
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { sku, name, category, brand, cost_price, sale_price, stock } =
      req.body;

    let imageUrl = null;
    if (req.file) {
      imageUrl = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "kho_quanao", resource_type: "image" },
          (error, result) => {
            if (error) return reject(error);
            resolve(result.secure_url);
          },
        );
        stream.end(req.file.buffer);
      });
    }

    const [result] = await pool.query(
      `UPDATE products
       SET sku = ?, name = ?, category = ?, brand = ?, 
           cost_price = ?, sale_price = ?, stock = ?, 
           cover_image = COALESCE(?, cover_image)
       WHERE id = ?`,
      [
        sku?.trim().toUpperCase(),
        name?.trim(),
        category || null,
        brand || null,
        cost_price || 0,
        sale_price || 0,
        stock || 0,
        imageUrl,
        id,
      ],
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

    res.json({ message: "✅ Cập nhật sản phẩm thành công!" });
  } catch (err) {
    console.error("❌ Lỗi updateProduct:", err);
    res.status(500).json({ message: err.message });
  }
};

//
// ✅ Lấy danh sách biến thể của sản phẩm (đồng bộ tồn kho tổng)
//
export const getVariantsByProduct = async (req, res) => {
  try {
    const { product_id } = req.params;

    const [variants] = await pool.query(
      `SELECT id, product_id, size, color, variant_sku, base_sku, stock
       FROM product_variants 
       WHERE product_id = ? 
       ORDER BY id ASC`,
      [product_id],
    );

    // 🔁 Tự động cập nhật tổng tồn kho sản phẩm chính
    await pool.query(
      `UPDATE products 
       SET stock = (SELECT COALESCE(SUM(stock), 0) FROM product_variants WHERE product_id = ?)
       WHERE id = ?`,
      [product_id, product_id],
    );

    res.json(variants);
  } catch (err) {
    console.error("❌ Lỗi getVariantsByProduct:", err);
    res.status(500).json({ message: err.message });
  }
};

//
// ✅ Lấy sản phẩm + tất cả biến thể (full detail)
//
export const getProductWithVariants = async (req, res) => {
  try {
    const { id } = req.params;

    const [[product]] = await pool.query(
      "SELECT * FROM products WHERE id = ?",
      [id],
    );
    if (!product)
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

    const [variants] = await pool.query(
      "SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC",
      [id],
    );

    res.json({ ...product, variants });
  } catch (err) {
    console.error("❌ getProductWithVariants:", err);
    res.status(500).json({ message: err.message });
  }
};

//
// ✅ Xóa sản phẩm (xóa cả ảnh và biến thể liên quan)
//
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // 🖼️ Lấy thông tin ảnh để xoá trên Cloudinary
    const [rows] = await pool.query(
      "SELECT cover_image FROM products WHERE id = ?",
      [id],
    );
    if (!rows.length)
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

    const imageUrl = rows[0].cover_image;
    if (imageUrl) {
      try {
        const parts = imageUrl.split("/");
        const filename = parts[parts.length - 1];
        const publicId = "kho_quanao/" + filename.split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.warn("⚠️ Không thể xóa ảnh Cloudinary:", err.message);
      }
    }

    // 🧹 Xóa luôn các biến thể và bản ghi chính
    await pool.query("DELETE FROM product_variants WHERE product_id = ?", [id]);
    await pool.query("DELETE FROM products WHERE id = ?", [id]);

    res.json({
      message: "🗑️ Đã xóa sản phẩm và biến thể liên quan thành công!",
    });
  } catch (err) {
    console.error("❌ deleteProduct:", err);
    res.status(500).json({ message: err.message });
  }
};
