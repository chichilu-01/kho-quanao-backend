import { pool } from "../db.js";

//
// ✅ Tạo biến thể mới (tự sinh base_sku + variant_sku)
//
export const createVariant = async (req, res) => {
  const { product_id, size, color, stock } = req.body;

  if (!product_id) return res.status(400).json({ message: "Thiếu product_id" });
  if (!size || !color)
    return res.status(400).json({ message: "Thiếu size hoặc màu" });

  const conn = await pool.getConnection();
  try {
    // 🧩 Lấy SKU gốc từ bảng products
    const [products] = await conn.query(
      "SELECT sku FROM products WHERE id = ?",
      [product_id],
    );
    if (!products.length)
      return res.status(404).json({ message: "Không tìm thấy sản phẩm gốc" });

    const baseSku = products[0].sku;

    // 🔠 Chuẩn hóa dữ liệu
    const normalize = (str) =>
      str
        ?.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "")
        .toUpperCase();

    const variantSku = `${baseSku}-${normalize(size)}-${normalize(color)}`;

    // 🗄️ Thêm biến thể mới
    await conn.query(
      `INSERT INTO product_variants (product_id, size, color, stock, variant_sku, base_sku)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [product_id, size, color, stock || 0, variantSku, baseSku],
    );

    // 🔁 Cập nhật tổng tồn kho của sản phẩm gốc
    await conn.query(
      `UPDATE products 
       SET stock = (SELECT SUM(stock) FROM product_variants WHERE product_id = ?)
       WHERE id = ?`,
      [product_id, product_id],
    );

    res.status(201).json({
      message: "✅ Tạo biến thể thành công",
      base_sku: baseSku,
      variant_sku: variantSku,
    });
  } catch (err) {
    console.error("❌ createVariant:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "variant_sku đã tồn tại" });
    }
    res.status(500).json({ message: "Lỗi server khi tạo biến thể" });
  } finally {
    conn.release();
  }
};

//
// ✅ Tạo nhiều biến thể cùng lúc (tự sinh base_sku + variant_sku)
//
export const createVariantsBulk = async (req, res) => {
  const { product_id, sizes = [], colors = [], default_stock = 0 } = req.body;

  if (!product_id) return res.status(400).json({ message: "Thiếu product_id" });
  if (!sizes.length || !colors.length)
    return res.status(400).json({ message: "Cần ít nhất một size và một màu" });

  const conn = await pool.getConnection();
  try {
    const [products] = await conn.query(
      "SELECT sku FROM products WHERE id = ?",
      [product_id],
    );
    if (!products.length)
      return res.status(404).json({ message: "Không tìm thấy sản phẩm gốc" });

    const baseSku = products[0].sku;

    const normalize = (str) =>
      str
        ?.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "")
        .toUpperCase();

    let created = [];

    for (const size of sizes) {
      for (const color of colors) {
        const variantSku = `${baseSku}-${normalize(size)}-${normalize(color)}`;
        try {
          await conn.query(
            `INSERT INTO product_variants (product_id, size, color, stock, variant_sku, base_sku)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [product_id, size, color, default_stock, variantSku, baseSku],
          );
          created.push(variantSku);
        } catch (err) {
          if (err.code === "ER_DUP_ENTRY") {
            console.warn(`⚠️ Bỏ qua biến thể trùng: ${variantSku}`);
          } else {
            throw err;
          }
        }
      }
    }

    // 🔁 Cập nhật tổng tồn kho sản phẩm
    await conn.query(
      `UPDATE products 
       SET stock = (SELECT SUM(stock) FROM product_variants WHERE product_id = ?)
       WHERE id = ?`,
      [product_id, product_id],
    );

    res.status(201).json({
      message: `✅ Đã tạo ${created.length} biến thể`,
      created,
    });
  } catch (err) {
    console.error("❌ createVariantsBulk:", err);
    res.status(500).json({ message: "Lỗi server khi tạo nhiều biến thể" });
  } finally {
    conn.release();
  }
};

