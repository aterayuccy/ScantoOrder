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
    const lean = jest.fn().mockResolvedValue([
      {
        _id: "seller-1",
        username: "第一家店",
        createdAt: new Date("2026-07-31T01:00:00.000Z"),
        password: "must-not-be-returned",
      },
      {
        _id: "seller-2",
        username: "第二家店",
        createdAt: new Date("2026-07-30T01:00:00.000Z"),
      },
    ]);
    const limit = jest.fn().mockReturnValue({ lean });
    const sort = jest.fn().mockReturnValue({ limit });
    const select = jest.fn().mockReturnValue({ sort });
    User.find.mockReturnValue({ select });

    const result = await listStores();

    expect(User.countDocuments).toHaveBeenCalledWith({ role: "seller" });
    expect(User.find).toHaveBeenCalledWith({ role: "seller" });
    expect(select).toHaveBeenCalledWith("_id username createdAt");
    expect(result).toEqual({
      total: 2,
      stores: [
        {
          id: "seller-1",
          username: "第一家店",
          createdAt: new Date("2026-07-31T01:00:00.000Z"),
        },
        {
          id: "seller-2",
          username: "第二家店",
          createdAt: new Date("2026-07-30T01:00:00.000Z"),
        },
      ],
    });
    expect(result.stores[0]).not.toHaveProperty("password");
  });
});
