const PlatformSettings = require("../models/platform-settings-model");
const User = require("../models/user-model");
const {
  deleteStoredImage,
  removeUploadedFile,
  storeUploadedImage,
  verifyUploadedImage,
} = require("./product-image-service");
const {
  buildSubscriptionSummary,
  confirmRenewal,
  ensureSellerSubscriptionDocument,
  rejectRenewal,
  setRenewalTestWindow,
} = require("./subscription-service");

const STORE_LIST_LIMIT = 200;

const escapeRegExp = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const listStores = async ({ query = "" } = {}) => {
  const normalizedQuery = String(query || "")
    .normalize("NFKC")
    .trim();
  const filter = { role: "seller" };
  if (normalizedQuery) {
    filter.username = {
      $regex: escapeRegExp(normalizedQuery),
      $options: "i",
    };
  }

  const [total, storeDocuments] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select(
        "_id username role createdAt subscriptionStatus subscriptionStartedAt serviceExpiresAt renewalRequestStatus renewalRequestedAt renewalTransferAt renewalAccountLastFive renewalNote renewalReviewMessage lastSubscriptionPaymentAt lastSubscriptionPaymentConfirmedAt subscriptionReminderHiddenForExpiry"
      )
      .sort({ createdAt: -1 })
      .limit(STORE_LIST_LIMIT)
      .exec(),
  ]);
  const stores = await Promise.all(
    storeDocuments.map((store) => ensureSellerSubscriptionDocument(store))
  );

  return {
    total,
    stores: stores.map((store) => ({
      id: store._id,
      username: store.username,
      createdAt: store.createdAt,
      subscription: buildSubscriptionSummary(store),
    })),
  };
};

const toStoredQrImage = (settings) => ({
  image: settings?.paymentQrImage || "",
  imagePublicId: settings?.paymentQrImagePublicId || "",
  imageStorage: settings?.paymentQrImageStorage || "local",
});

const serializePaymentSettings = (settings) => ({
  monthlyFee: Number(settings?.monthlyFee ?? 299),
  payeeName: settings?.payeeName || "",
  paymentInstructions: settings?.paymentInstructions || "",
  paymentQrImage: settings?.paymentQrImage || "",
});

const getPaymentSettingsDocument = async () => {
  let settings = await PlatformSettings.findOne({ key: "subscription" }).select(
    "+paymentQrImagePublicId"
  );
  if (!settings) settings = new PlatformSettings({ key: "subscription" });
  return settings;
};

const getPaymentSettings = async () =>
  serializePaymentSettings(await getPaymentSettingsDocument());

const updatePaymentSettings = async ({ input, file }) => {
  let storedImage;
  try {
    await verifyUploadedImage(file);
    const settings = await getPaymentSettingsDocument();
    const monthlyFee = Number(input.monthlyFee);
    if (
      !Number.isInteger(monthlyFee) ||
      monthlyFee < 1 ||
      monthlyFee > 100000
    ) {
      throw new Error("月費必須是 1～100000 元的整數");
    }

    const payeeName = String(input.payeeName || "").trim();
    const paymentInstructions = String(input.paymentInstructions || "").trim();
    if (payeeName.length > 100 || paymentInstructions.length > 500) {
      throw new Error("收款說明內容過長");
    }

    const previousImage = toStoredQrImage(settings);
    if (file) {
      storedImage = await storeUploadedImage(file);
      settings.paymentQrImage = storedImage.image;
      settings.paymentQrImagePublicId = storedImage.imagePublicId;
      settings.paymentQrImageStorage = storedImage.imageStorage;
    }
    settings.monthlyFee = monthlyFee;
    settings.payeeName = payeeName;
    settings.paymentInstructions = paymentInstructions;
    await settings.save();

    if (storedImage?.image) await deleteStoredImage(previousImage);
    return serializePaymentSettings(settings);
  } catch (error) {
    if (storedImage?.image) {
      await deleteStoredImage(storedImage);
    } else {
      await removeUploadedFile(file);
    }
    if (!error.statusCode) {
      error.statusCode = 400;
      error.publicMessage = error.message;
    }
    throw error;
  }
};

module.exports = {
  confirmRenewal,
  getPaymentSettings,
  rejectRenewal,
  setRenewalTestWindow,
  STORE_LIST_LIMIT,
  listStores,
  updatePaymentSettings,
};
