const {
  buildGuestSessionKey,
  getGuestTtlMs,
} = require("../services/qr-guest-service");

describe("QR guest sessions", () => {
  test("the same QR and browser session produce the same private key", () => {
    const first = buildGuestSessionKey(
      "a".repeat(64),
      "device_session_1234567890"
    );
    const second = buildGuestSessionKey(
      "a".repeat(64),
      "device_session_1234567890"
    );

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  test("different browser sessions do not share a guest account", () => {
    const first = buildGuestSessionKey("a".repeat(64), "device_session_one");
    const second = buildGuestSessionKey("a".repeat(64), "device_session_two");

    expect(first).not.toBe(second);
  });

  test("guest lifetime is configurable and capped at seven days", () => {
    expect(getGuestTtlMs({ QR_GUEST_TTL_HOURS: "12" })).toBe(
      12 * 60 * 60 * 1000
    );
    expect(getGuestTtlMs({ QR_GUEST_TTL_HOURS: "999" })).toBe(
      168 * 60 * 60 * 1000
    );
  });
});
