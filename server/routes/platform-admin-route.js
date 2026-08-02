const router = require("express").Router();

const platformAdminController = require("../controllers/platform-admin-controller");
const supportAdminOnly = require("../middlewares/support-admin");
const validateRequest = require("../middlewares/validate-request");
const { uploadProductImage } = require("../services/product-image-service");
const { rejectRenewalSchema } = require("../validators/subscription-validator");

router.use(supportAdminOnly);
router.get("/stores", platformAdminController.listStores);
router.get(
  "/subscription-settings",
  platformAdminController.getPaymentSettings
);
router.patch(
  "/subscription-settings",
  uploadProductImage,
  platformAdminController.updatePaymentSettings
);
router.post(
  "/stores/:sellerId/subscription/confirm",
  platformAdminController.confirmStoreRenewal
);
router.post(
  "/stores/:sellerId/subscription/reject",
  validateRequest(rejectRenewalSchema),
  platformAdminController.rejectStoreRenewal
);
router.post(
  "/stores/:sellerId/subscription/test-window",
  platformAdminController.setStoreRenewalTestWindow
);
router.post(
  "/stores/:sellerId/subscription/suspend",
  platformAdminController.suspendStore
);

module.exports = router;
