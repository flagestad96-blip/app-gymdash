/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  moduleNameMapper: {
    "^expo-sqlite$": "<rootDir>/src/__tests__/mocks/expo-sqlite.ts",
    "^react-native$": "<rootDir>/src/__tests__/mocks/react-native.ts",
  },
};
