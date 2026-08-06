jest.mock("../../services/reverseGeocodingService", () => ({
  reverseGeocode: jest.fn(async () => ({ formatted: "Mock Address" })),
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

describe("Volunteer API", () => {
  test("denies access for non-volunteer roles", async () => {
    const user = await registerUser({
      fullName: "Normal User",
      email: "normal@example.com",
      password: "Password123!",
      role: "user",
    });

    const res = await request(app)
      .get("/api/volunteers/profile")
      .set("Authorization", `Bearer ${user.token}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "User role 'user' is not authorized to access this route",
      })
    );
  });

  test("profile lifecycle: create -> get -> update + status validation", async () => {
    const volunteer = await registerUser({
      fullName: "Volunteer",
      email: "vol@example.com",
      password: "Password123!",
      role: "volunteer",
    });

    const createRes = await request(app)
      .post("/api/volunteers/profile")
      .set("Authorization", `Bearer ${volunteer.token}`)
      .send({
        phone: "+94 77 123 4567",
        skills: ["watering"],
        location: { coordinates: [79.8612, 6.9271] },
        preferredRadius: 5,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.profile).toEqual(
      expect.objectContaining({
        phone: "+94 77 123 4567",
        status: "available",
      })
    );

    const getRes = await request(app)
      .get("/api/volunteers/profile")
      .set("Authorization", `Bearer ${volunteer.token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.profile.phone).toBe("+94 77 123 4567");

    const updateRes = await request(app)
      .put("/api/volunteers/profile")
      .set("Authorization", `Bearer ${volunteer.token}`)
      .send({ phone: "+94 77 000 0000" });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.profile.phone).toBe("+94 77 000 0000");

    const badStatusRes = await request(app)
      .patch("/api/volunteers/status")
      .set("Authorization", `Bearer ${volunteer.token}`)
      .send({ status: "INVALID" });

    expect(badStatusRes.status).toBe(400);
    expect(badStatusRes.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "Invalid status value",
      })
    );

    const statusOk = await request(app)
      .patch("/api/volunteers/status")
      .set("Authorization", `Bearer ${volunteer.token}`)
      .send({ status: "busy", isAvailable: false });
    expect(statusOk.status).toBe(200);
    expect(statusOk.body.data).toEqual(
      expect.objectContaining({
        status: "busy",
        isAvailable: false,
      })
    );

    const locationBad = await request(app)
      .patch("/api/volunteers/location")
      .set("Authorization", `Bearer ${volunteer.token}`)
      .send({ coordinates: [1] });
    expect(locationBad.status).toBe(400);

    const locationOk = await request(app)
      .patch("/api/volunteers/location")
      .set("Authorization", `Bearer ${volunteer.token}`)
      .send({ coordinates: [79.8612, 6.9271] });
    expect(locationOk.status).toBe(200);
    expect(locationOk.body.data.location.coordinates).toEqual([79.8612, 6.9271]);

    const statsRes = await request(app)
      .get("/api/volunteers/stats")
      .set("Authorization", `Bearer ${volunteer.token}`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.stats).toEqual(
      expect.objectContaining({
        totalAlerts: expect.any(Number),
        acceptedAlerts: expect.any(Number),
        completedAlerts: expect.any(Number),
      })
    );
  });
});
