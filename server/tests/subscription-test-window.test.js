jest.mock("../models/user-model", () => ({
  findOne: jest.fn(),
}));

const User = require("../models/user-model");
const {
  restoreRenewalTestWindow,
  setRenewalTestWindow,
} = require("../services/subscription-service");

describe("subscription renewal test window", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("restores the exact expiry and status saved before testing", async () => {
    const originalExpiry = new Date("2026-10-31T15:59:59.999Z");
    const seller = {
      _id: "seller-1",
      role: "seller",
      subscriptionStatus: "paid",
      subscriptionStartedAt: new Date("2026-04-30T01:00:00.000Z"),
      serviceExpiresAt: originalExpiry,
      renewalRequestStatus: "none",
      save: jest.fn(),
    };
    User.findOne.mockResolvedValue(seller);

    await setRenewalTestWindow({
      sellerId: seller._id,
      now: new Date("2026-08-02T09:00:00.000Z"),
    });
    await setRenewalTestWindow({
      sellerId: seller._id,
      now: new Date("2026-08-03T09:00:00.000Z"),
    });
    const restored = await restoreRenewalTestWindow({
      sellerId: seller._id,
      now: new Date("2026-08-03T09:00:00.000Z"),
    });

    expect(seller.serviceExpiresAt).toEqual(originalExpiry);
    expect(seller.subscriptionStatus).toBe("paid");
    expect(seller.subscriptionTestOriginalExpiresAt).toBeNull();
    expect(seller.subscriptionTestOriginalStatus).toBeNull();
    expect(restored.testWindowActive).toBe(false);
  });

  test("can restore a trial moved into the test window before backups existed", async () => {
    const seller = {
      _id: "seller-2",
      role: "seller",
      subscriptionStatus: "trial",
      subscriptionStartedAt: new Date("2026-07-01T01:00:00.000Z"),
      serviceExpiresAt: new Date("2026-08-09T09:00:00.000Z"),
      renewalRequestStatus: "none",
      save: jest.fn(),
    };
    User.findOne.mockResolvedValue(seller);

    const restored = await restoreRenewalTestWindow({
      sellerId: seller._id,
      now: new Date("2026-08-02T09:00:00.000Z"),
    });

    expect(seller.serviceExpiresAt.toISOString()).toBe(
      "2026-10-01T15:59:59.999Z"
    );
    expect(restored.testWindowActive).toBe(false);
  });
});
