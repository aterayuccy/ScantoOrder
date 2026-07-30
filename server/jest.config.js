module.exports = {
  clearMocks: true,
  collectCoverageFrom: [
    "controllers/**/*.js",
    "middlewares/**/*.js",
    "services/**/*.js",
    "validators/**/*.js",
    "!services/product-image-service.js",
  ],
  coverageDirectory: "coverage",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.js"],
};
