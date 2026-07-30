const passport = require("passport");

const authenticate = passport.authenticate("jwt", { session: false });

const sameId = (left, right) =>
  Boolean(left && right && String(left) === String(right));

const requireSeller = (req, res) => {
  if (!req.user?.isSeller?.()) {
    res.status(403).send("只有店家帳號可以執行此操作");
    return false;
  }
  return true;
};

const sellerOnly = (req, res, next) => {
  if (!requireSeller(req, res)) return;
  next();
};

const buyerOnly = (req, res, next) => {
  if (!req.user?.isBuyer?.()) {
    return res.status(403).send("只有顧客帳號可以執行此操作");
  }
  return next();
};

module.exports = {
  authenticate,
  buyerOnly,
  requireSeller,
  sameId,
  sellerOnly,
};
