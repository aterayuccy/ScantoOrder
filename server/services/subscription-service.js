const PlatformSettings = require("../models/platform-settings-model");
const User = require("../models/user-model");

const TRIAL_MONTHS = 3;
const RENEWAL_MONTHS = 1;
const RENEWAL_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

class SubscriptionError extends Error {
  constructor(message, statusCode = 400, code = "SUBSCRIPTION_ERROR") {
    super(message);
    this.name = "SubscriptionError";
    this.statusCode = statusCode;
    this.publicMessage = message;
    this.code = code;
  }
}

const addTaipeiCalendarMonths = (value, months) => {
  const shifted = new Date(new Date(value).getTime() + TAIPEI_OFFSET_MS);
  const targetMonthStart = new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth() + months,
      1,
      23,
      59,
      59,
      999
    )
  );
  const lastDay = new Date(
    Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth() + 1,
      0
    )
  ).getUTCDate();
  targetMonthStart.setUTCDate(Math.min(shifted.getUTCDate(), lastDay));
  return new Date(targetMonthStart.getTime() - TAIPEI_OFFSET_MS);
};

const createInitialSubscriptionFields = (now = new Date()) => ({
  subscriptionStatus: "trial",
  subscriptionStartedAt: now,
  serviceExpiresAt: addTaipeiCalendarMonths(now, TRIAL_MONTHS),
});

const sameInstant = (left, right) =>
  Boolean(
    left && right && new Date(left).getTime() === new Date(right).getTime()
  );

const getDaysRemaining = (expiresAt, now = new Date()) => {
  if (!expiresAt || new Date(expiresAt) < now) return 0;
  return Math.max(
    1,
    Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / DAY_MS)
  );
};

const ensureSellerSubscriptionDocument = async (seller, now = new Date()) => {
  if (!seller || seller.role !== "seller") {
    throw new SubscriptionError("找不到指定的店家", 404);
  }

  let changed = false;
  if (!seller.subscriptionStartedAt || !seller.serviceExpiresAt) {
    Object.assign(seller, createInitialSubscriptionFields(now));
    changed = true;
  }

  if (
    seller.serviceExpiresAt &&
    new Date(seller.serviceExpiresAt) < now &&
    seller.subscriptionStatus !== "suspended"
  ) {
    seller.subscriptionStatus = "suspended";
    changed = true;
  }

  if (changed) await seller.save();
  return seller;
};

const findSellerSubscriptionDocument = async (sellerId, now = new Date()) => {
  const seller = await User.findOne({ _id: sellerId, role: "seller" });
  return ensureSellerSubscriptionDocument(seller, now);
};

const buildSubscriptionSummary = (seller, now = new Date()) => {
  const expiresAt = seller.serviceExpiresAt
    ? new Date(seller.serviceExpiresAt)
    : null;
  const status = seller.subscriptionStatus || "trial";
  const daysRemaining = getDaysRemaining(expiresAt, now);
  const inRenewalWindow =
    status !== "suspended" &&
    daysRemaining >= 1 &&
    daysRemaining <= RENEWAL_WINDOW_DAYS;
  const reminderHidden =
    inRenewalWindow &&
    sameInstant(seller.subscriptionReminderHiddenForExpiry, expiresAt);

  return {
    status,
    statusLabel: {
      trial: "測試使用中",
      paid: "付費使用中",
      suspended: "暫停使用中",
    }[status],
    startedAt: seller.subscriptionStartedAt,
    expiresAt,
    daysRemaining,
    inRenewalWindow,
    canRenew: status === "suspended" || inRenewalWindow,
    renewalRequest: {
      status: seller.renewalRequestStatus || "none",
      requestedAt: seller.renewalRequestedAt || null,
      transferAt: seller.renewalTransferAt || null,
      accountLastFive: seller.renewalAccountLastFive || "",
      note: seller.renewalNote || "",
      reviewMessage: seller.renewalReviewMessage || "",
    },
    reminder: {
      active: inRenewalWindow,
      hidden: reminderHidden,
      message: inRenewalWindow
        ? `[系統代發] 您的使用期限剩餘 ${daysRemaining} 天，若要繼續使用，請前往個人頁面完成續費。`
        : "",
    },
    lastPaymentAt: seller.lastSubscriptionPaymentAt || null,
    lastPaymentConfirmedAt: seller.lastSubscriptionPaymentConfirmedAt || null,
  };
};

