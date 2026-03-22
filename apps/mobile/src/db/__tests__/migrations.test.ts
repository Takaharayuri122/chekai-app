import { runMigrations, getSchemaVersion } from '../migrations';

// Mock expo-sqlite — cannot run in Node/Jest environment
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => mockDb),
}));

const mockDb = {
  execSync: jest.fn(),
  getFirstSync: jest.fn(),
  withTransactionSync: jest.fn((fn: () => void) => fn()),
};

describe('runMigrations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('executes schema v1 on a fresh database (version 0)', () => {
    mockDb.getFirstSync.mockReturnValue({ user_version: 0 });

    runMigrations(mockDb as any);

    expect(mockDb.withTransactionSync).toHaveBeenCalledTimes(1);
    expect(mockDb.execSync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS usuarios'));
    expect(mockDb.execSync).toHaveBeenCalledWith(expect.stringContaining('PRAGMA user_version = 1'));
  });

  it('skips migrations when database is already at current version', () => {
    mockDb.getFirstSync.mockReturnValue({ user_version: 1 });

    runMigrations(mockDb as any);

    expect(mockDb.withTransactionSync).not.toHaveBeenCalled();
    expect(mockDb.execSync).not.toHaveBeenCalled();
  });

  it('getSchemaVersion returns 0 when PRAGMA returns null', () => {
    mockDb.getFirstSync.mockReturnValue(null);

    const version = getSchemaVersion(mockDb as any);

    expect(version).toBe(0);
  });
});
