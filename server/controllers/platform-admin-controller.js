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

module.exports = {
  listStores,
};
