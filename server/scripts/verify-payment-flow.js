const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const Payment = require("../models/payment-model");
const Product = require("../models/product-model");
const QrCode = require("../models/qr-code-model");
const User = require("../models/user-model");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:8080/api";
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/mernDB";
const testUsername = `paytest_${Date.now().toString(36).slice(-8)}`;
const testPassword = "PaymentPass123";

const apiHostname = new URL(apiBaseUrl).hostname;
const isLocalApi = ["localhost", "127.0.0.1", "::1"].includes(apiHostname);
const isLocalDatabase =
  mongoUri.includes("localhost") ||
  mongoUri.includes("127.0.0.1") ||
  mongoUri.includes("[::1]");

if (!isLocalApi || !isLocalDatabase) {
  throw new Error("安全起見，付款流程測試只能使用本機 API 與資料庫");
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const readResponse = async (response) => {
  const text = await response.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch (error) {
    // Validation messages may intentionally be plain text.
  }
  return { status: response.status, ok: response.ok, data };
};

const requestJson = async (urlPath, options = {}) => {
  const response = await fetch(`${apiBaseUrl}${urlPath}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    body:
      options.body && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body,
  });
  return readResponse(response);
};

const createProduct = async (token) => {
  const form = new FormData();
  form.append("title", "付款流程測試餐點");
  form.append("description", "付款流程自動測試");
  form.append("price", "80");
  form.append("type", "測試");
  form.append("optionGroups", "[]");
  form.append(
    "specialRequestConfig",
    JSON.stringify({ enabled: false, label: "備註", maxLength: 100 })
  );

  const response = await fetch(`${apiBaseUrl}/product`, {
    method: "POST",
    headers: { Authorization: `jwt ${token}` },
    body: form,
  });
  return readResponse(response);
};

const verifyPaymentFlow = async () => {
  let sellerId = null;
  const guestIds = [];

  await mongoose.connect(mongoUri);

  try {
    const register = await requestJson("/user/register", {
      method: "POST",
      body: { username: testUsername, password: testPassword },
    });
    assert(register.status === 201, "付款測試店家註冊失敗");
    sellerId = register.data.user._id;

    const login = await requestJson("/user/login", {
      method: "POST",
      body: { username: testUsername, password: testPassword },
    });
    assert(login.ok && login.data.token, "付款測試店家登入失敗");
    const sellerHeaders = { Authorization: `jwt ${login.data.token}` };

    const qrResult = await requestJson("/user/create-qr-token", {
      method: "POST",
      headers: sellerHeaders,
      body: { count: 2 },
    });
    assert(qrResult.ok && qrResult.data.qrCodes.length === 2, "QR 建立失敗");

    const productResult = await createProduct(login.data.token);
    assert(productResult.ok, "付款測試品項建立失敗");
    const productId = productResult.data.savedProduct._id;

    const loginGuest = async (qrToken) => {
      const result = await requestJson("/user/qr-login", {
        method: "POST",
        body: { qrToken },
      });
      assert(result.ok && result.data.token, "測試顧客 QR 登入失敗");
      guestIds.push(result.data.user._id);
      return {
        headers: { Authorization: `jwt ${result.data.token}` },
        user: result.data.user,
      };
    };

    const storeGuest = await loginGuest(qrResult.data.qrCodes[0].token);
    const storeEnroll = await requestJson(`/product/enroll/${productId}`, {
      method: "POST",
      headers: storeGuest.headers,
      body: { quantity: 2, selections: [] },
    });
    assert(storeEnroll.ok, "店內付款品項加入購物車失敗");

    const bypassCheckout = await requestJson("/product/submitOrder", {
      method: "PATCH",
      headers: storeGuest.headers,
      body: { checkoutToken: `bypass_${Date.now()}` },
    });
    assert(
      bypassCheckout.status === 410,
      "舊版直接送單 API 不應繞過付款流程"
    );

    const invalidCarrier = await requestJson("/payment/checkout", {
      method: "POST",
      headers: storeGuest.headers,
      body: {
        checkoutToken: `invalid_${Date.now()}`,
        method: "store",
        invoicePreference: "mobile_carrier",
        mobileCarrier: "123",
      },
    });
    assert(
      invalidCarrier.status === 400,
      `錯誤載具格式應被拒絕（實際 ${invalidCarrier.status}：${JSON.stringify(
        invalidCarrier.data
      )}）`
    );

    const storeCheckout = await requestJson("/payment/checkout", {
      method: "POST",
      headers: storeGuest.headers,
      body: {
        checkoutToken: `store_${Date.now()}`,
        method: "store",
        invoicePreference: "mobile_carrier",
        mobileCarrier: "/ABC.122",
      },
    });
    assert(storeCheckout.ok, "店內付款結帳失敗");
    assert(
      storeCheckout.data.payment.status === "pay_at_store" &&
        storeCheckout.data.payment.amount === 160,
      "店內付款金額或狀態不正確"
    );
    const storeBatchId = storeCheckout.data.orderBatchId;

    const markPaid = await requestJson(
      `/payment/seller/${storeBatchId}/mark-paid`,
      {
        method: "PATCH",
        headers: sellerHeaders,
        body: {},
      }
    );
    assert(
      markPaid.ok && markPaid.data.payment.status === "paid",
      "店家確認收款失敗"
    );

    const markInvoice = await requestJson(
      `/payment/seller/${storeBatchId}/invoice-processed`,
      {
        method: "PATCH",
        headers: sellerHeaders,
        body: {},
      }
    );
    assert(
      markInvoice.ok &&
        markInvoice.data.payment.invoiceStatus === "processed",
      "店家載具處理狀態更新失敗"
    );

    const lineGuest = await loginGuest(qrResult.data.qrCodes[1].token);
    const lineEnroll = await requestJson(`/product/enroll/${productId}`, {
      method: "POST",
      headers: lineGuest.headers,
      body: { quantity: 1, selections: [] },
    });
    assert(lineEnroll.ok, "LINE Pay 品項加入購物車失敗");

    const lineCheckout = await requestJson("/payment/checkout", {
      method: "POST",
      headers: {
        ...lineGuest.headers,
        Origin: "http://192.168.1.50:3000",
      },
      body: {
        checkoutToken: `line_${Date.now()}`,
        method: "line_pay",
        invoicePreference: "none",
      },
    });
    assert(lineCheckout.ok, "LINE Pay 展示結帳建立失敗");
    assert(
      lineCheckout.data.payment.status === "pending" &&
        lineCheckout.data.payment.providerMode === "mock" &&
        lineCheckout.data.redirectUrl.startsWith(
          "http://192.168.1.50:3000/"
        ),
      "沒有 LINE Pay 金鑰時應使用展示模式，並支援開發用私人區網網址"
    );

    const lineConfirm = await requestJson("/payment/confirm", {
      method: "POST",
      headers: lineGuest.headers,
      body: { orderId: lineCheckout.data.payment.orderId },
    });
    assert(
      lineConfirm.ok &&
        lineConfirm.data.payment.status === "paid" &&
        lineConfirm.data.payment.amount === 80,
      "LINE Pay 展示付款確認失敗"
    );

    const idempotentConfirm = await requestJson("/payment/confirm", {
      method: "POST",
      headers: lineGuest.headers,
      body: { orderId: lineCheckout.data.payment.orderId },
    });
    assert(
      idempotentConfirm.ok && idempotentConfirm.data.idempotent,
      "重複付款確認應安全回傳原結果"
    );

    const completeStoreOrder = await requestJson(
      `/product/sellerOrder/batch/${storeBatchId}`,
      {
        method: "DELETE",
        headers: sellerHeaders,
      }
    );
    assert(completeStoreOrder.ok, "測試訂單完成失敗");

    const completedPayment = await Payment.findOne({
      orderBatchId: storeBatchId,
    }).lean();
    assert(completedPayment.completedAt, "完成訂單後付款紀錄應保留並封存");

    console.log("付款流程測試全部通過");
  } finally {
    if (sellerId) {
      await Payment.deleteMany({ seller: sellerId });
      await Product.deleteMany({ seller: sellerId });
      await QrCode.deleteMany({ seller: sellerId });
      await User.deleteMany({
        $or: [{ _id: sellerId }, { qrSeller: sellerId }],
      });
    } else {
      await User.deleteMany({ username: testUsername });
    }
    if (guestIds.length > 0) {
      await User.deleteMany({ _id: { $in: guestIds } });
    }
    await mongoose.disconnect();
  }
};

verifyPaymentFlow().catch((error) => {
  console.error("付款流程測試失敗：", error.message);
  process.exitCode = 1;
});
