const { ProductOptionError } = require("../product-options");

const notFoundHandler = (req, res) => {
  res.status(404).send({ message: "找不到指定的 API" });
};

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error instanceof ProductOptionError) {
    return res.status(400).send(error.message);
  }

  console.error(`${req.method} ${req.originalUrl} error:`, error);
  return res.status(error.statusCode || 500).send({
    message: error.publicMessage || "伺服器處理失敗，請稍後再試",
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
