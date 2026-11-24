process.env.PASSPORT_SECRET = "test-only-passport-secret";

const request = require("supertest");

const { createApp } = require("../app");

describe("application health", () => {
  const app = createApp({ serveClient: false });

  test("GET /health reports a healthy service", async () => {
    const response = await request(app).get("/health").expect(200);

    expect(response.body.status).toBe("healthy");
    expect(response.body.uptime).toEqual(expect.any(Number));
  });

  test("unknown API routes return a structured 404", async () => {
    const response = await request(app).get("/api/unknown").expect(404);

    expect(response.body).toEqual({ message: "找不到指定的 API" });
  });

  test.each([
    ["get", "/api/admin/stores"],
    ["get", "/api/admin/subscription-settings"],
    ["patch", "/api/admin/subscription-settings"],
    ["post", "/api/admin/stores/store-1/subscription/confirm"],
    ["post", "/api/admin/stores/store-1/subscription/suspend"],
    ["get", "/api/support/admin/tickets"],
    ["patch", "/api/support/admin/tickets/ticket-1"],
    ["delete", "/api/support/admin/tickets/ticket-1"],
  ])("removed admin endpoint %s %s returns 404", async (method, path) => {
    await request(app)[method](path)
      .set("x-support-admin-key", "former-admin-key")
      .expect(404);
  });
});
