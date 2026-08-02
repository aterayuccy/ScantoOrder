const platformAdminService = require("../services/platform-admin-service");

const listStores = async (req, res, next) => {
  try {
    return res.send(
      await platformAdminService.listStores({
        query: req.query.q || "",
      })
    );
  } catch (error) {
    return next(error);
  }
};

const getPaymentSettings = async (req, res, next) => {
  try {
    return res.send(await platformAdminService.getPaymentSettings());
  } catch (error) {
    return next(error);
  }
};

const updatePaymentSettings = async (req, res, next) => {
  try {
    return res.send(
      await platformAdminService.updatePaymentSettings({
        input: req.body || {},
        file: req.file,
      })
    );
  } catch (error) {
    return next(error);
  }
};

const confirmStoreRenewal = async (req, res, next) => {
  try {
    return res.send(
      await platformAdminService.confirmRenewal({
        sellerId: req.params.sellerId,
      })
    );
  } catch (error) {
    return next(error);
  }
};

const rejectStoreRenewal = async (req, res, next) => {
  try {
    return res.send({
      subscription: await platformAdminService.rejectRenewal({
        sellerId: req.params.sellerId,
        message: req.validatedBody.message,
      }),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  confirmStoreRenewal,
  getPaymentSettings,
  listStores,
  rejectStoreRenewal,
  updatePaymentSettings,
};
