const Joi = require("joi");

const productSchema = Joi.object({
  title: Joi.string().trim().min(1).max(50).required(),
  description: Joi.string().max(255).allow("").optional(),
  price: Joi.number().integer().min(0).max(9999).required(),
  type: Joi.string().trim().min(1).max(50).required(),
});

const productValidation = (data) => productSchema.validate(data);

module.exports = {
  productSchema,
  productValidation,
};
