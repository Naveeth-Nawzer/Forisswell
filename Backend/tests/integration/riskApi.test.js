jest.mock("../../services/riskAnalysisService", () => ({
  analyzeArea: jest.fn(async () => ({ mocked: true })),
}));

const request = require("supertest");
const app = require("../../app");
const Risk = require("../../models/Risk");

const registerUser = async ({ fullName, email, password, role }) => {
  const res = await request(app).post("/api/auth/register").send({
    fullName,
    email,
    password,
    role,
  });

  expect(res.status).toBe(201);
  return { token: res.body.token, user: res.body.data.user };
};

describe("Risk API", () => {
  test("requires auth for /api/risk", async () => {
    const res = await request(app).get("/api/risk");
    expect(res.status).toBe(401);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "Not authorized to access this route",
      })
    );
  });

  test("GET /api/risk returns list and /high filters critical/high", async () => {
    const user = await registerUser({
      fullName: "User",
      email: "risk-user@example.com",
      password: "Password123!",
      role: "user",
    });

    await Risk.create([
      {
        polygonId: "poly-1",
        name: "Area 1",
        coordinates: {
          type: "Polygon",
          coordinates: [
            [
              [79.8612, 6.9271],
              [79.8622, 6.9271],
              [79.8622, 6.9281],
              [79.8612, 6.9281],
              [79.8612, 6.9271],
            ],
          ],
        },
        riskLevel: "high",
        riskScore: 70,
      },
      {
        polygonId: "poly-2",
        name: "Area 2",
        coordinates: {
          type: "Polygon",
          coordinates: [
            [
              [79.8612, 6.9271],
              [79.8622, 6.9271],
              [79.8622, 6.9281],
              [79.8612, 6.9281],
              [79.8612, 6.9271],
            ],
          ],
        },
        riskLevel: "low",
        riskScore: 10,
      },
    ]);

    const listRes = await request(app)
      .get("/api/risk")
      .set("Authorization", `Bearer ${user.token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(2);

    const highRes = await request(app)
      .get("/api/risk/high")
      .set("Authorization", `Bearer ${user.token}`);
    expect(highRes.status).toBe(200);
    expect(highRes.body.data).toHaveLength(1);
    expect(highRes.body.data[0]).toEqual(
      expect.objectContaining({ polygonId: "poly-1", riskLevel: "high" })
    );
  });

  test("GET /api/risk/stats returns aggregates", async () => {
    const user = await registerUser({
      fullName: "User",
      email: "risk-stats@example.com",
      password: "Password123!",
      role: "user",
    });

    await Risk.create([
      {
        polygonId: "poly-1",
        name: "Area 1",
        coordinates: { type: "Polygon", coordinates: [[[0, 0],[1, 0],[1, 1],[0, 1],[0, 0]]] },
        riskLevel: "critical",
        riskScore: 90,
      },
      {
        polygonId: "poly-2",
        name: "Area 2",
        coordinates: { type: "Polygon", coordinates: [[[0, 0],[1, 0],[1, 1],[0, 1],[0, 0]]] },
        riskLevel: "low",
        riskScore: 10,
      },
    ]);

    const res = await request(app)
      .get("/api/risk/stats")
      .set("Authorization", `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        total: 2,
        critical: 1,
      })
    );
  });

  test("POST /api/risk/analyze enforces admin and validates polygon", async () => {
    const user = await registerUser({
      fullName: "User",
      email: "risk-analyze-user@example.com",
      password: "Password123!",
      role: "user",
    });

    const admin = await registerUser({
      fullName: "Admin",
      email: "risk-analyze-admin@example.com",
      password: "Password123!",
      role: "admin",
    });

    const polygon = {
      type: "Polygon",
      coordinates: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    };

    const nonAdminRes = await request(app)
      .post("/api/risk/analyze")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ polygon });
    expect(nonAdminRes.status).toBe(403);
    expect(nonAdminRes.body).toEqual(
      expect.objectContaining({
        success: false,
        error: "Access denied. Admins only.",
      })
    );

    const badPolygonRes = await request(app)
      .post("/api/risk/analyze")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({});
    expect(badPolygonRes.status).toBe(400);
    expect(badPolygonRes.body).toEqual(
      expect.objectContaining({
        success: false,
        error: "Polygon object is required",
      })
    );

    const okRes = await request(app)
      .post("/api/risk/analyze")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ polygon });
    expect(okRes.status).toBe(201);
    expect(okRes.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ mocked: true }),
      })
    );
  });

  test("risk CRUD/admin endpoints: get by id, update, link-event, delete", async () => {
    const user = await registerUser({
      fullName: "User",
      email: "risk-crud-user@example.com",
      password: "Password123!",
      role: "user",
    });

    const admin = await registerUser({
      fullName: "Admin",
      email: "risk-crud-admin@example.com",
      password: "Password123!",
      role: "admin",
    });

    const risk = await Risk.create({
      polygonId: "poly-crud",
      name: "CRUD Area",
      coordinates: { type: "Polygon", coordinates: [[[0, 0],[1, 0],[1, 1],[0, 1],[0, 0]]] },
      riskLevel: "medium",
      riskScore: 45,
    });

    const getRes = await request(app)
      .get(`/api/risk/${risk._id}`)
      .set("Authorization", `Bearer ${user.token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data).toEqual(
      expect.objectContaining({
        polygonId: "poly-crud",
        riskLevel: "medium",
      })
    );

    const updateForbidden = await request(app)
      .put(`/api/risk/update/${risk._id}`)
      .set("Authorization", `Bearer ${user.token}`)
      .send({ riskScore: 55 });
    expect(updateForbidden.status).toBe(403);
    expect(updateForbidden.body).toEqual(
      expect.objectContaining({
        success: false,
        error: "Access denied. Admins only.",
      })
    );

    const updateRes = await request(app)
      .put(`/api/risk/update/${risk._id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ riskScore: 55, riskLevel: "high" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data).toEqual(
      expect.objectContaining({
        riskScore: 55,
        riskLevel: "high",
      })
    );

    const linkRes = await request(app)
      .post(`/api/risk/${risk._id}/link-event`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ eventId: "event-1" });
    expect(linkRes.status).toBe(200);
    expect(linkRes.body.success).toBe(true);

    const deleteForbidden = await request(app)
      .delete(`/api/risk/${risk._id}`)
      .set("Authorization", `Bearer ${user.token}`);
    expect(deleteForbidden.status).toBe(403);

    const deleteRes = await request(app)
      .delete(`/api/risk/${risk._id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body).toEqual(
      expect.objectContaining({
        success: true,
        message: "Risk assessment deleted successfully",
      })
    );
  });
});
