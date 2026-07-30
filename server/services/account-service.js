const bcrypt = require("bcrypt");

const Payment = require("../models/payment-model");
const Product = require("../models/product-model");
const QrCode = require("../models/qr-code-model");
const User = require("../models/user-model");
const {
  deleteStoredImage,
  storeUploadedImage,
  verifyUploadedImage,
} = require("./product-image-service");

class AccountError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AccountError";
    this.statusCode = statusCode;
    this.publicMessage = message;
  }
}

const toPaymentQrStorage = (user) => ({
  image: user.paymentQrImage,
  imagePublicId: user.paymentQrImagePublicId,
  imageStorage: user.paymentQrImageStorage,
});

const getSellerSettings = async (sellerId) => {
  const seller = await User.findOne({ _id: sellerId, role: "seller" }).lean();
  if (!seller) throw new AccountError("找不到店家", 404);

  return {
    sellerId: seller._id,
    username: seller.username,
    acceptingOrders: seller.acceptingOrders !== false,
    paymentQrImage: seller.paymentQrImage || "",
  };
};

const updateSellerSettings = async ({
  sellerId,
  acceptingOrders,
  removePaymentQr,
  file,
}) => {
  const seller = await User.findOne({ _id: sellerId, role: "seller" }).select(
    "+paymentQrImagePublicId"
  );
  if (!seller) throw new AccountError("找不到店家", 404);

  let storedImage;
  const previousImage = toPaymentQrStorage(seller);

  try {
    if (typeof acceptingOrders === "boolean") {
      seller.acceptingOrders = acceptingOrders;
    }

    if (file) {
      await verifyUploadedImage(file);
      storedImage = await storeUploadedImage(file);
      seller.paymentQrImage = storedImage.image;
      seller.paymentQrImagePublicId = storedImage.imagePublicId;
      seller.paymentQrImageStorage = storedImage.imageStorage;
    } else if (removePaymentQr) {
      seller.paymentQrImage = "";
      seller.paymentQrImagePublicId = "";
      seller.paymentQrImageStorage = "local";
    }

    await seller.save();

    if ((storedImage?.image || removePaymentQr) && previousImage.image) {
      await deleteStoredImage(previousImage);
    }

    return getSellerSettings(sellerId);
  } catch (error) {
    if (storedImage?.image) await deleteStoredImage(storedImage);
    throw error;
  }
};

const deleteSellerAccount = async ({ sellerId, password }) => {
  const seller = await User.findOne({ _id: sellerId, role: "seller" }).select(
    "+password +paymentQrImagePublicId"
  );
  if (!seller) throw new AccountError("找不到店家帳號", 404);

  const passwordMatches = await bcrypt.compare(password, seller.password);
  if (!passwordMatches) {
    throw new AccountError("密碼不正確，帳號未刪除", 401);
  }

  const products = await Product.find({ seller: sellerId }).select(
    "+imagePublicId"
  );
  for (const product of products) {
    await deleteStoredImage(product);
  }
  await deleteStoredImage(toPaymentQrStorage(seller));

  await Promise.all([
    Product.deleteMany({ seller: sellerId }),
    Payment.deleteMany({ seller: sellerId }),
    QrCode.deleteMany({ seller: sellerId }),
    User.deleteMany({ qrSeller: sellerId, role: "buyer" }),
  ]);
  await seller.deleteOne();

  return { message: "帳號與店家資料已刪除" };
};

module.exports = {
  AccountError,
  deleteSellerAccount,
  getSellerSettings,
  updateSellerSettings,
};
