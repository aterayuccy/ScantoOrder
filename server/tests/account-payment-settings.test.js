jest.mock("../models/payment-model", () => ({
  deleteMany: jest.fn(),
}));
jest.mock("../models/product-model", () => ({
  deleteMany: jest.fn(),
  find: jest.fn(),
}));
jest.mock("../models/qr-code-model", () => ({
  deleteMany: jest.fn(),
}));
jest.mock("../models/support-ticket-model", () => ({
  deleteMany: jest.fn(),
}));
jest.mock("../models/user-model", () => ({
  deleteMany: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock("../services/product-image-service", () => ({
  deleteStoredImage: jest.fn(),
  storeUploadedImage: jest.fn(),
  verifyUploadedImage: jest.fn(),
}));

const User = require("../models/user-model");
const { updateSellerSettings } = require("../services/account-service");

describe("seller LINE Pay settings", () => {
  const originalEncryptionKey = process.env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY;

  afterEach(() => {
    jest.clearAllMocks();
    if (originalEncryptionKey === undefined) {
      delete process.env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY;
    } else {
      process.env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY = originalEncryptionKey;
    }
  });

  test("stores each seller's LINE Pay credentials encrypted", async () => {
    process.env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY =
      "test-payment-encryption-key-with-32-characters";
    const seller = {
      acceptingOrders: true,
      paymentQrImage: "",
      paymentQrImagePublicId: "",
      paymentQrImageStorage: "local",
      linePayMerchantReady: false,
      linePayConfigured: false,
      linePayChannelIdHint: "",
      linePayCredentialsEncrypted: "",
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findOne
      .mockReturnValueOnce({
        select: jest.fn().mockResolvedValue(seller),
      })
      .mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          _id: "seller-1",
          username: "測試店家",
          acceptingOrders: true,
          paymentQrImage: "",
          linePayMerchantReady: true,
          linePayConfigured: true,
          linePayChannelIdHint: "5678",
        }),
      });

    const result = await updateSellerSettings({
      sellerId: "seller-1",
      linePayMerchantReady: true,
      linePayChannelId: "channel-12345678",
      linePayChannelSecret: "secret-value-1234567890",
    });

    expect(seller.linePayCredentialsEncrypted).not.toContain(
      "secret-value-1234567890"
    );
    expect(seller.linePayMerchantReady).toBe(true);
    expect(seller.linePayConfigured).toBe(true);
    expect(seller.linePayChannelIdHint).toBe("5678");
    expect(seller.save).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      linePayMerchantReady: true,
      linePayConfigured: true,
      linePayAvailable: true,
      linePayChannelIdHint: "5678",
    });
  });

  test("removes stored credentials when automatic LINE Pay is disabled", async () => {
    process.env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY =
      "test-payment-encryption-key-with-32-characters";
    const seller = {
      acceptingOrders: true,
      paymentQrImage: "",
      paymentQrImagePublicId: "",
      paymentQrImageStorage: "local",
      linePayMerchantReady: true,
      linePayConfigured: true,
      linePayChannelIdHint: "5678",
      linePayCredentialsEncrypted: "encrypted-value",
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findOne
      .mockReturnValueOnce({
        select: jest.fn().mockResolvedValue(seller),
      })
      .mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          _id: "seller-1",
          username: "測試店家",
          acceptingOrders: true,
          paymentQrImage: "",
          linePayMerchantReady: false,
          linePayConfigured: false,
          linePayChannelIdHint: "",
        }),
      });

    const result = await updateSellerSettings({
      sellerId: "seller-1",
      linePayMerchantReady: false,
    });

    expect(seller.linePayCredentialsEncrypted).toBe("");
    expect(seller.linePayMerchantReady).toBe(false);
    expect(seller.linePayConfigured).toBe(false);
    expect(result.linePayAvailable).toBe(false);
  });
});
