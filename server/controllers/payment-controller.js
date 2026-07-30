const paymentService = require("../services/payment-service");

const getMode = (_req, res) => res.send(paymentService.getPaymentMode());

const checkout = async (req, res, next) => {
  try {
    return res.send(
      await paymentService.createCheckout({
        user: req.user,
        body: req.body,
        origin: req.get("origin"),
      })
    );
  } catch (error) {
    return next(error);
  }
};

const getBuyerPayment = async (req, res, next) => {
  try {
    return res.send(
      await paymentService.getBuyerPayment(req.user, req.params.orderId)
    );
  } catch (error) {
    return next(error);
  }
};

const confirm = async (req, res, next) => {
  try {
    return res.send(
      await paymentService.confirmPayment({
        user: req.user,
        body: req.body,
      })
    );
  } catch (error) {
    return next(error);
  }
};

const cancel = async (req, res, next) => {
  try {
    return res.send(
      await paymentService.cancelPayment(req.user, req.body.orderId)
    );
  } catch (error) {
    return next(error);
  }
};

const listSellerPayments = async (req, res, next) => {
  try {
    return res.send(await paymentService.listSellerPayments(req.user._id));
  } catch (error) {
    return next(error);
  }
};

const getSellerDailyStats = async (req, res, next) => {
  try {
    return res.send(await paymentService.getSellerDailyStats(req.user._id));
  } catch (error) {
    return next(error);
  }
};

const markStorePaymentPaid = async (req, res, next) => {
  try {
    return res.send(
      await paymentService.markStorePaymentPaid(
        req.user._id,
        req.params.orderBatchId
      )
    );
  } catch (error) {
    return next(error);
  }
};

const markInvoiceProcessed = async (req, res, next) => {
  try {
    return res.send(
      await paymentService.markInvoiceProcessed(
        req.user._id,
        req.params.orderBatchId
      )
    );
  } catch (error) {
    return next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    return res.send(
      await paymentService.updateOrderStatus(
        req.user._id,
        req.params.orderBatchId,
        req.body.status
      )
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  cancel,
  checkout,
  confirm,
  getBuyerPayment,
  getMode,
  getSellerDailyStats,
  listSellerPayments,
  markInvoiceProcessed,
  markStorePaymentPaid,
  updateOrderStatus,
};
