jest.mock("../models/user-model", () => ({
  countDocuments: jest.fn(),
  find: jest.fn(),
}));

const User = require("../models/user-model");
const { listStores } = require("../services/platform-admin-service");

describe("platform administrator store list", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("returns only the safe fields needed by the administrator page", async () => {
    User.countDocuments.mockResolvedValue(2);
    const stores = [
      {
        _id: "seller-1",
        username: "第一家店",
        role: "seller",
        createdAt: new Date("2026-07-31T01:00:00.000Z"),
        subscriptionStatus: "trial",
        subscriptionStartedAt: new Date("2026-07-31T01:00:00.000Z"),
        serviceExpiresAt: new Date("2030-10-31T15:59:59.999Z"),
        renewalRequestStatus: "none",
        save: jest.fn(),
        password: "must-not-be-returned",
      },
      {
        _id: "seller-2",
        username: "第二家店",
        role: "seller",
        createdAt: new Date("2026-07-30T01:00:00.000Z"),
        subscriptionStatus: "paid",
        subscriptionStartedAt: new Date("2026-07-30T01:00:00.000Z"),
        serviceExpiresAt: new Date("2030-10-30T15:59:59.999Z"),
        renewalRequestStatus: "none",
        save: jest.fn(),
      },
    ];
    const exec = jest.fn().mockResolvedValue(stores);
    const limit = jest.fn().mockReturnValue({ exec });
    const sort = jest.fn().mockReturnValue({ limit });
    const select = jest.fn().mockReturnValue({ sort });
    User.find.mockReturnValue({ select });

    const result = await listStores();

    expect(User.countDocuments).toHaveBeenCalledWith({ role: "seller" });
    expect(User.find).toHaveBeenCalledWith({ role: "seller" });
    expect(select).toHaveBeenCalledWith(expect.stringContaining("username"));
    expect(select).toHaveBeenCalledWith(expect.stringContaining("role"));
    expect(result.total).toBe(2);
    expect(result.stores).toHaveLength(2);
    expect(result.stores[0]).toMatchObject({
      id: "seller-1",
      username: "第一家店",
      createdAt: new Date("2026-07-31T01:00:00.000Z"),
      subscription: {
        status: "trial",
        statusLabel: "測試使用中",
      },
    });
    expect(result.stores[1].subscription.status).toBe("paid");
    expect(result.stores[0]).not.toHaveProperty("password");
  });
});
