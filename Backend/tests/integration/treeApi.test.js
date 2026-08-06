jest.mock("../../services/reverseGeocodingService", () => ({
  reverseGeocode: jest.fn(async () => null),
}));

const request = require("supertest");
const app = require("../../app");

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

describe("Trees API (CRUD)", () => {
  test("requires auth for /api/trees", async () => {
    const res = await request(app).get("/api/trees");
    expect(res.status).toBe(401);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "Not authorized to access this route",
      })
    );
  });

  test("POST/GET/PUT/DELETE /api/trees works for owner and enforces 403 for others", async () => {
    const user1 = await registerUser({
      fullName: "Owner",
      email: "owner@example.com",
      password: "Password123!",
      role: "user",
    });

    const user2 = await registerUser({
      fullName: "Other",
      email: "other@example.com",
      password: "Password123!",
      role: "user",
    });

    const plantedDate = new Date(Date.now() - 60_000).toISOString();

    const createRes = await request(app)
      .post("/api/trees")
      .set("Authorization", `Bearer ${user1.token}`)
      .send({
        name: "Test Tree",
        species: "Neem",
        plantedDate,
        location: { coordinates: [79.8612, 6.9271] },
      });

    expect(createRes.status).toBe(201);
    const treeId = createRes.body?.data?.tree?._id;
    expect(treeId).toEqual(expect.any(String));

    const listRes = await request(app)
      .get("/api/trees")
      .set("Authorization", `Bearer ${user1.token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.count).toBe(1);

    const getForbidden = await request(app)
      .get(`/api/trees/${treeId}`)
      .set("Authorization", `Bearer ${user2.token}`);
    expect(getForbidden.status).toBe(403);
    expect(getForbidden.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "Not authorized to access this tree",
      })
    );

    const updateForbidden = await request(app)
      .put(`/api/trees/${treeId}`)
      .set("Authorization", `Bearer ${user2.token}`)
      .send({ status: "MATURE" });
    expect(updateForbidden.status).toBe(403);

    const updateRes = await request(app)
      .put(`/api/trees/${treeId}`)
      .set("Authorization", `Bearer ${user1.token}`)
      .send({ status: "MATURE" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.tree.status).toBe("MATURE");

    const deleteForbidden = await request(app)
      .delete(`/api/trees/${treeId}`)
      .set("Authorization", `Bearer ${user2.token}`);
    expect(deleteForbidden.status).toBe(403);

    const deleteRes = await request(app)
      .delete(`/api/trees/${treeId}`)
      .set("Authorization", `Bearer ${user1.token}`);
    expect(deleteRes.status).toBe(200);

    const getAfterDelete = await request(app)
      .get(`/api/trees/${treeId}`)
      .set("Authorization", `Bearer ${user1.token}`);
    expect(getAfterDelete.status).toBe(404);
  });

  test("GET /api/trees/all returns all active trees (any authenticated user)", async () => {
    const user1 = await registerUser({
      fullName: "User1",
      email: "user1@example.com",
      password: "Password123!",
      role: "user",
    });

    const user2 = await registerUser({
      fullName: "User2",
      email: "user2@example.com",
      password: "Password123!",
      role: "user",
    });

    const plantedDate = new Date(Date.now() - 60_000).toISOString();

    await request(app)
      .post("/api/trees")
      .set("Authorization", `Bearer ${user1.token}`)
      .send({
        species: "Mango",
        plantedDate,
        location: { coordinates: [79.86, 6.92] },
      });

    await request(app)
      .post("/api/trees")
      .set("Authorization", `Bearer ${user2.token}`)
      .send({
        species: "Jackfruit",
        plantedDate,
        location: { coordinates: [79.87, 6.93] },
      });

    const res = await request(app)
      .get("/api/trees/all")
      .set("Authorization", `Bearer ${user1.token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.data.trees).toHaveLength(2);
  });

  test("GET /api/trees/nearby validates query params and returns nearby trees", async () => {
    const user = await registerUser({
      fullName: "Nearby User",
      email: "nearby@example.com",
      password: "Password123!",
      role: "user",
    });

    const missingRes = await request(app)
      .get("/api/trees/nearby")
      .set("Authorization", `Bearer ${user.token}`);
    expect(missingRes.status).toBe(400);

    const rangeRes = await request(app)
      .get("/api/trees/nearby?lon=200&lat=0&radiusKm=5")
      .set("Authorization", `Bearer ${user.token}`);
    expect(rangeRes.status).toBe(400);

    const plantedDate = new Date(Date.now() - 60_000).toISOString();

    await request(app)
      .post("/api/trees")
      .set("Authorization", `Bearer ${user.token}`)
      .send({
        species: "NearTree",
        plantedDate,
        location: { coordinates: [79.8612, 6.9271] },
      });

    await request(app)
      .post("/api/trees")
      .set("Authorization", `Bearer ${user.token}`)
      .send({
        species: "FarTree",
        plantedDate,
        location: { coordinates: [80.8612, 6.9271] },
      });

    const nearbyRes = await request(app)
      .get("/api/trees/nearby?lon=79.8612&lat=6.9271&radiusKm=5")
      .set("Authorization", `Bearer ${user.token}`);

    expect(nearbyRes.status).toBe(200);
    expect(nearbyRes.body.data.center).toEqual(
      expect.objectContaining({ lon: 79.8612, lat: 6.9271 })
    );
    expect(nearbyRes.body.data.trees).toHaveLength(1);
    expect(nearbyRes.body.data.trees[0]).toEqual(
      expect.objectContaining({ species: "NearTree" })
    );
  });
});
