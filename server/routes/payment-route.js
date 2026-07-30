const router = require("express").Router();

const paymentController = require("../controllers/payment-controller");
const {
  authenticate,
  buyerOnly,
  sellerOnly,
} = require("../middlewares/authorization");

router.get("/mode", paymentController.getMode);
router.post("/checkout", authenticate, buyerOnly, paymentController.checkout);
router.get(
  "/buyer/:orderId",
  authenticate,
  buyerOnly,
  paymentController.getBuyerPayment
);
router.post("/confirm", authenticate, buyerOnly, paymentController.confirm);
router.post("/cancel", authenticate, buyerOnly, paymentController.cancel);
router.get(
  "/seller",
  authenticate,
  sellerOnly,
  paymentController.listSellerPayments
);
router.get(
  "/seller/stats/today",
  authenticate,
  sellerOnly,
  paymentController.getSellerDailyStats
);
router.patch(
  "/seller/:orderBatchId/mark-paid",
  authenticate,
  sellerOnly,
  paymentController.markStorePaymentPaid
);
router.patch(
  "/seller/:orderBatchId/invoice-processed",
  authenticate,
  sellerOnly,
  paymentController.markInvoiceProcessed
);
router.patch(
  "/seller/:orderBatchId/status",
  authenticate,
  sellerOnly,
  paymentController.updateOrderStatus
);

module.exports = router;
