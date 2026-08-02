const { ProductOptionError } = require("../product-options");
const { CheckoutError } = require("../services/checkout-service");
const { LinePayError } = require("../services/line-pay-service");
const { PaymentError } = require("../services/payment-service");

const notFoundHandler = (req, res) => {
  res.status(404).send({ message: "找不到指定的 API" });
};

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error instanceof ProductOptionError) {
    return res.status(400).send(error.message);
  }
  if (error instanceof CheckoutError || error instanceof PaymentError) {
    return res.status(error.statusCode || 400).send(error.message);
  }
  if (error instanceof LinePayError) {
    return res.status(502).send({
      message: error.message,
      resultCode: error.resultCode,
    });
  }

  console.error(`${req.method} ${req.originalUrl} error:`, error);
  const response = {
    message: error.publicMessage || "伺服器處理失敗，請稍後再試",
  };
  if (error.code) response.code = error.code;
  return res.status(error.statusCode || 500).send(response);
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
