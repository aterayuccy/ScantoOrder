const crypto = require("crypto");

const passport = require("passport");

const router = require("express").Router();
const Payment = require("../models/payment-model");
const {
  CheckoutError,
  buildOrderBatchId,
  getPendingCart,
  normalizeCheckoutToken,
  submitPendingOrder,
} = require("../order-checkout");
const {
  LinePayError,
  confirmLinePay,
  getLinePayMode,
  requestLinePay,
} = require("../line-pay");

const authenticate = passport.authenticate("jwt", { session: false });
const MOBILE_CARRIER_PATTERN = /^\/[0-9A-Z.+-]{7}$/;

const sameId = (left, right) =>
  Boolean(left && right && String(left) === String(right));

const sendError = (res, error) => {
  if (error instanceof CheckoutError) {
    return res.status(error.statusCode || 400).send(error.message);
  }
  if (error instanceof LinePayError) {
    return res.status(502).send({
      message: error.message,
      resultCode: error.resultCode,
    });
  }
  console.error("payment route error:", error);
  return res.status(500).send({ message: "付款處理失敗，請稍後再試" });
};

const requireBuyer = (req, res) => {
  if (!req.user?.isBuyer?.()) {
    res.status(403).send("只有顧客可以進行付款");
    return false;
  }
  return true;
};

const requireSeller = (req, res) => {
  if (!req.user?.isSeller?.()) {
    res.status(403).send("只有店家可以管理付款");
    return false;
  }
  return true;
};

const normalizeInvoicePreference = (body = {}) => {
  const invoicePreference =
    body.invoicePreference === "mobile_carrier" ? "mobile_carrier" : "none";
  const mobileCarrier = String(body.mobileCarrier || "")
    .trim()
    .toUpperCase();

  if (
    invoicePreference === "mobile_carrier" &&
    !MOBILE_CARRIER_PATTERN.test(mobileCarrier)
  ) {
    throw new CheckoutError(
      "手機條碼須為「/」開頭加上 7 碼英數字或 . + - 符號"
    );
  }

  return {
    invoicePreference,
    mobileCarrier: invoicePreference === "mobile_carrier" ? mobileCarrier : "",
    invoiceStatus:
      invoicePreference === "mobile_carrier" ? "pending" : "not_requested",
  };
};

const normalizeClientBaseUrl = (req) => {
  const candidate =
    process.env.CLIENT_BASE_URL || req.get("origin") || "http://localhost:3000";
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
      process.env.NODE_ENV !== "production" &&
      parsed.protocol === "http:" &&
      isDevelopmentHost;
    if (parsed.protocol !== "https:" && !isDevelopmentHttp) {
      throw new Error("insecure client URL");
    }
    return parsed.origin;
  } catch {
    throw new CheckoutError("網站回傳網址設定不正確", 500);
  }
};

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

router.get("/mode", (_req, res) => {
  const mode = getLinePayMode();
  return res.send({
    linePayMode: mode,
    linePayAvailable: true,
    realTransaction: mode === "production",
  });
});

