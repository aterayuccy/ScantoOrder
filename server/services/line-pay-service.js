const crypto = require("crypto");

class LinePayError extends Error {
  constructor(message, resultCode = "") {
    super(message);
    this.name = "LinePayError";
    this.resultCode = String(resultCode || "");
  }
}

const getApiVersion = () =>
  process.env.LINE_PAY_API_VERSION === "v3" ? "v3" : "v4";

const getLinePayMode = () => {
  if (
    !process.env.LINE_PAY_CHANNEL_ID ||
    !process.env.LINE_PAY_CHANNEL_SECRET
  ) {
    return "mock";
  }
  return process.env.LINE_PAY_ENV === "production" ? "production" : "sandbox";
};

const getApiBaseUrl = () =>
  getLinePayMode() === "production"
    ? "https://api-pay.line.me"
    : "https://sandbox-api-pay.line.me";

const parseLinePayJson = (text) =>
  JSON.parse(text.replace(/("transactionId"\s*:\s*)(\d+)/g, '$1"$2"'));

const callLinePay = async (apiPath, body) => {
  const requestBody = JSON.stringify(body);
  const nonce = crypto.randomUUID();
  const secret = process.env.LINE_PAY_CHANNEL_SECRET;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${secret}${apiPath}${requestBody}${nonce}`)
    .digest("base64");

  let response;
  try {
    response = await fetch(`${getApiBaseUrl()}${apiPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-LINE-ChannelId": process.env.LINE_PAY_CHANNEL_ID,
        "X-LINE-Authorization-Nonce": nonce,
        "X-LINE-Authorization": signature,
      },
      body: requestBody,
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw new LinePayError("目前無法連線至 LINE Pay，請稍後再試");
  }

  const responseText = await response.text();
  let data;
  try {
    data = parseLinePayJson(responseText);
  } catch {
    throw new LinePayError("LINE Pay 回傳了無法辨識的資料");
  }

  if (!response.ok || data.returnCode !== "0000") {
    throw new LinePayError(
      data.returnMessage || "LINE Pay 交易失敗",
      data.returnCode
    );
  }
  return data;
};

const requestLinePay = async ({
  orderId,
  amount,
  items,
  confirmUrl,
  cancelUrl,
}) => {
  const apiVersion = getApiVersion();
  const body = {
    amount,
    currency: "TWD",
    orderId,
    packages: [
      {
        id: orderId,
        amount,
        name: "Scan to Order 掃描點餐",
        products: items.map((item) => ({
          id: String(item.productId),
          name: String(item.title).slice(0, 100),
          quantity: item.quantity,
          price: item.unitPrice,
        })),
      },
    ],
    redirectUrls: {
      confirmUrl,
      cancelUrl,
    },
  };
  return callLinePay(`/${apiVersion}/payments/request`, body);
};

const confirmLinePay = async ({ transactionId, amount }) => {
  const apiVersion = getApiVersion();
  return callLinePay(`/${apiVersion}/payments/${transactionId}/confirm`, {
    amount,
    currency: "TWD",
  });
};

module.exports = {
  LinePayError,
  confirmLinePay,
  getLinePayMode,
  requestLinePay,
};
