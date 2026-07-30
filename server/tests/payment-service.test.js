const {
  PaymentError,
  getTaipeiDayRange,
  normalizeClientBaseUrl,
  summarizeDailyPayments,
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

describe("daily order statistics", () => {
  test("uses the Asia/Taipei calendar day", () => {
    const range = getTaipeiDayRange(new Date("2026-07-30T15:59:59.000Z"));

    expect(range.date).toBe("2026-07-30");
    expect(range.start.toISOString()).toBe("2026-07-29T16:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-07-30T16:00:00.000Z");
  });

  test("summarizes order amount, status and popular items", () => {
    const stats = summarizeDailyPayments(
      [
        {
          amount: 150,
          status: "paid",
          completedAt: new Date(),
          items: [
            { title: "紅茶", quantity: 2, lineTotal: 80 },
            { title: "蛋餅", quantity: 1, lineTotal: 70 },
          ],
        },
        {
          amount: 40,
          status: "pay_at_store",
          completedAt: null,
          items: [{ title: "紅茶", quantity: 1, lineTotal: 40 }],
        },
      ],
      "2026-07-30"
    );

    expect(stats).toMatchObject({
      date: "2026-07-30",
      orderCount: 2,
      orderAmount: 190,
      itemCount: 4,
      paidCount: 1,
      pendingStorePaymentCount: 1,
      completedCount: 1,
    });
    expect(stats.popularItems[0]).toMatchObject({
      title: "紅茶",
      quantity: 3,
      amount: 120,
    });
  });
});