//
// ✅ Lấy danh sách biến thể theo product_id
//
export const listVariantsByProduct = async (req, res) => {
  const productId = req.params.id || req.params.productId;
  if (!productId) return res.status(400).json({ message: "Thiếu ID sản phẩm" });

  try {
    const [rows] = await pool.query(
      "SELECT * FROM product_variants WHERE product_id = ? ORDER BY id DESC",
      [productId],
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ listVariantsByProduct:", err);
    res.status(500).json({ message: "Lỗi server khi lấy danh sách biến thể" });
  }
};

//
// ✅ Cập nhật biến thể
//
export const updateVariant = async (req, res) => {
  const { id } = req.params;
  const { size, color, variant_sku, stock } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE product_variants 
       SET size = ?, color = ?, variant_sku = ?, stock = ?
       WHERE id = ?`,
      [size || null, color || null, variant_sku || null, stock || 0, id],
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Không tìm thấy biến thể" });

    res.json({ message: "✅ Cập nhật biến thể thành công" });
  } catch (err) {
    console.error("❌ updateVariant:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "variant_sku đã tồn tại" });
    }
    res.status(500).json({ message: "Lỗi server khi cập nhật biến thể" });
  }
};

//
// ✅ Xoá biến thể
//
export const deleteVariant = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      "DELETE FROM product_variants WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Không tìm thấy biến thể" });

    res.json({ message: "🗑️ Xoá biến thể thành công" });
  } catch (err) {
    console.error("❌ deleteVariant:", err);
    res.status(500).json({ message: "Lỗi server khi xoá biến thể" });
  }
};

//
// 🔻 Giảm tồn kho khi bán hàng
//
export const reduceStock = async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity <= 0)
    return res.status(400).json({ message: "Số lượng không hợp lệ" });

  try {
    const [[variant]] = await pool.query(
      "SELECT stock, product_id FROM product_variants WHERE id = ?",
      [id],
    );

    if (!variant)
      return res.status(404).json({ message: "Không tìm thấy biến thể" });

    if (variant.stock < quantity) {
      return res.status(400).json({
        message: `Tồn kho không đủ (hiện còn ${variant.stock})`,
      });
    }

    await pool.query(
      "UPDATE product_variants SET stock = stock - ? WHERE id = ?",
      [quantity, id],
    );

    // 🔁 Cập nhật tồn kho tổng của sản phẩm
    await pool.query(
      `UPDATE products 
       SET stock = (SELECT SUM(stock) FROM product_variants WHERE product_id = ?)
       WHERE id = ?`,
      [variant.product_id, variant.product_id],
    );

    res.json({ message: `✅ Đã trừ ${quantity} sản phẩm khỏi tồn kho` });
  } catch (err) {
    console.error("❌ reduceStock:", err);
    res.status(500).json({ message: "Lỗi server khi giảm tồn kho" });
  }
};

//
// 🔺 Cộng lại tồn kho khi huỷ đơn hàng
//
export const restoreStock = async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity <= 0)
    return res.status(400).json({ message: "Số lượng không hợp lệ" });

  try {
    const [[variant]] = await pool.query(
      "SELECT product_id FROM product_variants WHERE id = ?",
      [id],
    );

    await pool.query(
      "UPDATE product_variants SET stock = stock + ? WHERE id = ?",
      [quantity, id],
    );

    // 🔁 Cập nhật tổng tồn kho sản phẩm
    if (variant) {
      await pool.query(
        `UPDATE products 
         SET stock = (SELECT SUM(stock) FROM product_variants WHERE product_id = ?)
         WHERE id = ?`,
        [variant.product_id, variant.product_id],
      );
    }

    res.json({ message: `🔁 Đã hoàn lại ${quantity} sản phẩm vào tồn kho` });
  } catch (err) {
    console.error("❌ restoreStock:", err);
    res.status(500).json({ message: "Lỗi server khi hoàn lại tồn kho" });
  }
};
