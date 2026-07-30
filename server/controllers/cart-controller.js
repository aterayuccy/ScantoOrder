const Product = require("../models/product-model");
const { buildOrderCustomization } = require("../product-options");
const { sameId } = require("../middlewares/authorization");

const enrollProduct = async (req, res, next) => {
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

    const snapshotFields = {
      tableNumber: req.user.tableNumber,
      buyerUsernameSnapshot: req.user.username,
      selectedOptions: customization.selectedOptions,
      specialRequest: customization.specialRequest,
      specialRequestLabel:
        product.specialRequestConfig?.label || "備註或特殊需求",
      titleSnapshot: product.title,
      basePrice: Number(product.price),
      unitPrice: customization.unitPrice,
    };

    if (lineItem) {
      const nextQuantity = Number(lineItem.quantity || 0) + quantity;
      if (nextQuantity > 99) {
        return res.status(400).send("同一組合的數量最多為 99");
      }
      lineItem.quantity = nextQuantity;
      Object.assign(lineItem, snapshotFields);
    } else {
      product.buyer.push({
        user: req.user._id,
        quantity,
        ...snapshotFields,
        selectionKey: customization.selectionKey,
      });
      lineItem = product.buyer[product.buyer.length - 1];
    }

    await product.save();
    return res.send({ message: "已加入購物車", lineItem });
  } catch (error) {
    return next(error);
  }
};

const updateCartQuantity = async (req, res, next) => {
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
    return next(error);
  }
};

const removeCartItem = async (req, res, next) => {
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
    return next(error);
  }
};

module.exports = {
  enrollProduct,
  removeCartItem,
  updateCartQuantity,
};
