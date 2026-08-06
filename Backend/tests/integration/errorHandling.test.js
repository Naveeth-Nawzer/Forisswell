const request = require("supertest");
const app = require("../../app");

describe("Global error handling", () => {
  test("returns 404 JSON for unknown routes", async () => {
    const res = await request(app).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "Route not found",
      })
    );
  });
});

