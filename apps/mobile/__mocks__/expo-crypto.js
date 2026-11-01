// Mock for expo-crypto used in unit tests (db-unit, sync-unit).
// expo-crypto ships ESM that Jest cannot parse; only randomUUID is used (src/utils/uuid.ts).
const { randomUUID } = require('crypto');
module.exports = {
  randomUUID,
};
