const {
  LoginAttemptService,
  MemoryAttemptStore,
} = require("../services/login-attempt-service");

describe("LoginAttemptService", () => {
  test("blocks a username and IP pair after the configured failures", async () => {
    const store = new MemoryAttemptStore();
    const service = new LoginAttemptService({
      store,
      fallbackStore: store,
      usernameLimit: 2,
      ipLimit: 10,
    });

    await service.recordFailure("127.0.0.1", "StoreOwner");
    expect(await service.isBlocked("127.0.0.1", "storeowner")).toBe(false);

    await service.recordFailure("127.0.0.1", "StoreOwner");
    expect(await service.isBlocked("127.0.0.1", "storeowner")).toBe(true);
  });

  test("successful login clears the username-specific limit", async () => {
    const store = new MemoryAttemptStore();
    const service = new LoginAttemptService({
      store,
      fallbackStore: store,
      usernameLimit: 1,
      ipLimit: 10,
    });

    await service.recordFailure("127.0.0.1", "StoreOwner");
    await service.resetUsername("127.0.0.1", "storeowner");

    expect(await service.isBlocked("127.0.0.1", "StoreOwner")).toBe(false);
  });
});
