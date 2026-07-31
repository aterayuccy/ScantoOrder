const bcrypt = require("bcrypt");

const Payment = require("../models/payment-model");
const Product = require("../models/product-model");
const QrCode = require("../models/qr-code-model");
const SupportTicket = require("../models/support-ticket-model");
const User = require("../models/user-model");
const {
  deleteStoredImage,
  storeUploadedImage,
  verifyUploadedImage,
} = require("./product-image-service");
const {
  encryptPaymentCredentials,
  hasPaymentCredentialEncryptionKey,
  PaymentCredentialError,
} = require("./payment-credential-service");

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

const normalizeLinePayCredentials = (channelId, channelSecret) => {
  const normalizedChannelId = String(channelId || "").trim();
  const normalizedChannelSecret = String(channelSecret || "").trim();

  if (!normalizedChannelId || !normalizedChannelSecret) {
    throw new AccountError("請同時輸入 Channel ID 與 Channel Secret");
  }
  if (normalizedChannelId.length < 4 || normalizedChannelId.length > 100) {
    throw new AccountError("Channel ID 格式不正確");
  }
  if (
    normalizedChannelSecret.length < 16 ||
    normalizedChannelSecret.length > 300
  ) {
    throw new AccountError("Channel Secret 格式不正確");
  }

  return {
    channelId: normalizedChannelId,
    channelSecret: normalizedChannelSecret,
    environment: "production",
  };
};

const getSellerSettings = async (
  sellerId,
  { includeLinePayDetails = false } = {}
) => {
  const seller = await User.findOne({ _id: sellerId, role: "seller" }).lean();
  if (!seller) throw new AccountError("找不到店家", 404);

  const settings = {
    sellerId: seller._id,
    username: seller.username,
    acceptingOrders: seller.acceptingOrders !== false,
    paymentQrImage: seller.paymentQrImage || "",
    linePayAvailable:
      seller.linePayMerchantReady === true &&
      seller.linePayConfigured === true &&
      hasPaymentCredentialEncryptionKey(),
  };

  if (includeLinePayDetails) {
    settings.linePayMerchantReady = seller.linePayMerchantReady === true;
    settings.linePayConfigured = seller.linePayConfigured === true;
    settings.linePayChannelIdHint = seller.linePayChannelIdHint || "";
  }

  return settings;
};

const updateSellerSettings = async ({
  sellerId,
  acceptingOrders,
  removePaymentQr,
  file,
  linePayMerchantReady,
  linePayChannelId,
  linePayChannelSecret,
}) => {
  const seller = await User.findOne({ _id: sellerId, role: "seller" }).select(
    "+paymentQrImagePublicId +linePayCredentialsEncrypted"
  );
  if (!seller) throw new AccountError("找不到店家", 404);

  let storedImage;
  const previousImage = toPaymentQrStorage(seller);

  try {
    if (typeof acceptingOrders === "boolean") {
      seller.acceptingOrders = acceptingOrders;
    }

    if (typeof linePayMerchantReady === "boolean") {
      if (!linePayMerchantReady) {
        seller.linePayMerchantReady = false;
        seller.linePayConfigured = false;
        seller.linePayChannelIdHint = "";
        seller.linePayCredentialsEncrypted = "";
      } else {
        const hasNewChannelId = Boolean(String(linePayChannelId || "").trim());
        const hasNewChannelSecret = Boolean(
          String(linePayChannelSecret || "").trim()
        );

        if (hasNewChannelId !== hasNewChannelSecret) {
          throw new AccountError(
            "更新 LINE Pay 時，請同時輸入 Channel ID 與 Channel Secret"
          );
        }

        if (hasNewChannelId && hasNewChannelSecret) {
          const credentials = normalizeLinePayCredentials(
            linePayChannelId,
            linePayChannelSecret
          );
          try {
            seller.linePayCredentialsEncrypted =
              encryptPaymentCredentials(credentials);
          } catch (error) {
            if (error instanceof PaymentCredentialError) {
              throw new AccountError(error.message, 503);
            }
            throw error;
          }
          seller.linePayChannelIdHint = credentials.channelId.slice(-4);
          seller.linePayConfigured = true;
        } else if (
          !seller.linePayConfigured ||
          !seller.linePayCredentialsEncrypted
        ) {
          throw new AccountError("請輸入 LINE Pay 網路串接金鑰");
        }

        seller.linePayMerchantReady = true;
      }
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

    return getSellerSettings(sellerId, { includeLinePayDetails: true });
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
    SupportTicket.deleteMany({ seller: sellerId }),
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
