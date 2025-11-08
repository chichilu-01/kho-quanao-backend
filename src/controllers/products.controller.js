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

// ✅ Middleware upload 1 ảnh (frontend gửi field name = "image")
export const uploadImage = upload.single("image");

// ✅ Tạo sản phẩm mới (có thể có ảnh)
export const createProduct = async (req, res) => {
  try {
    const { sku, name, category, cost_price, sale_price } = req.body;

    if (!sku || !name)
      return res.status(400).json({ message: "Thiếu SKU hoặc tên sản phẩm" });

    let imageUrl = null;

    // 🖼️ Nếu có file ảnh — upload lên Cloudinary
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

    // 💾 Lưu sản phẩm vào DB
    const [resultDB] = await pool.query(
      `INSERT INTO products (sku, name, category, cost_price, sale_price, cover_image)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        sku.trim().toUpperCase(),
        name.trim(),
        category || null,
        cost_price || 0,
        sale_price || 0,
        imageUrl,
      ],
    );

    res.status(201).json({
      id: resultDB.insertId,
      message: "Tạo sản phẩm thành công",
      image_url: imageUrl,
    });
  } catch (err) {
    console.error("❌ Lỗi createProduct:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "SKU đã tồn tại" });
    }
    res.status(500).json({ message: err.message });
  }
};

// ✅ Lấy danh sách sản phẩm
export const listProducts = async (req, res) => {
  try {
    const { q } = req.query;
    let sql = "SELECT * FROM products";
    const params = [];

    if (q) {
      sql += " WHERE name LIKE ? OR sku LIKE ?";
      params.push(`%${q}%`, `%${q}%`);
    }

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Tìm kiếm sản phẩm theo SKU
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
