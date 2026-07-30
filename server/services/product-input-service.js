const { productValidation } = require("../validators/product-validator");
const {
  ProductOptionError,
  normalizeOptionGroups,
  normalizeProductOptions,
  normalizeSpecialRequestConfig,
  validateConfiguredPrice,
} = require("../product-options");

const validateBasicProduct = (body) => {
  const basicProduct = {
    title: body.title,
    description: body.description || "",
    price: body.price,
    type: body.type,
  };
  const { error, value } = productValidation(basicProduct);
  if (error) throw new ProductOptionError(error.details[0].message);
  return value;
};

const buildProductFields = (body) => {
  const basicProduct = validateBasicProduct(body);
  const customization = normalizeProductOptions(body);
  validateConfiguredPrice(basicProduct.price, customization.optionGroups);
  return {
    ...basicProduct,
    ...customization,
  };
};

const buildProductUpdateFields = (body, product) => {
  const basicProduct = validateBasicProduct(body);
  const hasOptionGroups = Object.prototype.hasOwnProperty.call(
    body,
    "optionGroups"
  );
  const hasSpecialRequestConfig = Object.prototype.hasOwnProperty.call(
    body,
    "specialRequestConfig"
  );
  const optionGroups = hasOptionGroups
    ? normalizeOptionGroups(body.optionGroups)
    : product.optionGroups || [];

  validateConfiguredPrice(basicProduct.price, optionGroups);

  return {
    ...basicProduct,
    ...(hasOptionGroups ? { optionGroups } : {}),
    ...(hasSpecialRequestConfig
      ? {
          specialRequestConfig: normalizeSpecialRequestConfig(
            body.specialRequestConfig
          ),
        }
      : {}),
  };
};

module.exports = {
  buildProductFields,
  buildProductUpdateFields,
  validateBasicProduct,
};
