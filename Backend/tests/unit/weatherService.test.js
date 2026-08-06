const { convertWindSpeed, checkThresholds } = require("../../services/weatherService");

describe("weatherService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ALERT_TEMP_THRESHOLD = "35";
    process.env.ALERT_RAIN_THRESHOLD = "50";
    process.env.ALERT_WIND_THRESHOLD = "40";
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("convertWindSpeed converts m/s to km/h", () => {
    expect(convertWindSpeed(10)).toBe(36);
  });

  test("checkThresholds returns no violations when under thresholds", () => {
    const result = checkThresholds({
      temperature: 30,
      rainfall: 0,
      windSpeed: 5, // m/s = 18 km/h
    });

    expect(result.hasViolations).toBe(false);
    expect(result.priority).toBe("low");
    expect(result.violations).toHaveLength(0);
  });

  test("checkThresholds prioritizes multiple violations as critical", () => {
    const result = checkThresholds({
      temperature: 45, // exceeds 35
      rainfall: 60, // exceeds 50
      windSpeed: 5,
    });

    expect(result.hasViolations).toBe(true);
    expect(result.priority).toBe("critical");
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
  });

  test("checkThresholds sets medium priority for a moderate single violation", () => {
    const result = checkThresholds({
      temperature: 41, // 17% over 35 => medium
      rainfall: 0,
      windSpeed: 1,
    });

    expect(result.hasViolations).toBe(true);
    expect(result.priority).toBe("medium");
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toEqual(
      expect.objectContaining({ type: "high_temperature" })
    );
  });
});

