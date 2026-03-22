/**
 * Jest configuration using projects to handle three test environments:
 *
 * 1. "db-unit" — pure Node.js tests for the SQLite layer (src/db/__tests__).
 *    Uses ts-jest to avoid the babel-preset-expo / @babel/core 7.28 incompatibility
 *    caused by @babel/plugin-transform-export-namespace-from@7.27 shipping an
 *    `exports.default` that the new @babel/core plugin validator rejects.
 *
 * 2. "auth-unit" — pure Node.js tests for auth logic (src/auth/__tests__).
 *    Also uses ts-jest for the same babel incompatibility reason.
 *
 * 3. "sync-unit" — pure Node.js tests for sync logic (src/sync/__tests__).
 *    Also uses ts-jest for the same babel incompatibility reason.
 *
 * 4. "onboarding-unit" — React Native component tests for the onboarding flow.
 *    Uses ts-jest (not babel-jest) to bypass the babel-preset-expo / @babel/core
 *    7.28 incompatibility. The react-native environment globals are provided by
 *    react-native/jest/setup.js. All external RN native modules (expo-location,
 *    expo-image-picker, expo-notifications, react-native-safe-area-context,
 *    lucide-react-native) are mocked inside the test files themselves.
 *
 * 5. "react-native" — all other tests via the standard jest-expo preset.
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
    // ── Pure logic / Auth unit tests ──────────────────────────────────────────
    {
      displayName: 'auth-unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/auth/__tests__/**/*.test.ts'],
      modulePaths: ['<rootDir>/../../node_modules'],
      moduleNameMapper: {
        '^@meta-app/shared$': '<rootDir>/../../packages/shared/src/types/index.ts',
      },
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
    // ── Pure logic / Sync unit tests ─────────────────────────────────────────
    {
      displayName: 'sync-unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/sync/__tests__/**/*.test.ts'],
      modulePaths: ['<rootDir>/../../node_modules'],
      moduleNameMapper: {
        '^@meta-app/shared$': '<rootDir>/../../packages/shared/src/types/index.ts',
      },
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
    // ── Onboarding component tests (ts-jest, bypasses babel incompatibility) ──
    {
      displayName: 'onboarding-unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/components/onboarding/__tests__/**/*.test.{ts,tsx}'],
      // Check the local (mobile) node_modules first so that React@18 is resolved
      // instead of React@19 from the root (which is incompatible with react-test-renderer@18).
      modulePaths: ['<rootDir>/node_modules', '<rootDir>/../../node_modules'],
      // Minimal RN globals without pulling in Flow-typed @react-native/js-polyfills files
      // (react-native/jest/setup.js requires error-guard.js which has Flow types that
      // ts-jest cannot parse; our custom setup provides the essential globals only).
      setupFiles: [
        '<rootDir>/jest.setup.rn.js',
      ],
      setupFilesAfterEnv: ['@testing-library/react-native/extend-expect'],
      moduleNameMapper: {
        // Force React@18 (local) so react-test-renderer@18 doesn't crash with React@19 internals.
        // The root node_modules has React@19 (for web), but apps/mobile declares React@18.
        '^react$': '<rootDir>/node_modules/react',
        '^react/(.*)$': '<rootDir>/node_modules/react/$1',
        // Redirect react-native to our CJS mock that has no Flow types.
        // react-native source files have Flow type annotations that ts-jest cannot parse.
        '^react-native$': '<rootDir>/__mocks__/react-native.js',
        '^react-native/(.*)$': '<rootDir>/../../node_modules/react-native/$1',
        // Native modules not needed in unit tests
        '^@expo/vector-icons(.*)$': '<rootDir>/../../node_modules/@expo/vector-icons$1',
      },
      // Transform: ts-jest handles TS/TSX; also transform react-native + @react-native/*
      // packages that contain Flow-typed or ESM JS that node cannot parse directly.
      transformIgnorePatterns: [
        'node_modules/(?!(' +
          'react-native|' +
          '@react-native(-community)?|' +
          '@react-native/.*|' +
          'react-native-safe-area-context|' +
          '@testing-library/react-native' +
        '))',
      ],
      transform: {
        '\\.[jt]sx?$': [
          'ts-jest',
          {
            tsconfig: {
              // 'react-native' jsx mode PRESERVES JSX (like 'preserve') — Metro handles it.
              // 'react' requires explicit React import in every file.
              // 'react-jsx' uses the new automatic JSX runtime (React 17+) and needs no import.
              jsx: 'react-jsx',
              esModuleInterop: true,
            },
            diagnostics: false,
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
        // Handled by the auth-unit project above
        '<rootDir>/src/auth/__tests__/',
        // Handled by the sync-unit project above
        '<rootDir>/src/sync/__tests__/',
        // Handled by the onboarding-unit project above
        '<rootDir>/src/components/onboarding/__tests__/',
      ],
    },
  ],
};
