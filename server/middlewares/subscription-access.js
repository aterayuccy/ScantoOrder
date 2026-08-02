const {
  requireActiveSubscription,
} = require("../services/subscription-service");

const activeStoreOnly = async (req, res, next) => {
  try {
    const sellerId = req.user?.isSeller?.() ? req.user._id : req.user?.qrSeller;
    if (!sellerId) {
      return res.status(403).send({ message: "找不到目前使用的店家" });
    }

    req.storeSubscription = await requireActiveSubscription(sellerId);
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  activeStoreOnly,
};
