/**
 * Banco SQLite real em memória (node:sqlite) com a mesma API síncrona usada do
 * expo-sqlite (`execSync`, `runSync`, `getFirstSync`, `getAllSync`,
 * `withTransactionSync`). Permite testar SQL de verdade (migrations, pull) em Node.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5, SCHEMA_V6, SCHEMA_V7, SCHEMA_V8 } from '../schema';

type Parametro = string | number | null;

interface DatabaseSyncNode {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: Parametro[]): unknown;
    get(...params: Parametro[]): unknown;
    all(...params: Parametro[]): unknown[];
  };
  close(): void;
}

function normalizar(params?: unknown[]): Parametro[] {
  return (params ?? []).map((v) => {
    if (v === undefined) return null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v as Parametro;
  });
}

type ConstrutorDatabaseSync = new (caminho: string) => DatabaseSyncNode;

/** node:sqlite é experimental no Node 22–24: o aviso "ExperimentalWarning" no teste é esperado. */
function carregarDatabaseSync(): ConstrutorDatabaseSync {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return (require('node:sqlite') as { DatabaseSync: ConstrutorDatabaseSync }).DatabaseSync;
}

export interface BancoEmMemoria {
  db: SQLiteDatabase;
  fechar: () => void;
}

export function abrirBancoEmMemoria(): BancoEmMemoria {
  const DatabaseSync = carregarDatabaseSync();
  const nativo = new DatabaseSync(':memory:');
  nativo.exec('PRAGMA foreign_keys = ON');
  const db = {
    execSync: (sql: string) => nativo.exec(sql),
    runSync: (sql: string, params?: unknown[]) => nativo.prepare(sql).run(...normalizar(params)),
    getFirstSync: (sql: string, params?: unknown[]) => {
      const row = nativo.prepare(sql).get(...normalizar(params));
      return row ? { ...(row as object) } : null;
    },
    getAllSync: (sql: string, params?: unknown[]) =>
      nativo.prepare(sql).all(...normalizar(params)).map((r) => ({ ...(r as object) })),
    withTransactionSync: (fn: () => void) => {
      nativo.exec('BEGIN');
      try {
        fn();
        nativo.exec('COMMIT');
      } catch (e) {
        nativo.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return { db: db as unknown as SQLiteDatabase, fechar: () => nativo.close() };
}

/** Leva um banco vazio até a V8 (estado dos aparelhos antes do índice único de itens). */
export function prepararAteV8(db: SQLiteDatabase): void {
  db.execSync(SCHEMA_V1);
  for (const schema of [SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5, SCHEMA_V6, SCHEMA_V7, SCHEMA_V8]) {
    for (const stmt of schema.trim().split(';').map((s) => s.trim()).filter(Boolean)) {
      db.execSync(stmt + ';');
    }
  }
  db.execSync('PRAGMA user_version = 8');
}
