// Mock for expo-file-system used in unit tests
module.exports = {
  uploadAsync: jest.fn(async () => ({ status: 200, body: '{}' })),
  downloadAsync: jest.fn(async () => ({ status: 200, uri: '' })),
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  readAsStringAsync: jest.fn(async () => ''),
  writeAsStringAsync: jest.fn(async () => {}),
  deleteAsync: jest.fn(async () => {}),
  makeDirectoryAsync: jest.fn(async () => {}),
  documentDirectory: '/mock/documents/',
  cacheDirectory: '/mock/cache/',
};
