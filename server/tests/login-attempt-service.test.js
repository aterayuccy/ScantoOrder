const {
  LoginAttemptStoreError,
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

  test("does not expose the username or IP address in store keys", () => {
    const store = new MemoryAttemptStore();
    const service = new LoginAttemptService({
      store,
      fallbackStore: store,
    });

    const keys = service.getKeys("203.0.113.7", "StoreOwner");

    expect(keys.usernameKey).not.toContain("StoreOwner");
    expect(keys.usernameKey).not.toContain("203.0.113.7");
    expect(keys.ipKey).not.toContain("203.0.113.7");
  });

  test("memory counters expire after their TTL", async () => {
    const store = new MemoryAttemptStore();
    const now = jest.spyOn(Date, "now");
    now.mockReturnValue(1000);

    await store.increment("key", 500);
    expect(await store.get("key")).toBe(1);

    now.mockReturnValue(1501);
    expect(await store.get("key")).toBe(0);
    now.mockRestore();
  });

  test("falls back to memory when Redis is unavailable by default", async () => {
    const unavailableStore = {
      get: jest.fn().mockRejectedValue(new Error("offline")),
    };
    const fallbackStore = new MemoryAttemptStore();
    const service = new LoginAttemptService({
      store: unavailableStore,
      fallbackStore,
    });

    expect(await service.isBlocked("127.0.0.1", "StoreOwner")).toBe(false);
    expect(service.usingFallback).toBe(true);
  });

  test("can reject logins when Redis is required but unavailable", async () => {
    const unavailableStore = {
      get: jest.fn().mockRejectedValue(new Error("offline")),
    };
    const service = new LoginAttemptService({
      store: unavailableStore,
      failureMode: "reject",
    });

    await expect(
      service.isBlocked("127.0.0.1", "StoreOwner")
    ).rejects.toBeInstanceOf(LoginAttemptStoreError);
  });
});
