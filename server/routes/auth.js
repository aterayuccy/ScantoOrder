const router = require("express").Router();

const authController = require("../controllers/auth-controller");
const qrCodeController = require("../controllers/qr-code-controller");
const { authenticate, sellerOnly } = require("../middlewares/authorization");
const validateRequest = require("../middlewares/validate-request");
const {
  loginSchema,
  qrCodeCountSchema,
  qrLoginSchema,
  registerSchema,
} = require("../validators/auth-validator");

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
