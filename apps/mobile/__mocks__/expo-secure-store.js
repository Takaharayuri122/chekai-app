// Mock for expo-secure-store used in unit tests (sync-unit, db-unit)
const store = {};
module.exports = {
  getItemAsync: jest.fn(async (key) => store[key] ?? null),
  setItemAsync: jest.fn(async (key, value) => { store[key] = value; }),
  deleteItemAsync: jest.fn(async (key) => { delete store[key]; }),
};
