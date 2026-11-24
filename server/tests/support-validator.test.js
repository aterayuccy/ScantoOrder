const {
  createSupportTicketSchema,
  sellerSupportFeedbackSchema,
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

  test("accepts resolved or unresolved seller feedback", () => {
    expect(
      sellerSupportFeedbackSchema.validate({ feedback: "resolved" }).error
    ).toBeUndefined();
    expect(
      sellerSupportFeedbackSchema.validate({ feedback: "unresolved" }).error
    ).toBeUndefined();
  });

  test("rejects an unknown seller feedback value", () => {
    const result = sellerSupportFeedbackSchema.validate({
      feedback: "maybe",
    });

    expect(result.error).toBeDefined();
  });
});
