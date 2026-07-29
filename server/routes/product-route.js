const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const multer = require("multer");
const passport = require("passport");

const router = require("express").Router();
const Product = require("../models").product;
const Payment = require("../models").payment;
const uploadsDirectory = require("../uploads");
const { productValidation } = require("../validation");
const {
  ProductOptionError,
  buildOrderCustomization,
  normalizeOptionGroups,
  normalizeProductOptions,
  normalizeSpecialRequestConfig,
  validateConfiguredPrice,
} = require("../product-options");

const authenticate = passport.authenticate("jwt", { session: false });

const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const allowedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, uploadsDirectory);
  },
  filename(req, file, callback) {
    callback(
      null,
      `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${path
        .extname(file.originalname)
        .toLowerCase()}`
    );
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (
      !allowedImageMimeTypes.has(file.mimetype) ||
      !allowedImageExtensions.has(extension)
    ) {
      return callback(new Error("圖片只接受 JPG、PNG、WEBP 或 GIF 格式"));
    }
    return callback(null, true);
  },
});

const sameId = (left, right) =>
  Boolean(left && right && String(left) === String(right));

const sendError = (res, error) => {
  if (error instanceof ProductOptionError) {
    return res.status(400).send(error.message);
  }
  console.error("product route error:", error);
  return res.status(500).send({ message: "伺服器處理失敗，請稍後再試" });
};

const requireSeller = (req, res) => {
  if (!req.user?.isSeller?.()) {
    res.status(403).send("只有店家帳號可以執行此操作");
    return false;
  }
  return true;
};

const sellerOnly = (req, res, next) => {
  if (!requireSeller(req, res)) return;
  next();
};

const uploadProductImage = (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).send("圖片大小不可超過 5 MB");
    }
    return res.status(400).send(error.message || "圖片上傳失敗");
  });
};

const removeUploadedFile = async (file) => {
  if (!file?.filename) return;
  await fs.promises
    .unlink(path.join(uploadsDirectory, file.filename))
    .catch(() => {});
};

const verifyUploadedImage = async (file) => {
  if (!file?.path) return;
  const handle = await fs.promises.open(file.path, "r");
  const header = Buffer.alloc(12);

  try {
    await handle.read(header, 0, header.length, 0);
  } finally {
    await handle.close();
  }

  const isJpeg =
    header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isPng =
    header.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  const signature = header.toString("ascii");
  const isGif = signature.startsWith("GIF87a") || signature.startsWith("GIF89a");
  const isWebp =
    signature.startsWith("RIFF") && signature.slice(8, 12) === "WEBP";

  if (!isJpeg && !isPng && !isGif && !isWebp) {
    throw new ProductOptionError("圖片內容不是有效的圖片格式");
  }
};

const validateBasicProduct = (body) => {
  const basicProduct = {
    title: body.title,
    description: body.description || "",
    price: body.price,
    type: body.type,
  };
  const { error, value } = productValidation(basicProduct);
  if (error) throw new ProductOptionError(error.details[0].message);
  return value;
};

const buildProductFields = (body) => {
  const basicProduct = validateBasicProduct(body);
  const customization = normalizeProductOptions(body);
  validateConfiguredPrice(basicProduct.price, customization.optionGroups);
  return {
    ...basicProduct,
    ...customization,
  };
};

const buildProductUpdateFields = (body, product) => {
  const basicProduct = validateBasicProduct(body);
  const hasOptionGroups = Object.prototype.hasOwnProperty.call(
    body,
    "optionGroups"
  );
  const hasSpecialRequestConfig = Object.prototype.hasOwnProperty.call(
    body,
    "specialRequestConfig"
  );
  const optionGroups = hasOptionGroups
    ? normalizeOptionGroups(body.optionGroups)
    : product.optionGroups || [];

  validateConfiguredPrice(basicProduct.price, optionGroups);

  return {
    ...basicProduct,
    ...(hasOptionGroups ? { optionGroups } : {}),
    ...(hasSpecialRequestConfig
      ? {
          specialRequestConfig: normalizeSpecialRequestConfig(
            body.specialRequestConfig
          ),
        }
      : {}),
  };
};

