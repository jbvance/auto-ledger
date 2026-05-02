module.exports = {
  moduleNameMapper: {
    "^@autoledger/config$": "<rootDir>/../../packages/config/src/index.ts",
    "^@autoledger/shared$": "<rootDir>/../../packages/shared/src/index.ts",
    "^@autoledger/ui-tokens$":
      "<rootDir>/../../packages/ui-tokens/src/index.ts",
    "^@autoledger/validation$":
      "<rootDir>/../../packages/validation/src/index.ts",
    "\\.(css)$": "<rootDir>/test/styleMock.cjs",
  },
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["<rootDir>/**/*.test.ts", "<rootDir>/**/*.test.tsx"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native|@react-native-community|expo(nent)?|@expo(nent)?/.*|expo-.*|@expo/.*|react-native-reanimated|react-native-safe-area-context|@autoledger)/)",
  ],
};
