const {
  PaymentCredentialError,
  decryptPaymentCredentials,
  encryptPaymentCredentials,
  hasPaymentCredentialEncryptionKey,
} = require("../services/payment-credential-service");

describe("payment credential encryption", () => {
  const originalEncryptionKey = process.env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY;

  afterEach(() => {
    if (originalEncryptionKey === undefined) {
      delete process.env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY;
    } else {
      process.env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY = originalEncryptionKey;
    }
  });

  test("encrypts and decrypts a store's LINE Pay credentials", () => {
    process.env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY =
      "test-payment-encryption-key-with-32-characters";
    const credentials = {
      channelId: "merchant-channel-1234",
      channelSecret: "merchant-secret-value-123456789",
      environment: "production",
    };

    const encrypted = encryptPaymentCredentials(credentials);

    expect(encrypted).not.toContain(credentials.channelId);
    expect(encrypted).not.toContain(credentials.channelSecret);
    expect(decryptPaymentCredentials(encrypted)).toEqual(credentials);
  });

  test("rejects a modified encrypted value", () => {
    process.env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY =
      "test-payment-encryption-key-with-32-characters";
    const encrypted = encryptPaymentCredentials({
      channelId: "merchant-channel-1234",
      channelSecret: "merchant-secret-value-123456789",
      environment: "production",
    });

    expect(() =>
      decryptPaymentCredentials(`${encrypted.slice(0, -1)}x`)
    ).toThrow(PaymentCredentialError);
  });

  test("requires a sufficiently long server encryption key", () => {
    process.env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY = "too-short";

    expect(hasPaymentCredentialEncryptionKey()).toBe(false);
    expect(() =>
      encryptPaymentCredentials({
        channelId: "merchant-channel-1234",
        channelSecret: "merchant-secret-value-123456789",
      })
    ).toThrow("付款金鑰加密設定尚未完成");
  });
});