const getPlatformPaymentSettings = async () => {
  const settings = await PlatformSettings.findOneAndUpdate(
    { key: "subscription" },
    { $setOnInsert: { key: "subscription" } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return {
    monthlyFee: Number(settings.monthlyFee ?? 299),
    payeeName: settings.payeeName || "",
    paymentInstructions: settings.paymentInstructions || "",
    paymentQrImage: settings.paymentQrImage || "",
  };
};

const getSellerSubscription = async (sellerId, { now = new Date() } = {}) => {
  const seller = await findSellerSubscriptionDocument(sellerId, now);
  const [subscription, paymentSettings] = await Promise.all([
    Promise.resolve(buildSubscriptionSummary(seller, now)),
    getPlatformPaymentSettings(),
  ]);
  return { subscription, paymentSettings };
};

const setReminderHidden = async ({ sellerId, hidden, now = new Date() }) => {
  const seller = await findSellerSubscriptionDocument(sellerId, now);
  const summary = buildSubscriptionSummary(seller, now);
  if (!summary.reminder.active) {
    throw new SubscriptionError("目前沒有可調整的到期提醒", 409);
  }

  seller.subscriptionReminderHiddenForExpiry = hidden
    ? seller.serviceExpiresAt
    : null;
  await seller.save();
  return buildSubscriptionSummary(seller, now);
};

const submitRenewalRequest = async ({ sellerId, input, now = new Date() }) => {
  const seller = await findSellerSubscriptionDocument(sellerId, now);
  const summary = buildSubscriptionSummary(seller, now);
  if (!summary.canRenew) {
    throw new SubscriptionError("尚未進入續費期間", 409);
  }

  const paymentSettings = await getPlatformPaymentSettings();
  if (!paymentSettings.paymentQrImage) {
    throw new SubscriptionError("平台尚未設定收款碼，請聯絡客服", 503);
  }

  seller.renewalRequestStatus = "pending";
  seller.renewalRequestedAt = now;
  seller.renewalTransferAt = input.transferAt;
  seller.renewalAccountLastFive = input.accountLastFive;
  seller.renewalNote = input.note || "";
  seller.renewalReviewMessage = "";
  await seller.save();

  return buildSubscriptionSummary(seller, now);
};

const confirmRenewal = async ({ sellerId, now = new Date() }) => {
  const seller = await findSellerSubscriptionDocument(sellerId, now);
  if (seller.renewalRequestStatus !== "pending") {
    throw new SubscriptionError("這家店目前沒有待核帳的續費申請", 409);
  }

  const wasSuspended = seller.subscriptionStatus === "suspended";
  const baseDate =
    wasSuspended || new Date(seller.serviceExpiresAt) < now
      ? now
      : new Date(seller.serviceExpiresAt);

  seller.subscriptionStatus = "paid";
  seller.serviceExpiresAt = addTaipeiCalendarMonths(baseDate, RENEWAL_MONTHS);
  seller.lastSubscriptionPaymentAt = seller.renewalTransferAt || now;
  seller.lastSubscriptionPaymentConfirmedAt = now;
  seller.subscriptionReminderHiddenForExpiry = null;
  seller.renewalRequestStatus = "none";
  seller.renewalReviewMessage = "";
  await seller.save();

  return {
    action: wasSuspended ? "restored" : "extended",
    subscription: buildSubscriptionSummary(seller, now),
  };
};

const rejectRenewal = async ({ sellerId, message, now = new Date() }) => {
  const seller = await findSellerSubscriptionDocument(sellerId, now);
  if (seller.renewalRequestStatus !== "pending") {
    throw new SubscriptionError("這家店目前沒有待核帳的續費申請", 409);
  }

  seller.renewalRequestStatus = "rejected";
  seller.renewalReviewMessage =
    String(message || "查無款項，請確認後重新提交。")
      .trim()
      .slice(0, 200) || "查無款項，請確認後重新提交。";
  await seller.save();
  return buildSubscriptionSummary(seller, now);
};

const setRenewalTestWindow = async ({ sellerId, now = new Date() }) => {
  const seller = await findSellerSubscriptionDocument(sellerId, now);
  if (seller.subscriptionStatus === "suspended") {
    seller.subscriptionStatus = "trial";
  }
  seller.serviceExpiresAt = new Date(
    now.getTime() + RENEWAL_WINDOW_DAYS * DAY_MS
  );
  seller.subscriptionReminderHiddenForExpiry = null;
  seller.renewalRequestStatus = "none";
  seller.renewalRequestedAt = null;
  seller.renewalTransferAt = null;
  seller.renewalAccountLastFive = "";
  seller.renewalNote = "";
  seller.renewalReviewMessage = "";
  await seller.save();
  return buildSubscriptionSummary(seller, now);
};

const requireActiveSubscription = async (sellerId, now = new Date()) => {
  const seller = await findSellerSubscriptionDocument(sellerId, now);
  const summary = buildSubscriptionSummary(seller, now);
  if (summary.status === "suspended") {
    throw new SubscriptionError(
      "店家服務期限已到，目前暫停使用",
      403,
      "SUBSCRIPTION_SUSPENDED"
    );
  }
  return summary;
};

module.exports = {
  addTaipeiCalendarMonths,
  buildSubscriptionSummary,
  confirmRenewal,
  createInitialSubscriptionFields,
  ensureSellerSubscriptionDocument,
  getDaysRemaining,
  getPlatformPaymentSettings,
  getSellerSubscription,
  rejectRenewal,
  requireActiveSubscription,
  RENEWAL_WINDOW_DAYS,
  setRenewalTestWindow,
  setReminderHidden,
  submitRenewalRequest,
  SubscriptionError,
};
