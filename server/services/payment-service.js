const crypto = require("crypto");

const Payment = require("../models/payment-model");
const {
  buildOrderBatchId,
  getPendingCart,
  normalizeCheckoutToken,
  submitPendingOrder,
} = require("./checkout-service");
const { normalizeInvoicePreference } = require("./invoice-service");
const {
  confirmLinePay,
  getLinePayMode,
  requestLinePay,
} = require("./line-pay-service");

class PaymentError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "PaymentError";
    this.statusCode = statusCode;
  }
}

const sameId = (left, right) =>
  Boolean(left && right && String(left) === String(right));

const toPublicPayment = (payment) => ({
  orderId: payment.orderId,
  orderBatchId: payment.orderBatchId,
  method: payment.method,
  providerMode: payment.providerMode,
  amount: payment.amount,
  currency: payment.currency,
  status: payment.status,
  invoicePreference: payment.invoicePreference,
  mobileCarrier: payment.mobileCarrier,
  invoiceStatus: payment.invoiceStatus,
  tableNumber: payment.tableNumber,
  items: payment.items,
  submittedAt: payment.submittedAt,
  paidAt: payment.paidAt,
});

const buildOrderId = () =>
  `STO${Date.now()}${crypto.randomBytes(4).toString("hex")}`;

const normalizeClientBaseUrl = (origin, environment = process.env) => {
  const candidate =
    environment.CLIENT_BASE_URL || origin || "http://localhost:3000";

  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    const isPrivateIpv4 =
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
    const isDevelopmentHost =
      ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname) ||
      hostname.endsWith(".local") ||
      isPrivateIpv4;
    const isDevelopmentHttp =
      environment.NODE_ENV !== "production" &&
      parsed.protocol === "http:" &&
      isDevelopmentHost;

    if (parsed.protocol !== "https:" && !isDevelopmentHttp) {
      throw new Error("insecure client URL");
    }
    return parsed.origin;
  } catch {
    throw new PaymentError("網站回傳網址設定不正確", 500);
  }
};

const getPaymentMode = () => {
  const linePayMode = getLinePayMode();
  return {
    linePayMode,
    linePayAvailable: true,
    realTransaction: linePayMode === "production",
  };
};

const restoreExistingPayment = async (payment, user, clientBaseUrl) => {
  if (!sameId(payment.buyer, user._id)) {
    throw new PaymentError("無法存取這筆付款", 403);
  }

  if (payment.status === "created" && payment.providerMode === "mock") {
    payment.status = "pending";
    payment.providerPaymentUrl = `${clientBaseUrl}/payment/line-pay?orderId=${encodeURIComponent(
      payment.orderId
    )}&mock=1`;
    await payment.save();
  } else if (["cancelled", "failed", "created"].includes(payment.status)) {
    throw new PaymentError("原付款流程已結束，請返回購物車重新結帳", 409);
  }

  return {
    message: "已載入原付款流程",
    payment: toPublicPayment(payment),
    ...(payment.method === "line_pay"
      ? {
          redirectUrl:
            payment.providerPaymentUrl ||
            `${clientBaseUrl}/payment/line-pay?orderId=${encodeURIComponent(
              payment.orderId
            )}&mock=1`,
        }
      : {}),
    idempotent: true,
  };
};

const createStoreCheckout = async (payment, user, checkoutToken) => {
  const order = await submitPendingOrder(user, checkoutToken);
  payment.status = "pay_at_store";
  payment.orderBatchId = order.orderBatchId;
  payment.submittedAt = order.submittedAt;
  await payment.save();

  return {
    message: "訂單已送出，請至店內付款",
    payment: toPublicPayment(payment),
    ...order,
  };
};

const createMockLinePayCheckout = async (payment, clientBaseUrl) => {
  payment.status = "pending";
  payment.providerPaymentUrl = `${clientBaseUrl}/payment/line-pay?orderId=${encodeURIComponent(
    payment.orderId
  )}&mock=1`;
  await payment.save();

  return {
    message: "即將前往 LINE Pay 展示付款",
    payment: toPublicPayment(payment),
    redirectUrl: payment.providerPaymentUrl,
  };
};

const createRealLinePayCheckout = async (payment, items, clientBaseUrl) => {
  const callbackBase = `${clientBaseUrl}/payment/line-pay?orderId=${encodeURIComponent(
    payment.orderId
  )}`;
  const linePayResponse = await requestLinePay({
    orderId: payment.orderId,
    amount: payment.amount,
    items,
    confirmUrl: callbackBase,
    cancelUrl: `${callbackBase}&cancel=1`,
  });

  payment.status = "pending";
  payment.providerTransactionId = String(
    linePayResponse.info.transactionId || ""
  );
  payment.providerPaymentUrl = linePayResponse.info.paymentUrl.web;
  await payment.save();

  return {
    message: "即將前往 LINE Pay",
    payment: toPublicPayment(payment),
    redirectUrl: payment.providerPaymentUrl,
  };
};

