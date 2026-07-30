const {
  PaymentError,
  normalizeClientBaseUrl,
} = require("../services/payment-service");

describe("payment callback URL validation", () => {
  test("allows local HTTP only during development", () => {
    expect(
      normalizeClientBaseUrl("http://localhost:3000/path", {
        NODE_ENV: "development",
      })
    ).toBe("http://localhost:3000");
  });

  test("requires HTTPS in production", () => {
    expect(() =>
      normalizeClientBaseUrl("http://example.com", {
        NODE_ENV: "production",
      })
    ).toThrow(PaymentError);
  });

  test("prefers the configured client URL over the request origin", () => {
    expect(
      normalizeClientBaseUrl("https://attacker.example", {
        CLIENT_BASE_URL: "https://scan-to-order.example/app",
        NODE_ENV: "production",
      })
    ).toBe("https://scan-to-order.example");
  });
});
