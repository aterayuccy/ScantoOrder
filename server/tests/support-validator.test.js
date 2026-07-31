const supportAdminOnly = require("../middlewares/support-admin");
const {
  createSupportTicketSchema,
  updateSupportTicketSchema,
} = require("../validators/support-validator");

describe("support validators", () => {
  test("accepts a store support request", () => {
    const result = createSupportTicketSchema.validate({
      category: "operation",
      message: "我不知道如何暫停接單，請提供操作方式。",
      pagePath: "/profile",
    });

    expect(result.error).toBeUndefined();
  });

  test("rejects a message that is too short", () => {
    const result = createSupportTicketSchema.validate({
      category: "technical",
      message: "壞了",
      pagePath: "/order",
    });

    expect(result.error).toBeDefined();
  });

  test("accepts an administrator reply and status update", () => {
    const result = updateSupportTicketSchema.validate({
      adminReply: "請重新整理頁面後再試一次。",
      status: "answered",
    });

    expect(result.error).toBeUndefined();
  });
});

describe("support administrator authentication", () => {
  const originalKey = process.env.SUPPORT_ADMIN_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.SUPPORT_ADMIN_KEY;
    } else {
      process.env.SUPPORT_ADMIN_KEY = originalKey;
    }
  });

  const createResponse = () => {
    const response = {
      status: jest.fn(),
      send: jest.fn(),
    };
    response.status.mockReturnValue(response);
    return response;
  };

  test("allows the configured support administrator key", () => {
    process.env.SUPPORT_ADMIN_KEY = "test-support-admin-key-123456";
    const request = {
      get: jest.fn().mockReturnValue("test-support-admin-key-123456"),
    };
    const response = createResponse();
    const next = jest.fn();

    supportAdminOnly(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  test("rejects an incorrect support administrator key", () => {
    process.env.SUPPORT_ADMIN_KEY = "test-support-admin-key-123456";
    const request = {
      get: jest.fn().mockReturnValue("wrong-key"),
    };
    const response = createResponse();
    const next = jest.fn();

    supportAdminOnly(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
