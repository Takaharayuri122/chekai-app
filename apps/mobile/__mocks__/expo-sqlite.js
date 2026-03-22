// Manual mock for expo-sqlite — used by db-unit Jest project.
// The real expo-sqlite ships as ESM which Node/ts-jest cannot parse directly.
const openDatabaseSync = jest.fn(() => ({
  execSync: jest.fn(),
  runSync: jest.fn(),
  getFirstSync: jest.fn(),
  getAllSync: jest.fn(),
  withTransactionSync: jest.fn((fn) => fn()),
}));

module.exports = { openDatabaseSync };
