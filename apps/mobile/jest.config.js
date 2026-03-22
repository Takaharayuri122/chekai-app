/**
 * Jest configuration using projects to handle two test environments:
 *
 * 1. "db-unit" — pure Node.js tests for the SQLite layer (src/db/__tests__).
 *    Uses ts-jest to avoid the babel-preset-expo / @babel/core 7.28 incompatibility
 *    caused by @babel/plugin-transform-export-namespace-from@7.27 shipping an
 *    `exports.default` that the new @babel/core plugin validator rejects.
 *
 * 2. "react-native" — all other tests via the standard jest-expo preset.
 */
module.exports = {
  projects: [
    // ── Pure logic / SQLite unit tests ────────────────────────────────────────
    {
      displayName: 'db-unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/db/__tests__/**/*.test.ts'],
      modulePaths: ['<rootDir>/../../node_modules'],
      transform: {
        '\\.[jt]sx?$': [
          'ts-jest',
          {
            tsconfig: {
              esModuleInterop: true,
            },
          },
        ],
      },
    },
    // ── React-Native / Expo component tests ───────────────────────────────────
    {
      displayName: 'react-native',
      preset: 'jest-expo',
      setupFilesAfterEnv: ['@testing-library/react-native/extend-expect'],
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
      ],
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}',
        '<rootDir>/src/**/*.test.{ts,tsx}',
      ],
      testPathIgnorePatterns: [
        // Handled by the db-unit project above
        '<rootDir>/src/db/__tests__/',
      ],
    },
  ],
};