router.get("/", async (req, res) => {
  try {
    const products = await Product.find({})
      .select("-buyer")
      .populate("seller", ["username"])
      .exec();
    return res.send(products);
  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/menu/:sellerId", authenticate, async (req, res) => {
  const { sellerId } = req.params;

  try {
    const isOwnSellerMenu =
      req.user?.isSeller?.() && sameId(req.user._id, sellerId);
    const isAuthorizedBuyer =
      req.user?.isBuyer?.() && sameId(req.user.qrSeller, sellerId);

    if (!isOwnSellerMenu && !isAuthorizedBuyer) {
      return res.status(403).send("無法存取其他店家的菜單");
    }

    const products = await Product.find({ seller: sellerId })
      .select("-buyer")
      .populate("seller", ["username"])
      .exec();
    return res.send(products);
  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/seller/:sellerId", authenticate, async (req, res) => {
  const { sellerId } = req.params;

  try {
    if (!requireSeller(req, res)) return;
    if (!sameId(req.user._id, sellerId)) {
      return res.status(403).send("無法存取其他店家的資料");
    }

    const products = await Product.find({ seller: sellerId })
      .populate("seller", ["username"])
      .populate({ path: "buyer.user", select: "username" })
      .exec();
    return res.send(products);
  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/buyer/:buyerId", authenticate, async (req, res) => {
  const { buyerId } = req.params;

  try {
    if (!req.user?.isBuyer?.() || !sameId(req.user._id, buyerId)) {
      return res.status(403).send("只能查看自己的購物車");
    }

    const products = await Product.find({ "buyer.user": req.user._id })
      .populate("seller", ["username"])
      .lean()
      .exec();

    const ownProducts = products.map((product) => ({
      ...product,
      buyer: (product.buyer || []).filter((buyerItem) =>
        sameId(buyerItem.user, req.user._id)
      ),
    }));

    return res.send(ownProducts);
  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/findByName/:name", authenticate, async (req, res) => {
  try {
    if (!requireSeller(req, res)) return;
    const products = await Product.find({
      seller: req.user._id,
      title: req.params.name,
    })
      .select("-buyer")
      .populate("seller", ["username"])
      .exec();
    return res.send(products);
  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/:_id", authenticate, async (req, res) => {
  try {
    if (!requireSeller(req, res)) return;
    const product = await Product.findById(req.params._id)
      .populate("seller", ["username"])
      .populate({ path: "buyer.user", select: "username" })
      .exec();

    if (!product) return res.status(404).send("找不到品項");
    if (!sameId(product.seller?._id || product.seller, req.user._id)) {
      return res.status(403).send("無法存取其他店家的品項");
    }
    return res.send(product);
  } catch (error) {
    return sendError(res, error);
  }
});

router.post(
  "/",
  authenticate,
  sellerOnly,
  uploadProductImage,
  async (req, res) => {
    try {
      await verifyUploadedImage(req.file);
      const productFields = buildProductFields(req.body || {});
      const product = await Product.create({
        ...productFields,
        image: req.file ? req.file.filename : "",
        seller: req.user._id,
      });

      return res.send({
        message: "品項新增成功",
        savedProduct: product,
      });
    } catch (error) {
      await removeUploadedFile(req.file);
      return sendError(res, error);
    }
  }
);

router.post("/enroll/:_id", authenticate, async (req, res) => {
  const quantity = Number(req.body.quantity || 1);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return res.status(400).send("數量須為 1 到 99 的整數");
  }

  try {
    if (!req.user?.isBuyer?.()) {
      return res.status(403).send("只有顧客可以加入購物車");
    }
    if (!req.user.qrSeller || !req.user.tableNumber) {
      return res.status(403).send("請掃描店家桌上 QR Code 後再點餐");
    }

    const product = await Product.findById(req.params._id).exec();
    if (!product) return res.status(404).send("找不到品項");
    if (!sameId(product.seller, req.user.qrSeller)) {
      return res.status(403).send("無法加入其他店家的品項");
    }

    const customization = buildOrderCustomization(
      product,
      req.body.selections,
      req.body.specialRequest
    );

    let lineItem = product.buyer.find(
      (item) =>
        sameId(item.user, req.user._id) &&
        !item.submittedAt &&
        item.selectionKey === customization.selectionKey
    );

    if (lineItem) {
      const nextQuantity = Number(lineItem.quantity || 0) + quantity;
      if (nextQuantity > 99) {
        return res.status(400).send("同一組合的數量最多為 99");
      }
      lineItem.quantity = nextQuantity;
      lineItem.tableNumber = req.user.tableNumber;
      lineItem.selectedOptions = customization.selectedOptions;
      lineItem.specialRequest = customization.specialRequest;
      lineItem.specialRequestLabel =
        product.specialRequestConfig?.label || "備註或特殊需求";
      lineItem.titleSnapshot = product.title;
      lineItem.basePrice = Number(product.price);
      lineItem.unitPrice = customization.unitPrice;
    } else {
      product.buyer.push({
        user: req.user._id,
        quantity,
        tableNumber: req.user.tableNumber,
        selectedOptions: customization.selectedOptions,
        specialRequest: customization.specialRequest,
        specialRequestLabel:
          product.specialRequestConfig?.label || "備註或特殊需求",
        titleSnapshot: product.title,
        basePrice: Number(product.price),
        unitPrice: customization.unitPrice,
        selectionKey: customization.selectionKey,
      });
      lineItem = product.buyer[product.buyer.length - 1];
    }

    await product.save();
    return res.send({
      message: "已加入購物車",
      lineItem,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch("/submitOrder", authenticate, async (req, res) => {
  return res
    .status(410)
    .send("請在購物車選擇付款方式與發票設定後再送出訂單");
});

router.patch(
  "/:_id",
  authenticate,
  sellerOnly,
  uploadProductImage,
  async (req, res) => {
    try {
      await verifyUploadedImage(req.file);
      const product = await Product.findById(req.params._id);
      if (!product) return res.status(404).send("找不到品項");
      if (!sameId(product.seller, req.user._id)) {
        return res.status(403).send("無法修改其他店家的品項");
      }

      const productFields = buildProductUpdateFields(
        req.body || {},
        product
      );
      Object.assign(product, productFields);
      if (req.file) product.image = req.file.filename;
      await product.save();

      return res.send({
        message: "品項修改成功",
        updatedProduct: product,
      });
    } catch (error) {
      await removeUploadedFile(req.file);
      return sendError(res, error);
    }
  }
);

router.delete("/:_id", authenticate, async (req, res) => {
  try {
    if (!requireSeller(req, res)) return;
    const product = await Product.findById(req.params._id);
    if (!product) return res.status(404).send("找不到品項");
    if (!sameId(product.seller, req.user._id)) {
      return res.status(403).send("無法刪除其他店家的品項");
    }
    if ((product.buyer || []).some((item) => item.submittedAt)) {
      return res
        .status(409)
        .send("此品項仍有店家訂單紀錄，完成相關訂單後才能刪除");
    }

    await product.deleteOne();
    return res.send({ message: "品項刪除成功" });
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch(
  "/cart/:productId/:lineItemId",
  authenticate,
  async (req, res) => {
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return res.status(400).send("數量須為 1 到 99 的整數");
    }

    try {
      if (!req.user?.isBuyer?.()) {
        return res.status(403).send("只有顧客可以修改購物車");
      }
      const product = await Product.findById(req.params.productId);
      if (!product) return res.status(404).send("找不到品項");

      const lineItem = product.buyer.id(req.params.lineItemId);
      if (
        !lineItem ||
        !sameId(lineItem.user, req.user._id) ||
        lineItem.submittedAt
      ) {
        return res.status(404).send("找不到購物車品項");
      }

      lineItem.quantity = quantity;
      await product.save();
      return res.send({ message: "數量已更新", lineItem });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

router.delete(
  "/cart/:productId/:lineItemId",
  authenticate,
  async (req, res) => {
    try {
      if (!req.user?.isBuyer?.()) {
        return res.status(403).send("只有顧客可以修改購物車");
      }
      const product = await Product.findById(req.params.productId);
      if (!product) return res.status(404).send("找不到品項");

      const lineItem = product.buyer.id(req.params.lineItemId);
      if (
        !lineItem ||
        !sameId(lineItem.user, req.user._id) ||
        lineItem.submittedAt
      ) {
        return res.status(404).send("找不到購物車品項");
      }

      lineItem.deleteOne();
      await product.save();
      return res.send({ message: "購物車品項已刪除" });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

router.delete(
  "/sellerOrder/batch/:orderBatchId",
  authenticate,
  async (req, res) => {
    try {
      if (!requireSeller(req, res)) return;
      const result = await Product.updateMany(
        {
          seller: req.user._id,
          "buyer.orderBatchId": req.params.orderBatchId,
        },
        {
          $pull: {
            buyer: { orderBatchId: req.params.orderBatchId },
          },
        }
      );
      await Payment.updateOne(
        {
          seller: req.user._id,
          orderBatchId: req.params.orderBatchId,
        },
        { completedAt: new Date() }
      );
      return res.send({ message: "訂單已完成並移除", result });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// 舊版訂單沒有批次編號時仍可完成，但只移除已送出的資料。
router.delete(
  "/sellerOrder/table/:tableNumber",
  authenticate,
  async (req, res) => {
    const tableNumber = Number(req.params.tableNumber);
    if (!Number.isInteger(tableNumber) || tableNumber < 1) {
      return res.status(400).send("桌號不正確");
    }

    try {
      if (!requireSeller(req, res)) return;
      const result = await Product.updateMany(
        { seller: req.user._id },
        {
          $pull: {
            buyer: { tableNumber, submittedAt: { $type: "date" } },
          },
        }
      );
      return res.send({ message: "桌號訂單已完成並移除", result });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

router.delete(
  "/sellerOrder/:buyerId",
  authenticate,
  async (req, res) => {
    try {
      if (!requireSeller(req, res)) return;
      const result = await Product.updateMany(
        { seller: req.user._id },
        {
          $pull: {
            buyer: {
              user: req.params.buyerId,
              submittedAt: { $type: "date" },
            },
          },
        }
      );
      return res.send({ message: "顧客訂單已完成並移除", result });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

module.exports = router;
