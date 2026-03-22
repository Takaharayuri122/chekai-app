import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_V1, SCHEMA_VERSION } from './schema';

export function getSchemaVersion(db: SQLiteDatabase): number {
  const result = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  return result?.user_version ?? 0;
}

function setSchemaVersion(db: SQLiteDatabase, version: number): void {
  // Note: PRAGMA does not support parameterized queries — string interpolation is intentional and safe here
  db.execSync(`PRAGMA user_version = ${version}`);
}

export function runMigrations(db: SQLiteDatabase): void {
  const currentVersion = getSchemaVersion(db);

  if (currentVersion >= SCHEMA_VERSION) {
    return;
  }

  db.withTransactionSync(() => {
    if (currentVersion < 1) {
      db.execSync(SCHEMA_V1);
      setSchemaVersion(db, 1);
    }
    // Future migrations: if (currentVersion < 2) { db.execSync(SCHEMA_V2); setSchemaVersion(db, 2); }
  });
}
