const {
  loginValidation,
  registerValidation,
} = require("./validators/auth-validator");
const { productValidation } = require("./validators/product-validator");

module.exports = {
  loginValidation,
  productValidation,
  registerValidation,
};
