const { validatePolygon } = require("../../middleware/validation");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("validatePolygon middleware", () => {
  test("returns 400 when polygon is missing", () => {
    const req = { body: {} };
    const res = createRes();
    const next = jest.fn();

    validatePolygon(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "Polygon object is required",
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("returns 400 when polygon is not closed", () => {
    const req = {
      body: {
        polygon: {
          coordinates: [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
        },
      },
    };
    const res = createRes();
    const next = jest.fn();

    validatePolygon(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "Polygon must be closed (first and last coordinates must match)",
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("calls next() when polygon is valid", () => {
    const req = {
      body: {
        polygon: {
          type: "Polygon",
          name: "test-area",
          coordinates: [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        },
      },
    };
    const res = createRes();
    const next = jest.fn();

    validatePolygon(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

