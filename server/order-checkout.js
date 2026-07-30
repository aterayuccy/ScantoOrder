const crypto = require("crypto");

const Product = require("./models/product-model");

const sameId = (left, right) =>
  Boolean(left && right && String(left) === String(right));

class CheckoutError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "CheckoutError";
    this.statusCode = statusCode;
  }
}

const normalizeCheckoutToken = (rawToken) => {
  const checkoutToken = String(rawToken || "").trim();
  if (
    checkoutToken.length < 8 ||
    checkoutToken.length > 128 ||
    !/^[A-Za-z0-9_-]+$/.test(checkoutToken)
  ) {
    throw new CheckoutError("結帳識別碼格式不正確");
  }
  return checkoutToken;
};

const buildOrderBatchId = (userId, checkoutToken) =>
  crypto
    .createHash("sha256")
    .update(`${userId}:${checkoutToken}`)
    .digest("hex");

const getBuyerProducts = (user) =>
  Product.find({
    seller: user.qrSeller,
    "buyer.user": user._id,
  });

const getPendingCart = async (user) => {
  if (!user?.isBuyer?.() || !user.qrSeller || !user.tableNumber) {
    throw new CheckoutError("請掃描店家 QR Code 後再進行結帳", 403);
  }

  const products = await getBuyerProducts(user);
  const items = products.flatMap((product) =>
    (product.buyer || [])
      .filter((item) => sameId(item.user, user._id) && !item.submittedAt)
      .map((item) => {
        const unitPrice =
          item.unitPrice === null || item.unitPrice === undefined
            ? Number(product.price)
            : Number(item.unitPrice);
        const quantity = Number(item.quantity || 1);
        return {
          productId: product._id,
          lineItemId: item._id,
          title: item.titleSnapshot || product.title,
          unitPrice,
          quantity,
          lineTotal: unitPrice * quantity,
        };
      })
  );

  if (items.length === 0) {
    throw new CheckoutError("購物車目前沒有可結帳的品項");
  }

  const amount = items.reduce((sum, item) => sum + item.lineTotal, 0);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new CheckoutError("訂單金額不正確");
  }

  return { products, items, amount };
};

const submitPendingOrder = async (
  user,
  rawCheckoutToken,
  knownOrderBatchId = ""
) => {
  if (!user?.isBuyer?.() || !user.qrSeller) {
    throw new CheckoutError("請掃描店家 QR Code 後再送出訂單", 403);
  }

  const checkoutToken = normalizeCheckoutToken(rawCheckoutToken);
  const orderBatchId = /^[a-f0-9]{64}$/.test(knownOrderBatchId)
    ? knownOrderBatchId
    : buildOrderBatchId(user._id, checkoutToken);
  const products = await getBuyerProducts(user);
  const existingBatchItem = products
    .flatMap((product) => product.buyer || [])
    .find(
      (item) =>
        sameId(item.user, user._id) && item.orderBatchId === orderBatchId
    );
  const submittedAt = existingBatchItem?.submittedAt || new Date();
  let submittedCount = 0;

  for (const product of products) {
    const pendingItems = product.buyer.filter(
      (item) => sameId(item.user, user._id) && !item.submittedAt
    );

    for (const item of pendingItems) {
      item.tableNumber = user.tableNumber;
      item.buyerUsernameSnapshot =
        item.buyerUsernameSnapshot || user.username || "";
      item.submittedAt = submittedAt;
      item.orderBatchId = orderBatchId;
      item.titleSnapshot = item.titleSnapshot || product.title;
      item.basePrice =
        item.basePrice === null || item.basePrice === undefined
          ? Number(product.price)
          : item.basePrice;
      item.unitPrice =
        item.unitPrice === null || item.unitPrice === undefined
          ? Number(product.price)
          : item.unitPrice;
      submittedCount += 1;
    }

    if (pendingItems.length > 0) await product.save();
  }

  if (submittedCount === 0 && !existingBatchItem) {
    throw new CheckoutError("購物車目前沒有可送出的品項");
  }

  return {
    submittedAt,
    orderBatchId,
    idempotent: submittedCount === 0,
  };
};

module.exports = {
  CheckoutError,
  buildOrderBatchId,
  getPendingCart,
  normalizeCheckoutToken,
  submitPendingOrder,
};
