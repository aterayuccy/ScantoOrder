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
});
