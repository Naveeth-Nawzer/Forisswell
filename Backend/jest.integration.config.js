/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/integration/**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/integration/setup.js"],
  clearMocks: true,
  testTimeout: 60_000,
};