const createCheckout = async ({ user, body, origin }) => {
  const checkoutToken = normalizeCheckoutToken(body.checkoutToken);
  const method = body.method === "line_pay" ? "line_pay" : "store";
  const invoice = normalizeInvoicePreference(body);
  const checkoutKey = buildOrderBatchId(user._id, checkoutToken);
  const existingPayment = await Payment.findOne({ checkoutKey });
  const clientBaseUrl =
    method === "line_pay" ? normalizeClientBaseUrl(origin) : "";

  if (existingPayment) {
    return restoreExistingPayment(existingPayment, user, clientBaseUrl);
  }

  const { items, amount } = await getPendingCart(user);
  if (method === "line_pay" && amount < 1) {
    throw new PaymentError("LINE Pay 訂單金額至少需要 NT$ 1");
  }

  const providerMode = method === "store" ? "store" : getLinePayMode();
  const payment = await Payment.create({
    orderId: buildOrderId(),
    checkoutKey,
    buyer: user._id,
    seller: user.qrSeller,
    tableNumber: user.tableNumber,
    method,
    providerMode,
    amount,
    items,
    ...invoice,
  });

  if (method === "store") {
    return createStoreCheckout(payment, user, checkoutToken);
  }
  if (providerMode === "mock") {
    return createMockLinePayCheckout(payment, clientBaseUrl);
  }
  return createRealLinePayCheckout(payment, items, clientBaseUrl);
};

const getBuyerPayment = async (user, orderId) => {
  const payment = await Payment.findOne({
    orderId,
    buyer: user._id,
  });
  if (!payment) throw new PaymentError("找不到付款資料", 404);
  return toPublicPayment(payment);
};

const confirmPayment = async ({ user, body }) => {
  const payment = await Payment.findOne({
    orderId: String(body.orderId || ""),
    buyer: user._id,
  });
  if (!payment) throw new PaymentError("找不到付款資料", 404);

  if (payment.status === "paid") {
    return {
      message: "付款已完成",
      payment: toPublicPayment(payment),
      submittedAt: payment.submittedAt,
      orderBatchId: payment.orderBatchId,
      idempotent: true,
    };
  }
  if (payment.method !== "line_pay" || payment.status !== "pending") {
    throw new PaymentError("這筆付款目前無法確認", 409);
  }

  const pendingCart = await getPendingCart(user);
  if (pendingCart.amount !== payment.amount) {
    payment.status = "cancelled";
    payment.failureMessage = "付款前購物車金額已變更";
    await payment.save();
    throw new PaymentError("購物車內容已變更，請重新結帳", 409);
  }

  if (payment.providerMode !== "mock") {
    const transactionId = String(body.transactionId || "");
    if (!transactionId || transactionId !== payment.providerTransactionId) {
      throw new PaymentError("LINE Pay 交易編號不正確");
    }
    await confirmLinePay({ transactionId, amount: payment.amount });
  }

  const order = await submitPendingOrder(
    user,
    payment.checkoutKey,
    payment.checkoutKey
  );
  payment.status = "paid";
  payment.paidAt = new Date();
  payment.orderBatchId = order.orderBatchId;
  payment.submittedAt = order.submittedAt;
  await payment.save();

  return {
    message: "LINE Pay 付款成功，訂單已送出",
    payment: toPublicPayment(payment),
    ...order,
  };
};

const cancelPayment = async (user, orderId) => {
  const payment = await Payment.findOne({
    orderId: String(orderId || ""),
    buyer: user._id,
  });
  if (!payment) throw new PaymentError("找不到付款資料", 404);

  if (payment.status === "pending" || payment.status === "created") {
    payment.status = "cancelled";
    await payment.save();
  }

  return {
    message: "付款已取消，購物車內容仍會保留",
    payment: toPublicPayment(payment),
  };
};

const listSellerPayments = async (sellerId) => {
  const payments = await Payment.find({
    seller: sellerId,
    orderBatchId: { $ne: "" },
    status: { $in: ["pay_at_store", "paid"] },
    completedAt: null,
  })
    .sort({ submittedAt: 1 })
    .lean();
  return payments.map(toPublicPayment);
};

const markStorePaymentPaid = async (sellerId, orderBatchId) => {
  const payment = await Payment.findOne({ seller: sellerId, orderBatchId });
  if (!payment) throw new PaymentError("找不到付款資料", 404);
  if (payment.method !== "store") {
    throw new PaymentError("LINE Pay 付款由系統自動確認", 409);
  }

  payment.status = "paid";
  payment.paidAt = payment.paidAt || new Date();
  await payment.save();
  return {
    message: "已確認收到店內付款",
    payment: toPublicPayment(payment),
  };
};

const markInvoiceProcessed = async (sellerId, orderBatchId) => {
  const payment = await Payment.findOne({ seller: sellerId, orderBatchId });
  if (!payment) throw new PaymentError("找不到付款資料", 404);
  if (payment.invoicePreference !== "mobile_carrier") {
    throw new PaymentError("這筆訂單沒有手機條碼載具", 409);
  }

  payment.invoiceStatus = "processed";
  await payment.save();
  return {
    message: "載具需求已標示為處理完成",
    payment: toPublicPayment(payment),
  };
};

module.exports = {
  PaymentError,
  cancelPayment,
  confirmPayment,
  createCheckout,
  getBuyerPayment,
  getPaymentMode,
  listSellerPayments,
  markInvoiceProcessed,
  markStorePaymentPaid,
  normalizeClientBaseUrl,
  toPublicPayment,
};
