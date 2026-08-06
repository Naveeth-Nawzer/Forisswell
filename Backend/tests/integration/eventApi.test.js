jest.mock("../../services/notificationService", () => ({
  scheduleEventReminders: jest.fn(async () => undefined),
  sendJoinConfirmation: jest.fn(async () => undefined),
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

describe("Events API", () => {
  test("GET /api/events is public", async () => {
    const res = await request(app).get("/api/events");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.any(Array),
        pagination: expect.any(Object),
      })
    );
  });

  test("admin can create/update/delete; users can join/leave; participants access is restricted", async () => {
    const admin = await registerUser({
      fullName: "Admin",
      email: "events-admin@example.com",
      password: "Password123!",
      role: "admin",
    });

    const user = await registerUser({
      fullName: "User",
      email: "events-user@example.com",
      password: "Password123!",
      role: "user",
    });

    const createForbidden = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${user.token}`)
      .send({
        title: "Community Workshop",
        description: "Learn tree care basics",
        eventType: "workshop",
        startDate: new Date(Date.now() - 60_000).toISOString(),
        endDate: new Date(Date.now() - 30_000).toISOString(),
      });

    expect(createForbidden.status).toBe(403);
    expect(createForbidden.body).toEqual(
      expect.objectContaining({
        success: false,
        error: "Access denied. Admins only.",
      })
    );

    const createRes = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        title: "Community Workshop",
        description: "Learn tree care basics",
        eventType: "workshop",
        startDate: new Date(Date.now() - 60_000).toISOString(),
        endDate: new Date(Date.now() - 30_000).toISOString(),
        maxParticipants: 1,
        reminders: false,
      });

    expect(createRes.status).toBe(201);
    const eventId = createRes.body?.data?._id;
    expect(eventId).toEqual(expect.any(String));

    const participantsForbidden = await request(app)
      .get(`/api/events/${eventId}/participants`)
      .set("Authorization", `Bearer ${user.token}`);
    expect(participantsForbidden.status).toBe(403);
    expect(participantsForbidden.body).toEqual(
      expect.objectContaining({
        success: false,
        error: "Only event organizers and admins can view participants",
      })
    );

    const joinRes = await request(app)
      .post(`/api/events/${eventId}/join`)
      .set("Authorization", `Bearer ${user.token}`);
    expect(joinRes.status).toBe(200);
    expect(joinRes.body.success).toBe(true);
    expect(joinRes.body.data).toEqual(
      expect.objectContaining({
        participationStatus: "waitlist",
      })
    );

    const participantsOk = await request(app)
      .get(`/api/events/${eventId}/participants`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(participantsOk.status).toBe(200);
    expect(participantsOk.body.success).toBe(true);
    expect(participantsOk.body.data.total).toBe(2);

    const leaveRes = await request(app)
      .post(`/api/events/${eventId}/leave`)
      .set("Authorization", `Bearer ${user.token}`);
    expect(leaveRes.status).toBe(200);
    expect(leaveRes.body).toEqual(
      expect.objectContaining({
        success: true,
        message: "Successfully left the event",
      })
    );

    const updateRes = await request(app)
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Updated Title" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.title).toBe("Updated Title");

    const deleteRes = await request(app)
      .delete(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
  });

  test("other event endpoints: get by id, user/created, user/joined, search validation", async () => {
    const admin = await registerUser({
      fullName: "Admin",
      email: "events-admin-2@example.com",
      password: "Password123!",
      role: "admin",
    });

    const user = await registerUser({
      fullName: "User",
      email: "events-user-2@example.com",
      password: "Password123!",
      role: "user",
    });

    const createRes = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        title: "Tree Planting",
        description: "Planting event",
        eventType: "tree_planting",
        startDate: new Date(Date.now() - 60_000).toISOString(),
        endDate: new Date(Date.now() - 30_000).toISOString(),
        maxParticipants: 10,
        reminders: false,
      });
    expect(createRes.status).toBe(201);
    const eventId = createRes.body.data._id;

    const byId = await request(app).get(`/api/events/${eventId}`);
    expect(byId.status).toBe(200);
    expect(byId.body.success).toBe(true);

    const userCreated = await request(app)
      .get("/api/events/user/created")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(userCreated.status).toBe(200);
    expect(userCreated.body.data).toHaveLength(1);

    const joinRes = await request(app)
      .post(`/api/events/${eventId}/join`)
      .set("Authorization", `Bearer ${user.token}`);
    expect(joinRes.status).toBe(200);

    const joinAgain = await request(app)
      .post(`/api/events/${eventId}/join`)
      .set("Authorization", `Bearer ${user.token}`);
    expect(joinAgain.status).toBe(400);
    expect(joinAgain.body.error).toBe("Already joined this event");

    const userJoined = await request(app)
      .get("/api/events/user/joined")
      .set("Authorization", `Bearer ${user.token}`);
    expect(userJoined.status).toBe(200);
    expect(userJoined.body.data).toHaveLength(1);

    const leaveRes = await request(app)
      .post(`/api/events/${eventId}/leave`)
      .set("Authorization", `Bearer ${user.token}`);
    expect(leaveRes.status).toBe(200);

    const leaveAgain = await request(app)
      .post(`/api/events/${eventId}/leave`)
      .set("Authorization", `Bearer ${user.token}`);
    expect(leaveAgain.status).toBe(400);
    expect(leaveAgain.body.error).toBe("You are not a participant of this event");

    const searchBad = await request(app).get("/api/events/search/nearby");
    expect(searchBad.status).toBe(400);
    expect(searchBad.body.error).toBe("Latitude and longitude are required");
  });
});
