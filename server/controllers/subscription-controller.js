const subscriptionService = require("../services/subscription-service");

const getSubscription = async (req, res, next) => {
  try {
    return res.send(
      await subscriptionService.getSellerSubscription(req.user._id)
    );
  } catch (error) {
    return next(error);
  }
};

const updateReminderVisibility = async (req, res, next) => {
  try {
    return res.send({
      subscription: await subscriptionService.setReminderHidden({
        sellerId: req.user._id,
        hidden: req.validatedBody.hidden,
      }),
    });
  } catch (error) {
    return next(error);
  }
};

const requestRenewal = async (req, res, next) => {
  try {
    return res.status(201).send({
      subscription: await subscriptionService.submitRenewalRequest({
        sellerId: req.user._id,
        input: req.validatedBody,
      }),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getSubscription,
  requestRenewal,
  updateReminderVisibility,
};
