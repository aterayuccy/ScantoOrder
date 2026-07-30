const validateRequest = (schema, buildPayload = (req) => req.body) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(buildPayload(req), {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).send(error.details[0].message);
    }

    req.validatedBody = value;
    return next();
  };
};

module.exports = validateRequest;
