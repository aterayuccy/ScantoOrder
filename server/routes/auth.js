const router = require("express").Router();

const authController = require("../controllers/auth-controller");
const qrCodeController = require("../controllers/qr-code-controller");
const { authenticate, sellerOnly } = require("../middlewares/authorization");
const validateRequest = require("../middlewares/validate-request");
const {
  changePasswordSchema,
  deleteAccountSchema,
  loginSchema,
  qrCodeCountSchema,
  qrLoginSchema,
  recoveryCodeSchema,
  registerSchema,
  resetPasswordSchema,
} = require("../validators/auth-validator");
const { uploadProductImage } = require("../services/product-image-service");

router.get("/testAPI", (req, res) => res.send("成功連結 auth route"));

router.post(
  "/register",
  validateRequest(registerSchema, (req) => ({
    username: req.body.username,
    password: req.body.password,
    role: "seller",
  })),
  authController.register
);

router.post("/login", validateRequest(loginSchema), authController.login);
router.post(
  "/forgot-password",
  validateRequest(resetPasswordSchema),
  authController.resetPassword
);
router.post(
  "/change-password",
  authenticate,
  sellerOnly,
  validateRequest(changePasswordSchema),
  authController.changePassword
);
router.post(
  "/recovery-code",
  authenticate,
  sellerOnly,
  validateRequest(recoveryCodeSchema),
  authController.regenerateRecoveryCode
);
router.delete(
  "/account",
  authenticate,
  sellerOnly,
  validateRequest(deleteAccountSchema),
  authController.deleteAccount
);
router.get("/settings", authenticate, sellerOnly, authController.getSettings);
router.patch(
  "/settings",
  authenticate,
  sellerOnly,
  uploadProductImage,
  authController.updateSettings
);
router.get("/store/:sellerId", authenticate, authController.getStore);

router.get("/qr-codes", authenticate, sellerOnly, qrCodeController.listQrCodes);

router.post(
  "/create-qr-token",
  authenticate,
  sellerOnly,
  validateRequest(qrCodeCountSchema),
  qrCodeController.createQrCodes
);

router.delete(
  "/qr-codes/:qrCodeId",
  authenticate,
  sellerOnly,
  qrCodeController.deleteQrCode
);

router.post(
  "/qr-login",
  validateRequest(qrLoginSchema),
  qrCodeController.qrLogin
);

module.exports = router;
