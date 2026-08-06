const request = require("supertest");

const app = require("../../app");

describe("API integration", () => {
  test("GET /api/health returns 200", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        message: "API is running",
      })
    );
  });

  test("auth flow: register -> login -> me", async () => {
    const userPayload = {
      fullName: "Test User",
      email: "test@example.com",
      password: "Password123!",
      role: "user",
    };

    const registerRes = await request(app)
      .post("/api/auth/register")
      .send(userPayload);

    expect(registerRes.status).toBe(201);
    expect(registerRes.body).toEqual(
      expect.objectContaining({
        success: true,
        token: expect.any(String),
        data: expect.objectContaining({
          user: expect.objectContaining({
            email: "test@example.com",
            fullName: "Test User",
          }),
        }),
      })
    );
    expect(registerRes.body.data.user.password).toBeUndefined();

    const loginRes = await request(app).post("/api/auth/login").send({
      email: userPayload.email,
      password: userPayload.password,
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toEqual(expect.any(String));

    const meResUnauthorized = await request(app).get("/api/auth/me");
    expect(meResUnauthorized.status).toBe(401);
    expect(meResUnauthorized.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "Not authorized to access this route",
      })
    );

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          user: expect.objectContaining({
            email: userPayload.email,
            fullName: userPayload.fullName,
          }),
        }),
      })
    );
  });

  test("login returns 401 for wrong password", async () => {
    await request(app).post("/api/auth/register").send({
      fullName: "Test User",
      email: "wrong-pass@example.com",
      password: "Password123!",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "wrong-pass@example.com",
      password: "WrongPassword!",
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "Invalid credentials",
      })
    );
  });

  test("auth misc endpoints: verify-email / forgot-password / reset-password", async () => {
    const verifyRes = await request(app).get("/api/auth/verify-email/any-token");
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body).toEqual(
      expect.objectContaining({
        success: true,
        message: expect.stringContaining("not implemented"),
      })
    );

    const forgotRes = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "someone@example.com" });
    expect(forgotRes.status).toBe(200);
    expect(forgotRes.body).toEqual(
      expect.objectContaining({
        success: true,
      })
    );

    const resetRes = await request(app)
      .put("/api/auth/reset-password/any-token")
      .send({ password: "NewPassword123!" });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body).toEqual(
      expect.objectContaining({
        success: true,
      })
    );
  });

  test("protected endpoints: logout + update-password", async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      fullName: "Pwd User",
      email: "pwduser@example.com",
      password: "Password123!",
      role: "user",
    });
    expect(registerRes.status).toBe(201);
    const token = registerRes.body.token;

    const logoutUnauthorized = await request(app).post("/api/auth/logout");
    expect(logoutUnauthorized.status).toBe(401);

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body).toEqual(
      expect.objectContaining({
        success: true,
        message: "Logged out successfully",
      })
    );

    const updateMissing = await request(app)
      .put("/api/auth/update-password")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(updateMissing.status).toBe(400);
    expect(updateMissing.body.message).toBe(
      "Please provide currentPassword and newPassword"
    );

    const updateWrong = await request(app)
      .put("/api/auth/update-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "WrongPassword!", newPassword: "NewPassword123!" });
    expect(updateWrong.status).toBe(401);
    expect(updateWrong.body.message).toBe("Current password is incorrect");

    const updateOk = await request(app)
      .put("/api/auth/update-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "Password123!", newPassword: "NewPassword123!" });
    expect(updateOk.status).toBe(200);
    expect(updateOk.body).toEqual(
      expect.objectContaining({
        success: true,
        message: "Password updated successfully",
        token: expect.any(String),
      })
    );

    const loginWithOld = await request(app).post("/api/auth/login").send({
      email: "pwduser@example.com",
      password: "Password123!",
    });
    expect(loginWithOld.status).toBe(401);

    const loginWithNew = await request(app).post("/api/auth/login").send({
      email: "pwduser@example.com",
      password: "NewPassword123!",
    });
    expect(loginWithNew.status).toBe(200);
  });
});