router.post("/checkout", authenticate, async (req, res) => {
  if (!requireBuyer(req, res)) return;

  try {
    const checkoutToken = normalizeCheckoutToken(req.body.checkoutToken);
    const method = req.body.method === "line_pay" ? "line_pay" : "store";
    const invoice = normalizeInvoicePreference(req.body);
    const checkoutKey = buildOrderBatchId(req.user._id, checkoutToken);
    const existingPayment = await Payment.findOne({ checkoutKey });
    const clientBaseUrl =
      method === "line_pay" ? normalizeClientBaseUrl(req) : "";

    if (existingPayment) {
      if (!sameId(existingPayment.buyer, req.user._id)) {
        return res.status(403).send("無法存取這筆付款");
      }
      if (
        existingPayment.status === "created" &&
        existingPayment.providerMode === "mock"
      ) {
        existingPayment.status = "pending";
        existingPayment.providerPaymentUrl = `${clientBaseUrl}/payment/line-pay?orderId=${encodeURIComponent(
          existingPayment.orderId
        )}&mock=1`;
        await existingPayment.save();
      } else if (
        ["cancelled", "failed", "created"].includes(existingPayment.status)
      ) {
        return res.status(409).send("原付款流程已結束，請返回購物車重新結帳");
      }
      return res.send({
        message: "已載入原付款流程",
        payment: toPublicPayment(existingPayment),
        redirectUrl:
          existingPayment.providerPaymentUrl ||
          `${clientBaseUrl}/payment/line-pay?orderId=${encodeURIComponent(
            existingPayment.orderId
          )}&mock=1`,
        idempotent: true,
      });
    }

    const { items, amount } = await getPendingCart(req.user);
    if (method === "line_pay" && amount < 1) {
      throw new CheckoutError("LINE Pay 訂單金額至少需要 NT$ 1");
    }

    const providerMode = method === "store" ? "store" : getLinePayMode();
    const payment = await Payment.create({
      orderId: buildOrderId(),
      checkoutKey,
      buyer: req.user._id,
      seller: req.user.qrSeller,
      tableNumber: req.user.tableNumber,
      method,
      providerMode,
      amount,
      items,
      ...invoice,
    });

    if (method === "store") {
      const order = await submitPendingOrder(req.user, checkoutToken);
      payment.status = "pay_at_store";
      payment.orderBatchId = order.orderBatchId;
      payment.submittedAt = order.submittedAt;
      await payment.save();
      return res.send({
        message: "訂單已送出，請至店內付款",
        payment: toPublicPayment(payment),
        ...order,
      });
    }

    if (providerMode === "mock") {
      payment.status = "pending";
      payment.providerPaymentUrl = `${clientBaseUrl}/payment/line-pay?orderId=${encodeURIComponent(
        payment.orderId
      )}&mock=1`;
      await payment.save();
      return res.send({
        message: "即將前往 LINE Pay 展示付款",
        payment: toPublicPayment(payment),
        redirectUrl: payment.providerPaymentUrl,
      });
    }

    const callbackBase = `${clientBaseUrl}/payment/line-pay?orderId=${encodeURIComponent(
      payment.orderId
    )}`;
    const linePayResponse = await requestLinePay({
      orderId: payment.orderId,
      amount,
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

    return res.send({
      message: "即將前往 LINE Pay",
      payment: toPublicPayment(payment),
      redirectUrl: payment.providerPaymentUrl,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/buyer/:orderId", authenticate, async (req, res) => {
  if (!requireBuyer(req, res)) return;

  try {
    const payment = await Payment.findOne({
      orderId: req.params.orderId,
      buyer: req.user._id,
    });
    if (!payment) return res.status(404).send("找不到付款資料");
    return res.send(toPublicPayment(payment));
  } catch (error) {
    return sendError(res, error);
  }
});

router.post("/confirm", authenticate, async (req, res) => {
  if (!requireBuyer(req, res)) return;

  try {
    const payment = await Payment.findOne({
      orderId: String(req.body.orderId || ""),
      buyer: req.user._id,
    });
    if (!payment) return res.status(404).send("找不到付款資料");
    if (payment.status === "paid") {
      return res.send({
        message: "付款已完成",
        payment: toPublicPayment(payment),
        submittedAt: payment.submittedAt,
        orderBatchId: payment.orderBatchId,
        idempotent: true,
      });
    }
    if (payment.method !== "line_pay" || payment.status !== "pending") {
      return res.status(409).send("這筆付款目前無法確認");
    }

    const pendingCart = await getPendingCart(req.user);
    if (pendingCart.amount !== payment.amount) {
      payment.status = "cancelled";
      payment.failureMessage = "付款前購物車金額已變更";
      await payment.save();
      return res.status(409).send("購物車內容已變更，請重新結帳");
    }

    if (payment.providerMode !== "mock") {
      const transactionId = String(req.body.transactionId || "");
      if (!transactionId || transactionId !== payment.providerTransactionId) {
        return res.status(400).send("LINE Pay 交易編號不正確");
      }
      await confirmLinePay({
        transactionId,
        amount: payment.amount,
      });
    }

    const order = await submitPendingOrder(
      req.user,
      payment.checkoutKey,
      payment.checkoutKey
    );
    payment.status = "paid";
    payment.paidAt = new Date();
    payment.orderBatchId = order.orderBatchId;
    payment.submittedAt = order.submittedAt;
    await payment.save();

    return res.send({
      message: "LINE Pay 付款成功，訂單已送出",
      payment: toPublicPayment(payment),
      ...order,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post("/cancel", authenticate, async (req, res) => {
  if (!requireBuyer(req, res)) return;

  try {
    const payment = await Payment.findOne({
      orderId: String(req.body.orderId || ""),
      buyer: req.user._id,
    });
    if (!payment) return res.status(404).send("找不到付款資料");
    if (payment.status === "pending" || payment.status === "created") {
      payment.status = "cancelled";
      await payment.save();
    }
    return res.send({
      message: "付款已取消，購物車內容仍會保留",
      payment: toPublicPayment(payment),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/seller", authenticate, async (req, res) => {
  if (!requireSeller(req, res)) return;

  try {
    const payments = await Payment.find({
      seller: req.user._id,
      orderBatchId: { $ne: "" },
      status: { $in: ["pay_at_store", "paid"] },
      completedAt: null,
    })
      .sort({ submittedAt: 1 })
      .lean();
    return res.send(payments.map(toPublicPayment));
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch(
  "/seller/:orderBatchId/mark-paid",
  authenticate,
  async (req, res) => {
    if (!requireSeller(req, res)) return;

    try {
      const payment = await Payment.findOne({
        seller: req.user._id,
        orderBatchId: req.params.orderBatchId,
      });
      if (!payment) return res.status(404).send("找不到付款資料");
      if (payment.method !== "store") {
        return res.status(409).send("LINE Pay 付款由系統自動確認");
      }
      payment.status = "paid";
      payment.paidAt = payment.paidAt || new Date();
      await payment.save();
      return res.send({
        message: "已確認收到店內付款",
        payment: toPublicPayment(payment),
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

router.patch(
  "/seller/:orderBatchId/invoice-processed",
  authenticate,
  async (req, res) => {
    if (!requireSeller(req, res)) return;

    try {
      const payment = await Payment.findOne({
        seller: req.user._id,
        orderBatchId: req.params.orderBatchId,
      });
      if (!payment) return res.status(404).send("找不到付款資料");
      if (payment.invoicePreference !== "mobile_carrier") {
        return res.status(409).send("這筆訂單沒有手機條碼載具");
      }
      payment.invoiceStatus = "processed";
      await payment.save();
      return res.send({
        message: "載具需求已標示為處理完成",
        payment: toPublicPayment(payment),
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

module.exports = router;
