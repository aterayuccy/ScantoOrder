const crypto = require("crypto");

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_USERNAME_LIMIT = 5;
const DEFAULT_IP_LIMIT = 25;

const hashKey = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

class MemoryAttemptStore {
  constructor({ maximumEntries = 6000 } = {}) {
    this.maximumEntries = maximumEntries;
    this.attempts = new Map();
  }

  async get(key) {
    const attempt = this.attempts.get(key);
    if (!attempt) return 0;

    if (attempt.expiresAt <= Date.now()) {
      this.attempts.delete(key);
      return 0;
    }

    return attempt.count;
  }

  async increment(key, windowMs) {
    const count = await this.get(key);
    const existing = this.attempts.get(key);

    if (!existing && this.attempts.size >= this.maximumEntries) {
      const oldestKey = this.attempts.keys().next().value;
      this.attempts.delete(oldestKey);
    }

    this.attempts.set(key, {
      count: count + 1,
      expiresAt: existing?.expiresAt || Date.now() + windowMs,
    });

    return count + 1;
  }

  async remove(key) {
    this.attempts.delete(key);
  }
}

class RedisAttemptStore {
  constructor(redisUrl) {
    this.redisUrl = redisUrl;
    this.client = null;
    this.connectPromise = null;
  }

  async getClient() {
    if (this.client?.isReady) return this.client;
    if (this.connectPromise) return this.connectPromise;

    const { createClient } = require("redis");
    this.client = createClient({ url: this.redisUrl });
    this.client.on("error", (error) => {
      console.error("Redis login limiter error:", error.message);
    });
    this.connectPromise = this.client.connect().then(() => this.client);

    try {
      return await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  async get(key) {
    const client = await this.getClient();
    return Number((await client.get(key)) || 0);
  }

  async increment(key, windowMs) {
    const client = await this.getClient();
    return Number(
      await client.eval(
        [
          "local count = redis.call('INCR', KEYS[1])",
          "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
          "return count",
        ].join("\n"),
        {
          keys: [key],
          arguments: [String(windowMs)],
        }
      )
    );
  }

  async remove(key) {
    const client = await this.getClient();
    await client.del(key);
  }
}

class LoginAttemptService {
  constructor({
    store,
    fallbackStore = new MemoryAttemptStore(),
    windowMs = DEFAULT_WINDOW_MS,
    usernameLimit = DEFAULT_USERNAME_LIMIT,
    ipLimit = DEFAULT_IP_LIMIT,
  } = {}) {
    this.store = store || fallbackStore;
    this.fallbackStore = fallbackStore;
    this.windowMs = windowMs;
    this.usernameLimit = usernameLimit;
    this.ipLimit = ipLimit;
    this.usingFallback = !store;
  }

  getKeys(ipAddress, username) {
    return {
      usernameKey: `auth:login:username:${hashKey(
        `${ipAddress}:${String(username).toLowerCase()}`
      )}`,
      ipKey: `auth:login:ip:${hashKey(ipAddress)}`,
    };
  }

  async runWithFallback(operation) {
    try {
      return await operation(this.store);
    } catch (error) {
      if (this.store === this.fallbackStore) throw error;
      console.error(
        "Redis unavailable; login limiter is using local memory:",
        error.message
      );
      this.store = this.fallbackStore;
      this.usingFallback = true;
      return operation(this.store);
    }
  }

  async isBlocked(ipAddress, username) {
    const { usernameKey, ipKey } = this.getKeys(ipAddress, username);
    return this.runWithFallback(async (store) => {
      const [usernameAttempts, ipAttempts] = await Promise.all([
        store.get(usernameKey),
        store.get(ipKey),
      ]);
      return (
        usernameAttempts >= this.usernameLimit || ipAttempts >= this.ipLimit
      );
    });
  }

  async recordFailure(ipAddress, username) {
    const { usernameKey, ipKey } = this.getKeys(ipAddress, username);
    return this.runWithFallback((store) =>
      Promise.all([
        store.increment(usernameKey, this.windowMs),
        store.increment(ipKey, this.windowMs),
      ])
    );
  }

  async resetUsername(ipAddress, username) {
    const { usernameKey } = this.getKeys(ipAddress, username);
    return this.runWithFallback((store) => store.remove(usernameKey));
  }
}

const buildLoginAttemptService = (environment = process.env) => {
  const redisUrl = String(environment.REDIS_URL || "").trim();
  const fallbackStore = new MemoryAttemptStore();
  const store = redisUrl ? new RedisAttemptStore(redisUrl) : fallbackStore;

  return new LoginAttemptService({
    store,
    fallbackStore,
    windowMs: Number(environment.LOGIN_ATTEMPT_WINDOW_MS) || DEFAULT_WINDOW_MS,
    usernameLimit:
      Number(environment.LOGIN_ATTEMPT_LIMIT) || DEFAULT_USERNAME_LIMIT,
    ipLimit: Number(environment.IP_LOGIN_ATTEMPT_LIMIT) || DEFAULT_IP_LIMIT,
  });
};

module.exports = {
  LoginAttemptService,
  MemoryAttemptStore,
  RedisAttemptStore,
  buildLoginAttemptService,
};
