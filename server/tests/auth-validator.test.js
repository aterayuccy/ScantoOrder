const {
  loginSchema,
  qrLoginSchema,
  registerSchema,
} = require("../validators/auth-validator");

describe("authentication validators", () => {
  test("accepts a valid seller registration", () => {
    const result = registerSchema.validate({
      username: "fresh_graduate",
      password: "Portfolio123",
      role: "seller",
    });

    expect(result.error).toBeUndefined();
  });

  test("rejects a password without both letters and numbers", () => {
    const result = registerSchema.validate({
      username: "fresh_graduate",
      password: "onlyletters",
      role: "seller",
    });

    expect(result.error).toBeDefined();
  });

  test("login accepts existing passwords without applying new policy again", () => {
    const result = loginSchema.validate({
      username: "legacy_user",
      password: "legacy-password",
    });

    expect(result.error).toBeUndefined();
  });

  test("QR login accepts a client session identifier", () => {
    const result = qrLoginSchema.validate({
      qrToken: "a".repeat(64),
      clientSessionId: "device_session_1234567890",
    });

    expect(result.error).toBeUndefined();
  });
});
