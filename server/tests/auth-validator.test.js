const {
  changePasswordSchema,
  loginSchema,
  qrCodeCountSchema,
  qrLoginSchema,
  registerSchema,
  resetPasswordSchema,
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

  test("accepts a Chinese username", () => {
    const result = registerSchema.validate({
      username: "巷口早餐店",
      password: "Portfolio123",
      role: "seller",
    });

    expect(result.error).toBeUndefined();
    expect(result.value.username).toBe("巷口早餐店");
  });

  test("normalizes full-width username characters", () => {
    const result = registerSchema.validate({
      username: "ＡＢＣ商店",
      password: "Portfolio123",
      role: "seller",
    });

    expect(result.error).toBeUndefined();
    expect(result.value.username).toBe("ABC商店");
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

  test("QR creation keeps supporting sequential count requests", () => {
    const result = qrCodeCountSchema.validate({ count: 2 });

    expect(result.error).toBeUndefined();
    expect(result.value).toEqual({ mode: "sequential", count: 2 });
  });

  test("QR creation accepts an exact table number", () => {
    const result = qrCodeCountSchema.validate({
      mode: "specific",
      tableNumber: 3,
    });

    expect(result.error).toBeUndefined();
    expect(result.value).toEqual({ mode: "specific", tableNumber: 3 });
  });

  test("QR creation rejects an existing mode without its required value", () => {
    const result = qrCodeCountSchema.validate({ mode: "specific" });

    expect(result.error).toBeDefined();
  });

  test("accepts password change with the existing and new password", () => {
    const result = changePasswordSchema.validate({
      currentPassword: "OldPassword123",
      newPassword: "NewPassword456",
    });

    expect(result.error).toBeUndefined();
  });

  test("accepts a recovery code password reset", () => {
    const result = resetPasswordSchema.validate({
      username: "巷口早餐店",
      recoveryCode: "A1".repeat(12),
      newPassword: "NewPassword456",
    });

    expect(result.error).toBeUndefined();
  });
});
