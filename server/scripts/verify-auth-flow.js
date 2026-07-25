const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../models/user-model");
const QrCode = require("../models/qr-code-model");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:8080/api";
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/mernDB";
const testUsername = `sectest_${Date.now().toString(36).slice(-8)}`;
const weakTestUsername = `${testUsername.slice(0, 18)}w`;
const nonAsciiTestUsername = `${testUsername.slice(0, 18)}u`;
const validPassword = "SecurePass123";
let qrGuestId = null;

const allowRemoteTest = process.env.ALLOW_REMOTE_AUTH_TEST === "true";
const apiHostname = new URL(apiBaseUrl).hostname;
const isLocalApi = ["localhost", "127.0.0.1", "::1"].includes(apiHostname);
const isLocalDatabase =
  mongoUri.includes("localhost") ||
  mongoUri.includes("127.0.0.1") ||
  mongoUri.includes("[::1]");

if ((!isLocalApi || !isLocalDatabase) && !allowRemoteTest) {
  throw new Error(
    "安全起見，帳號流程測試預設只能使用本機 API 與資料庫"
  );
}

const request = async (path, body) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const responseText = await response.text();

  let data = responseText;
  try {
    data = JSON.parse(responseText);
  } catch (error) {
    // String responses are expected for validation errors.
  }

  return { status: response.status, data };
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const hasSensitiveKey = (value) => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.entries(value).some(
    ([key, childValue]) =>
      ["password", "email"].includes(key) || hasSensitiveKey(childValue)
  );
};

const verifyAuthFlow = async () => {
  await mongoose.connect(mongoUri);

  try {
    const weakPasswordResponse = await request("/user/register", {
      username: weakTestUsername,
      password: "12345678",
    });
    assert(weakPasswordResponse.status === 400, "純數字密碼應被拒絕");

    const nonAsciiPasswordResponse = await request("/user/register", {
      username: nonAsciiTestUsername,
      password: "Secure密碼123",
    });
    assert(
      nonAsciiPasswordResponse.status === 400,
      "密碼應限制為 bcrypt 可安全處理的半形字元"
    );

    const registerResponse = await request("/user/register", {
      username: testUsername,
      password: validPassword,
    });
    assert(registerResponse.status === 201, "合法帳號應註冊成功");
    assert(!hasSensitiveKey(registerResponse.data), "註冊回應不應包含敏感欄位");

    const duplicateResponse = await request("/user/register", {
      username: testUsername.toUpperCase(),
      password: validPassword,
    });
    assert(duplicateResponse.status === 409, "大小寫不同的重複帳號應被拒絕");

    const loginResponse = await request("/user/login", {
      username: testUsername.toUpperCase(),
      password: validPassword,
    });
    assert(loginResponse.status === 200, "使用者名稱應可忽略大小寫登入");
    assert(Boolean(loginResponse.data?.token), "登入成功應回傳 JWT");
    assert(!hasSensitiveKey(loginResponse.data), "登入回應不應包含敏感欄位");

    const protectedResponse = await fetch(`${apiBaseUrl}/user/qr-codes`, {
      headers: { Authorization: `jwt ${loginResponse.data.token}` },
    });
    assert(protectedResponse.status === 200, "新版 JWT 應可存取受保護 API");

    const legacyToken = jwt.sign(
      { _id: registerResponse.data.user._id },
      process.env.PASSPORT_SECRET
    );
    const legacyTokenResponse = await fetch(`${apiBaseUrl}/user/qr-codes`, {
      headers: { Authorization: `jwt ${legacyToken}` },
    });
    assert(legacyTokenResponse.status === 401, "舊版永久 JWT 應立即失效");

    const wrongPasswordResponse = await request("/user/login", {
      username: testUsername,
      password: "WrongPass123",
    });
    assert(wrongPasswordResponse.status === 401, "錯誤密碼應回傳 401");
    assert(
      wrongPasswordResponse.data === "使用者名稱或密碼錯誤",
      "登入失敗不應透露帳號是否存在"
    );

    const missingUsername = `missing_${Date.now().toString(36).slice(-7)}`;
    let rateLimitResponse;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      rateLimitResponse = await request("/user/login", {
        username: missingUsername,
        password: "WrongPass123",
      });
    }
    assert(rateLimitResponse.status === 429, "連續登入失敗應觸發嘗試次數限制");

    const productsResponse = await fetch(`${apiBaseUrl}/product`);
    const products = await productsResponse.json();
    assert(productsResponse.ok, "公開商品 API 應可正常讀取");
    assert(!hasSensitiveKey(products), "公開商品 API 不應包含敏感欄位");

    const qrCode = await QrCode.findOne().lean();
    if (qrCode) {
      const qrLoginResponse = await request("/user/qr-login", {
        qrToken: qrCode.token,
      });
      qrGuestId = qrLoginResponse.data?.user?._id || null;
      assert(qrLoginResponse.status === 200, "QR 訪客登入應成功");
      assert(!hasSensitiveKey(qrLoginResponse.data), "QR 登入回應不應包含敏感欄位");
      assert(
        qrLoginResponse.data?.user?.username?.startsWith("guest_"),
        "QR 訪客應使用系統保留的隨機帳號"
      );
    }

    console.log("帳號安全流程測試全部通過");
  } finally {
    await User.collection.deleteMany(
      {
        username: {
          $in: [
            testUsername,
            testUsername.toUpperCase(),
            weakTestUsername,
            nonAsciiTestUsername,
          ],
        },
      },
      { collation: { locale: "en", strength: 2 } }
    );
    if (qrGuestId) {
      await User.deleteOne({ _id: qrGuestId });
    }
    await mongoose.disconnect();
  }
};

verifyAuthFlow().catch((error) => {
  console.error("帳號安全流程測試失敗：", error.message);
  process.exitCode = 1;
});
