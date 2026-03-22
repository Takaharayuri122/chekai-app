import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';

// Singleton contract: always returns the same instance.
// Do not reset _db between calls.
let _db: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync('chekai.db');
    runMigrations(_db);
    _db.execSync('PRAGMA foreign_keys = ON');
  }
  return _db;
}
