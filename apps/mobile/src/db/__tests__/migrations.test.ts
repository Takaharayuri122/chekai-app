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
    mockDb.getFirstSync.mockReturnValue({ user_version: 2 });

    runMigrations(mockDb as any);

    expect(mockDb.withTransactionSync).not.toHaveBeenCalled();
    expect(mockDb.execSync).not.toHaveBeenCalled();
  });

  it('getSchemaVersion returns 0 when PRAGMA returns null', () => {
    mockDb.getFirstSync.mockReturnValue(null);

    const version = getSchemaVersion(mockDb as any);

    expect(version).toBe(0);
  });

  it('executes schema v2 on a v1 database', () => {
    mockDb.getFirstSync.mockReturnValue({ user_version: 1 });

    runMigrations(mockDb as any);

    expect(mockDb.execSync).toHaveBeenCalledWith(
      expect.stringContaining('ALTER TABLE template_itens ADD COLUMN categoria TEXT;')
    );
    expect(mockDb.execSync).toHaveBeenCalledWith(
      expect.stringContaining('PRAGMA user_version = 2')
    );
  });

  it('skips v2 when database is already at version 2', () => {
    mockDb.getFirstSync.mockReturnValue({ user_version: 2 });

    runMigrations(mockDb as any);

    expect(mockDb.withTransactionSync).not.toHaveBeenCalled();
  });
});
