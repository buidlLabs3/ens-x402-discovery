/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/backend/tests"],
  testMatch: ["**/*.test.js"],
  clearMocks: true,
  verbose: true,
};
