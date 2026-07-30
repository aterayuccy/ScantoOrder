const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const Product = require("../models/product-model");
const QrCode = require("../models/qr-code-model");
const User = require("../models/user-model");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:8080/api";
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/mernDB";
const testUsername = `flowtest_${Date.now().toString(36).slice(-8)}`;
const testPassword = "FlowPass123";

const apiHostname = new URL(apiBaseUrl).hostname;
const isLocalApi = ["localhost", "127.0.0.1", "::1"].includes(apiHostname);
const isLocalDatabase =
  mongoUri.includes("localhost") ||
  mongoUri.includes("127.0.0.1") ||
  mongoUri.includes("[::1]");

if (!isLocalApi || !isLocalDatabase) {
  throw new Error("安全起見，品項流程測試只能使用本機 API 與資料庫");
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const readResponse = async (response) => {
  const text = await response.text();
  let data = text;

  try {
    data = JSON.parse(text);
  } catch {
    // Some validation responses intentionally use plain text.
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

const createProduct = async ({ token, title, price, optionGroups }) => {
  const form = new FormData();
  form.append("title", title);
  form.append("description", "品項流程自動測試");
  form.append("price", String(price));
  form.append("type", "測試");
  form.append("optionGroups", JSON.stringify(optionGroups));
  form.append(
    "specialRequestConfig",
    JSON.stringify({
      enabled: true,
      label: "備註或特殊需求",
      maxLength: 100,
    })
  );

  const response = await fetch(`${apiBaseUrl}/product`, {
    method: "POST",
    headers: { Authorization: `jwt ${token}` },
    body: form,
  });
  return readResponse(response);
};

const verifyProductFlow = async () => {
  let sellerId = null;
  let guestId = null;

  await mongoose.connect(mongoUri);

  try {
    const register = await requestJson("/user/register", {
      method: "POST",
      body: { username: testUsername, password: testPassword },
    });
    assert(register.status === 201, "測試店家註冊失敗");
    sellerId = register.data.user._id;

    const login = await requestJson("/user/login", {
      method: "POST",
      body: { username: testUsername, password: testPassword },
    });
    assert(login.status === 200 && login.data.token, "測試店家登入失敗");
    const sellerHeaders = { Authorization: `jwt ${login.data.token}` };

    const qrResult = await requestJson("/user/create-qr-token", {
      method: "POST",
      headers: sellerHeaders,
      body: { count: 1 },
    });
    assert(qrResult.ok, "測試 QR Code 建立失敗");
    const qrCode = qrResult.data.qrCodes[0];

    const configuredProduct = await createProduct({
      token: login.data.token,
      title: "大杯測試飲品",
      price: 60,
      optionGroups: [
        {
          name: "內容調整",
          options: [{ name: "改為小杯", priceAdjustment: -20 }],
        },
        {
          name: "口味調整",
          options: [{ name: "半糖", priceAdjustment: 0 }],
        },
        {
          name: "加購",
          options: [{ name: "加購點心", priceAdjustment: 40 }],
        },
      ],
    });
    assert(configuredProduct.ok, "含調整步驟的品項建立失敗");

    const directProduct = await createProduct({
      token: login.data.token,
      title: "直接加入測試品項",
      price: 25,
      optionGroups: [],
    });
    assert(directProduct.ok, "0 步驟品項建立失敗");

    const qrLogin = await requestJson("/user/qr-login", {
      method: "POST",
      body: { qrToken: qrCode.token },
    });
    assert(qrLogin.ok && qrLogin.data.token, "測試顧客 QR 登入失敗");
    guestId = qrLogin.data.user._id;
    const buyerHeaders = { Authorization: `jwt ${qrLogin.data.token}` };

    const savedConfiguredProduct = configuredProduct.data.savedProduct;
    const contentStep = savedConfiguredProduct.optionGroups[0];
    const smallContent = contentStep.options[0];
    const adjustedEnroll = await requestJson(
      `/product/enroll/${savedConfiguredProduct._id}`,
      {
        method: "POST",
        headers: buyerHeaders,
        body: {
          quantity: 1,
          selections: [
            {
              groupId: contentStep._id,
              optionIds: [smallContent._id],
            },
          ],
          specialRequest: "少冰",
        },
      }
    );
    assert(adjustedEnroll.ok, "折抵品項加入購物車失敗");
    assert(
      adjustedEnroll.data.lineItem.unitPrice === 40,
      "大杯 60 元改為小杯 -20 元後應為 40 元"
    );
    assert(
      adjustedEnroll.data.lineItem.selectedOptions[0].optionName === "改為小杯",
      "購物車應保存顧客選擇的內容"
    );

    const savedDirectProduct = directProduct.data.savedProduct;
    const directEnroll = await requestJson(
      `/product/enroll/${savedDirectProduct._id}`,
      {
        method: "POST",
        headers: buyerHeaders,
        body: {
          quantity: 1,
          selections: [],
          specialRequest: "此備註在 0 步驟時應略過",
        },
      }
    );
    assert(directEnroll.ok, "0 步驟品項直接加入失敗");
    assert(
      directEnroll.data.lineItem.unitPrice === 25 &&
        directEnroll.data.lineItem.selectedOptions.length === 0 &&
        directEnroll.data.lineItem.specialRequest === "",
      "0 步驟品項應以原價直接加入且不帶調整與備註"
    );

    const cart = await requestJson(`/product/buyer/${guestId}`, {
      headers: buyerHeaders,
    });
    const ownLines = (cart.data || []).flatMap(
      (product) => product.buyer || []
    );
    assert(cart.ok && ownLines.length === 2, "顧客購物車應有兩筆測試品項");

    console.log("簡化品項流程測試全部通過");
  } finally {
    if (sellerId) {
      await Product.deleteMany({ seller: sellerId });
      await QrCode.deleteMany({ seller: sellerId });
      await User.deleteMany({
        $or: [{ _id: sellerId }, { qrSeller: sellerId }],
      });
    } else {
      await User.deleteMany({ username: testUsername });
    }
    if (guestId) await User.deleteOne({ _id: guestId });
    await mongoose.disconnect();
  }
};

verifyProductFlow().catch((error) => {
  console.error("簡化品項流程測試失敗：", error.message);
  process.exitCode = 1;
});
