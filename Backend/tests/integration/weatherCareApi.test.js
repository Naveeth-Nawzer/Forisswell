jest.mock("../../services/weatherService", () => ({
  getWeatherByCoordinates: jest.fn(async () => ({
    temperature: 30,
    humidity: 70,
    rainfall: 0,
    windSpeed: 3,
    description: "clear sky",
  })),
}));

const request = require("supertest");
const app = require("../../app");
const Tree = require("../../models/Tree");

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

describe("Weather Care API", () => {
  test("returns 400 for invalid tree id", async () => {
    const user = await registerUser({
      fullName: "User",
      email: "weather-user@example.com",
      password: "Password123!",
      role: "user",
    });

    const res = await request(app)
      .get("/api/weather-care/not-a-valid-id")
      .set("Authorization", `Bearer ${user.token}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "Invalid tree ID format",
      })
    );
  });

  test("returns 404 when tree is not found", async () => {
    const user = await registerUser({
      fullName: "User",
      email: "weather-user-2@example.com",
      password: "Password123!",
      role: "user",
    });

    const fakeId = "507f191e810c19729de860ea";
    const res = await request(app)
      .get(`/api/weather-care/${fakeId}`)
      .set("Authorization", `Bearer ${user.token}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "Tree not found",
      })
    );
  });

  test("GET /api/weather-care/:treeId returns mocked weather for existing tree", async () => {
    const user = await registerUser({
      fullName: "User",
      email: "weather-user-3@example.com",
      password: "Password123!",
      role: "user",
    });

    const tree = await Tree.create({
      species: "Neem",
      plantedDate: new Date(Date.now() - 60_000),
      location: {
        type: "Point",
        coordinates: [79.8612, 6.9271],
      },
      owner: user.user._id,
    });

    const res = await request(app)
      .get(`/api/weather-care/${tree._id}`)
      .set("Authorization", `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          treeId: tree._id.toString(),
          weather: expect.objectContaining({
            temperature: 30,
            description: "clear sky",
          }),
        }),
      })
    );
  });
});

