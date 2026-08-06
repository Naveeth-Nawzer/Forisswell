const request = require("supertest");
const app = require("../../app");

const Alert = require("../../models/Alert");
const Tree = require("../../models/Tree");
const VolunteerProfile = require("../../models/VolunteerProfile");

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

describe("Alerts API (auth + role checks)", () => {
  test("requires auth", async () => {
    const res = await request(app).get("/api/alerts");
    expect(res.status).toBe(401);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "Not authorized to access this route",
      })
    );
  });

  test("enforces volunteer/admin roles on volunteer routes", async () => {
    const user = await registerUser({
      fullName: "User",
      email: "alerts-user@example.com",
      password: "Password123!",
      role: "user",
    });

    const res = await request(app)
      .get("/api/alerts/nearby")
      .set("Authorization", `Bearer ${user.token}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "User role 'user' is not authorized to access this route",
      })
    );
  });

  test("volunteer nearby requires a volunteer profile", async () => {
    const volunteer = await registerUser({
      fullName: "Volunteer",
      email: "alerts-vol@example.com",
      password: "Password123!",
      role: "volunteer",
    });

    const res = await request(app)
      .get("/api/alerts/nearby")
      .set("Authorization", `Bearer ${volunteer.token}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "Please complete your volunteer profile first",
      })
    );
  });

  test("admin can access admin list route", async () => {
    const admin = await registerUser({
      fullName: "Admin",
      email: "alerts-admin@example.com",
      password: "Password123!",
      role: "admin",
    });

    const res = await request(app)
      .get("/api/alerts")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        message: "Alerts fetched successfully",
        count: 0,
      })
    );
  });

  test("covers volunteer alert flow endpoints", async () => {
    const admin = await registerUser({
      fullName: "Admin",
      email: "alerts-admin-2@example.com",
      password: "Password123!",
      role: "admin",
    });

    const owner = await registerUser({
      fullName: "Owner",
      email: "alerts-owner@example.com",
      password: "Password123!",
      role: "user",
    });

    const volunteer = await registerUser({
      fullName: "Volunteer",
      email: "alerts-vol-2@example.com",
      password: "Password123!",
      role: "volunteer",
    });

    const profile = await VolunteerProfile.create({
      user: volunteer.user._id,
      phone: "+94 77 123 4567",
      skills: ["watering"],
      location: { type: "Point", coordinates: [79.8612, 6.9271] },
      preferredRadius: 5,
      status: "available",
      isAvailable: true,
      isActive: true,
    });

    const tree = await Tree.create({
      name: "Alert Tree",
      species: "Neem",
      plantedDate: new Date(Date.now() - 60_000),
      location: { type: "Point", coordinates: [79.8612, 6.9271] },
      owner: owner.user._id,
      isActive: true,
    });

    const pendingAlert = await Alert.create({
      tree: tree._id,
      type: "high_temperature",
      priority: "high",
      status: "pending",
      description: "Test alert description",
      location: { type: "Point", coordinates: [79.8612, 6.9271] },
      isActive: true,
    });

    const nearbyRes = await request(app)
      .get("/api/alerts/nearby")
      .set("Authorization", `Bearer ${volunteer.token}`);
    expect(nearbyRes.status).toBe(200);
    expect(nearbyRes.body.count).toBe(1);

    const declineRes = await request(app)
      .post(`/api/alerts/${pendingAlert._id}/decline`)
      .set("Authorization", `Bearer ${volunteer.token}`);
    expect(declineRes.status).toBe(200);
    expect(declineRes.body.success).toBe(true);

    const myActiveNone = await request(app)
      .get("/api/alerts/my-active")
      .set("Authorization", `Bearer ${volunteer.token}`);
    expect(myActiveNone.status).toBe(200);
    expect(myActiveNone.body.data.alert).toBeNull();

    const acceptRes = await request(app)
      .post(`/api/alerts/${pendingAlert._id}/accept`)
      .set("Authorization", `Bearer ${volunteer.token}`);
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.alert.status).toBe("assigned");

    const myAlerts = await request(app)
      .get("/api/alerts/my-alerts")
      .set("Authorization", `Bearer ${volunteer.token}`);
    expect(myAlerts.status).toBe(200);
    expect(myAlerts.body.count).toBe(1);

    const myActiveAssigned = await request(app)
      .get("/api/alerts/my-active")
      .set("Authorization", `Bearer ${volunteer.token}`);
    expect(myActiveAssigned.status).toBe(200);
    expect(myActiveAssigned.body.data.alert.status).toBe("assigned");

    const startRes = await request(app)
      .post(`/api/alerts/${pendingAlert._id}/start`)
      .set("Authorization", `Bearer ${volunteer.token}`);
    expect(startRes.status).toBe(200);
    expect(startRes.body.data.alert.status).toBe("in_progress");

    const completeBad = await request(app)
      .post(`/api/alerts/${pendingAlert._id}/complete`)
      .set("Authorization", `Bearer ${volunteer.token}`)
      .send({ notes: "short" });
    expect(completeBad.status).toBe(400);
    expect(completeBad.body.message).toBe(
      "Please provide detailed notes (min 10 characters)"
    );

    const completeOk = await request(app)
      .post(`/api/alerts/${pendingAlert._id}/complete`)
      .set("Authorization", `Bearer ${volunteer.token}`)
      .send({ notes: "Completed successfully." });
    expect(completeOk.status).toBe(200);
    expect(completeOk.body.success).toBe(true);

    const myActiveAfterComplete = await request(app)
      .get("/api/alerts/my-active")
      .set("Authorization", `Bearer ${volunteer.token}`);
    expect(myActiveAfterComplete.status).toBe(200);
    expect(myActiveAfterComplete.body.data.alert).toBeNull();

    const getById = await request(app)
      .get(`/api/alerts/${pendingAlert._id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(getById.status).toBe(200);
    expect(getById.body.data.alert._id).toBe(pendingAlert._id.toString());

    const treeAlerts = await request(app)
      .get(`/api/alerts/tree/${tree._id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(treeAlerts.status).toBe(200);
    expect(treeAlerts.body.count).toBe(1);

    const statsRes = await request(app)
      .get("/api/alerts/statistics")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.success).toBe(true);

    const leaderboardRes = await request(app)
      .get("/api/alerts/leaderboard")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(leaderboardRes.status).toBe(200);
    expect(leaderboardRes.body.data.leaderboard.length).toBeGreaterThanOrEqual(1);

    const mapRes = await request(app)
      .get("/api/alerts/map")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(mapRes.status).toBe(200);
    expect(mapRes.body.count).toBe(1);

    const debugStatus = await request(app)
      .get("/api/alerts/debug/status")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(debugStatus.status).toBe(200);
    expect(debugStatus.body.success).toBe(true);

    const debugCheck = await request(app)
      .post("/api/alerts/debug/check-weather")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(debugCheck.status).toBe(200);
    expect(debugCheck.body.success).toBe(true);

    const seedRes = await request(app)
      .post("/api/alerts/seed")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(seedRes.status).toBe(500);
    expect(seedRes.body.message).toBe(
      "Seeding is only allowed in development mode"
    );

    // cancel endpoint coverage: create a new pending alert, accept it, then cancel
    const cancellable = await Alert.create({
      tree: tree._id,
      type: "heavy_rain",
      priority: "medium",
      status: "pending",
      description: "Cancellable alert",
      location: { type: "Point", coordinates: [79.8612, 6.9271] },
      isActive: true,
    });

    // Ensure volunteer can accept again
    const refreshedProfile = await VolunteerProfile.findById(profile._id);
    refreshedProfile.status = "available";
    refreshedProfile.isAvailable = true;
    await refreshedProfile.save();

    const accept2 = await request(app)
      .post(`/api/alerts/${cancellable._id}/accept`)
      .set("Authorization", `Bearer ${volunteer.token}`);
    expect(accept2.status).toBe(200);

    const cancelRes = await request(app)
      .post(`/api/alerts/${cancellable._id}/cancel`)
      .set("Authorization", `Bearer ${volunteer.token}`)
      .send({ reason: "Cannot proceed" });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.success).toBe(true);
  });
});
