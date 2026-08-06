process.env.JWT_SECRET = "unit-test-secret";
process.env.ADMIN_EMAIL = "admin@example.com";

const jwt = require("jsonwebtoken");
const { protect } = require("../../middleware/auth");

describe("auth protect middleware", () => {
  test("returns 401 when token is missing", async () => {
    const req = { headers: {}, cookies: {} };
    const res = {};
    const next = jest.fn();

    await protect(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Not authorized to access this route");
  });

  test("sets req.user for dev admin token", async () => {
    const token = jwt.sign({ id: "dev-admin-user" }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
    const res = {};
    const next = jest.fn();

    await protect(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual(
      expect.objectContaining({
        id: "dev-admin-user",
        role: "admin",
      })
    );
  });
});
