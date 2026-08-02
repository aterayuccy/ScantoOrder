const router = require("express").Router();

const paymentController = require("../controllers/payment-controller");
const {
  authenticate,
  buyerOnly,
  sellerOnly,
} = require("../middlewares/authorization");
const { activeStoreOnly } = require("../middlewares/subscription-access");

router.get("/mode", paymentController.getMode);
router.use(authenticate, activeStoreOnly);

router.post("/checkout", buyerOnly, paymentController.checkout);
router.get("/buyer/:orderId", buyerOnly, paymentController.getBuyerPayment);
router.post("/confirm", buyerOnly, paymentController.confirm);
router.post("/cancel", buyerOnly, paymentController.cancel);
router.get("/seller", sellerOnly, paymentController.listSellerPayments);
router.get(
  "/seller/stats/today",
  sellerOnly,
  paymentController.getSellerDailyStats
);
router.patch(
  "/seller/:orderBatchId/mark-paid",
  sellerOnly,
  paymentController.markStorePaymentPaid
);
router.patch(
  "/seller/:orderBatchId/invoice-processed",
  sellerOnly,
  paymentController.markInvoiceProcessed
);
router.patch(
  "/seller/:orderBatchId/status",
  sellerOnly,
  paymentController.updateOrderStatus
);

module.exports = router;
