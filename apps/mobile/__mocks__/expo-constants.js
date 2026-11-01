// Mock for expo-constants used in unit tests (sync-unit).
// expo-constants ships ESM that Jest cannot parse; src/api/config.ts only reads expoConfig?.extra.
module.exports = {
  __esModule: true,
  default: { expoConfig: null },
  expoConfig: null,
};
