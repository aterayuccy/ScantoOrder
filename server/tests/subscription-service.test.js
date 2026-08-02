const {
  addTaipeiCalendarMonths,
  buildSubscriptionSummary,
  createInitialSubscriptionFields,
} = require("../services/subscription-service");

describe("seller subscription rules", () => {
  test("a trial lasts three calendar months through the end of its final Taipei day", () => {
    const startedAt = new Date("2026-01-31T04:00:00.000Z");
    const fields = createInitialSubscriptionFields(startedAt);

    expect(fields.subscriptionStatus).toBe("trial");
    expect(fields.serviceExpiresAt.toISOString()).toBe(
      "2026-04-30T15:59:59.999Z"
    );
  });

  test("paid renewal keeps the calendar day where possible", () => {
    expect(
      addTaipeiCalendarMonths(
        new Date("2026-04-30T15:59:59.999Z"),
        1
      ).toISOString()
    ).toBe("2026-05-30T15:59:59.999Z");
  });

  test("the last seven days expose one hideable system reminder", () => {
    const expiresAt = new Date("2026-08-09T15:59:59.999Z");
    const summary = buildSubscriptionSummary(
      {
        subscriptionStatus: "trial",
        subscriptionStartedAt: new Date("2026-05-09T00:00:00.000Z"),
        serviceExpiresAt: expiresAt,
        subscriptionReminderHiddenForExpiry: expiresAt,
        renewalRequestStatus: "none",
      },
      new Date("2026-08-03T00:00:00.000Z")
    );

    expect(summary.inRenewalWindow).toBe(true);
    expect(summary.daysRemaining).toBe(7);
    expect(summary.reminder.hidden).toBe(true);
    expect(summary.reminder.message).toContain("剩餘 7 天");
  });
});
