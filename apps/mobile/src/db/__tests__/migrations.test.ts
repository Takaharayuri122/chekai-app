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
    mockDb.getFirstSync.mockReturnValue({ user_version: 9 });

    runMigrations(mockDb as any);

    expect(mockDb.withTransactionSync).not.toHaveBeenCalled();
    expect(mockDb.execSync).not.toHaveBeenCalled();
  });

  it('executes schema v7 (ativo em clientes/unidades) on a v6 database', () => {
    mockDb.getFirstSync.mockReturnValue({ user_version: 6 });

    runMigrations(mockDb as any);

    expect(mockDb.execSync).toHaveBeenCalledWith('ALTER TABLE clientes ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1;');
    expect(mockDb.execSync).toHaveBeenCalledWith('ALTER TABLE unidades ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1;');
    expect(mockDb.execSync).toHaveBeenCalledWith(expect.stringContaining('PRAGMA user_version = 7'));
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

  it('executes schema v3 on a v2 database', () => {
    mockDb.getFirstSync.mockReturnValue({ user_version: 2 });

    runMigrations(mockDb as any);

    expect(mockDb.execSync).toHaveBeenCalledWith(
      expect.stringContaining('ALTER TABLE auditorias ADD COLUMN pdf_local_path TEXT;')
    );
    expect(mockDb.execSync).toHaveBeenCalledWith(
      expect.stringContaining('PRAGMA user_version = 3')
    );
  });

  it('executes schema v4 on a v3 database', () => {
    mockDb.getFirstSync.mockReturnValue({ user_version: 3 });

    runMigrations(mockDb as any);

    expect(mockDb.execSync).toHaveBeenCalledWith(
      expect.stringContaining('ALTER TABLE relatorios_tecnicos ADD COLUMN pdf_url TEXT;')
    );
    expect(mockDb.execSync).toHaveBeenCalledWith(
      expect.stringContaining('PRAGMA user_version = 4')
    );
  });

  it('executes schema v5 on a v4 database', () => {
    mockDb.getFirstSync.mockReturnValue({ user_version: 4 });

    runMigrations(mockDb as any);

    expect(mockDb.execSync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE checkins')
    );
    expect(mockDb.execSync).toHaveBeenCalledWith(
      expect.stringContaining('PRAGMA user_version = 5')
    );
  });

  it('skips v5 when database is already past version 5', () => {
    mockDb.getFirstSync.mockReturnValue({ user_version: 9 });

    runMigrations(mockDb as any);

    expect(mockDb.execSync).not.toHaveBeenCalledWith(expect.stringContaining('DROP TABLE IF EXISTS checkins'));
  });

  it('executes schema v6 on a v5 database', () => {
    mockDb.getFirstSync.mockReturnValue({ user_version: 5 });

    runMigrations(mockDb as any);

    expect(mockDb.execSync).toHaveBeenCalledWith(
      expect.stringContaining('ALTER TABLE relatorios_tecnicos ADD COLUMN modelo_secoes TEXT;')
    );
    expect(mockDb.execSync).toHaveBeenCalledWith(
      expect.stringContaining('ALTER TABLE relatorios_tecnicos ADD COLUMN aviso_sync TEXT;')
    );
    expect(mockDb.execSync).toHaveBeenCalledWith(
      expect.stringContaining('PRAGMA user_version = 6')
    );
  });

  it('executes schema v8 on a v7 database', () => {
    mockDb.getFirstSync.mockReturnValue({ user_version: 7 });

    runMigrations(mockDb as any);

    expect(mockDb.execSync).toHaveBeenCalledWith(
      expect.stringContaining('ALTER TABLE sync_queue ADD COLUMN usuario_id TEXT;')
    );
    expect(mockDb.execSync).toHaveBeenCalledWith(
      expect.stringContaining("ALTER TABLE sync_queue ADD COLUMN status TEXT NOT NULL DEFAULT 'pendente';")
    );
    expect(mockDb.execSync).toHaveBeenCalledWith(
      expect.stringContaining('latitude_checkin REAL,')
    );
    expect(mockDb.execSync).toHaveBeenCalledWith(
      expect.stringContaining('envio_status TEXT,')
    );
    expect(mockDb.execSync).toHaveBeenCalledWith(
      expect.stringContaining('PRAGMA user_version = 8')
    );
  });
});
