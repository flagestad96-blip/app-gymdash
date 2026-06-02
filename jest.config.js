/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  // Only the real source tree — never scan linked worktrees under .claude/.
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/.claude/"],
  modulePathIgnorePatterns: ["<rootDir>/.claude/"],
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  moduleNameMapper: {
    "^expo-sqlite$": "<rootDir>/src/__tests__/mocks/expo-sqlite.ts",
    "^react-native$": "<rootDir>/src/__tests__/mocks/react-native.ts",
  },
};
