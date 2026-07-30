const Payment = require("../models/payment-model");
const Product = require("../models/product-model");

const deprecatedSubmitOrder = (req, res) =>
  res.status(410).send("請在購物車選擇付款方式與發票設定後再送出訂單");

const completeOrderBatch = async (req, res, next) => {
  try {
    const result = await Product.updateMany(
      {
        seller: req.user._id,
        "buyer.orderBatchId": req.params.orderBatchId,
      },
      { $pull: { buyer: { orderBatchId: req.params.orderBatchId } } }
    );
    await Payment.updateOne(
      {
        seller: req.user._id,
        orderBatchId: req.params.orderBatchId,
      },
      { completedAt: new Date() }
    );
    return res.send({ message: "訂單已完成並移除", result });
  } catch (error) {
    return next(error);
  }
};

const completeTableOrder = async (req, res, next) => {
  const tableNumber = Number(req.params.tableNumber);
  if (!Number.isInteger(tableNumber) || tableNumber < 1) {
    return res.status(400).send("桌號不正確");
  }

  try {
    const result = await Product.updateMany(
      { seller: req.user._id },
      {
        $pull: {
          buyer: { tableNumber, submittedAt: { $type: "date" } },
        },
      }
    );
    return res.send({ message: "桌號訂單已完成並移除", result });
  } catch (error) {
    return next(error);
  }
};

const completeBuyerOrder = async (req, res, next) => {
  try {
    const result = await Product.updateMany(
      { seller: req.user._id },
      {
        $pull: {
          buyer: {
            user: req.params.buyerId,
            submittedAt: { $type: "date" },
          },
        },
      }
    );
    return res.send({ message: "顧客訂單已完成並移除", result });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  completeBuyerOrder,
  completeOrderBatch,
  completeTableOrder,
  deprecatedSubmitOrder,
};
