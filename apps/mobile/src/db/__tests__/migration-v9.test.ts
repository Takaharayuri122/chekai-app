import type { SQLiteDatabase } from 'expo-sqlite';
import { runMigrations, getSchemaVersion } from '../migrations';
import { abrirBancoEmMemoria, prepararAteV8, type BancoEmMemoria } from './sqlite-memoria';

const AGORA = '2026-11-01T10:00:00.000Z';

function semearAuditoria(db: SQLiteDatabase): void {
  db.runSync(`INSERT INTO clientes (id, razao_social, updated_at) VALUES ('c1', 'Cliente', ?)`, [AGORA]);
  db.runSync(`INSERT INTO unidades (id, nome, cliente_id, updated_at) VALUES ('u1', 'Unidade', 'c1', ?)`, [AGORA]);
  db.runSync(`INSERT INTO checklist_templates (id, nome, updated_at) VALUES ('t1', 'Checklist', ?)`, [AGORA]);
  for (const ti of ['ti1', 'ti2', 'ti3']) {
    db.runSync(
      `INSERT INTO template_itens (id, template_id, descricao, ordem, updated_at) VALUES (?, 't1', ?, 1, ?)`,
      [ti, ti, AGORA],
    );
  }
  db.runSync(
    `INSERT INTO auditorias (id, local_id, cliente_id, unidade_id, template_id, updated_at)
     VALUES ('L1', 'L1', 'c1', 'u1', 't1', ?)`,
    [AGORA],
  );
}

function inserirItem(db: SQLiteDatabase, id: string, templateItemId: string, resposta: string): void {
  db.runSync(
    `INSERT INTO auditoria_itens (id, auditoria_id, template_item_id, resposta, sync_status, updated_at)
     VALUES (?, 'L1', ?, ?, 'synced', ?)`,
    [id, templateItemId, resposta, AGORA],
  );
}

function inserirFoto(db: SQLiteDatabase, id: string, itemId: string, filePath: string | null): void {
  db.runSync(
    `INSERT INTO fotos (id, auditoria_item_id, file_path, url, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [id, itemId, filePath, filePath ? null : 'https://remoto/foto.jpg', AGORA],
  );
}

describe('migration V9 — itens duplicados da auditoria', () => {
  let banco: BancoEmMemoria;
  let db: SQLiteDatabase;

  beforeEach(() => {
    banco = abrirBancoEmMemoria();
    db = banco.db;
    prepararAteV8(db);
    semearAuditoria(db);
  });

  afterEach(() => banco.fechar());

  const itens = () =>
    db.getAllSync<{ id: string; template_item_id: string; resposta: string }>(
      `SELECT id, template_item_id, resposta FROM auditoria_itens ORDER BY template_item_id`,
    );

  it('mantém o item com resposta real e remove a cópia "não avaliado" vinda do servidor', () => {
    inserirItem(db, 'local-1', 'ti1', 'conforme');
    inserirItem(db, 'server-1', 'ti1', 'nao_avaliado');
    // pergunta sem resposta: fica a linha local (inserida primeiro)
    inserirItem(db, 'local-2', 'ti2', 'nao_avaliado');
    inserirItem(db, 'server-2', 'ti2', 'nao_avaliado');
    // cópia do servidor com resposta e local sem: fica a com resposta
    inserirItem(db, 'local-3', 'ti3', 'nao_avaliado');
    inserirItem(db, 'server-3', 'ti3', 'nao_conforme');

    runMigrations(db);

    expect(getSchemaVersion(db)).toBe(9);
    expect(itens()).toEqual([
      { id: 'local-1', template_item_id: 'ti1', resposta: 'conforme' },
      { id: 'local-2', template_item_id: 'ti2', resposta: 'nao_avaliado' },
      { id: 'server-3', template_item_id: 'ti3', resposta: 'nao_conforme' },
    ]);
  });

  it('fotos locais do item removido passam para o item mantido; fotos só remotas da cópia saem', () => {
    inserirItem(db, 'local-1', 'ti1', 'nao_avaliado');
    inserirItem(db, 'server-1', 'ti1', 'conforme');
    inserirFoto(db, 'f-local', 'local-1', 'file:///f.jpg');
    inserirItem(db, 'local-2', 'ti2', 'conforme');
    inserirItem(db, 'server-2', 'ti2', 'nao_avaliado');
    inserirFoto(db, 'f-remota', 'server-2', null);

    runMigrations(db);

    const fotos = db.getAllSync<{ id: string; auditoria_item_id: string }>(
      `SELECT id, auditoria_item_id FROM fotos ORDER BY id`,
    );
    expect(fotos).toEqual([{ id: 'f-local', auditoria_item_id: 'server-1' }]);
  });

  it('cria índice único: a mesma pergunta não entra duas vezes na auditoria', () => {
    inserirItem(db, 'local-1', 'ti1', 'conforme');
    runMigrations(db);
    expect(() => inserirItem(db, 'server-1', 'ti1', 'nao_avaliado')).toThrow(/UNIQUE/);
    db.runSync(
      `INSERT OR IGNORE INTO auditoria_itens (id, auditoria_id, template_item_id, resposta, sync_status, updated_at)
       VALUES ('server-1', 'L1', 'ti1', 'nao_avaliado', 'synced', ?)`,
      [AGORA],
    );
    expect(itens()).toHaveLength(1);
  });

  it('roda num banco novo (V0 → V9) sem erro', () => {
    const novo = abrirBancoEmMemoria();
    runMigrations(novo.db);
    expect(getSchemaVersion(novo.db)).toBe(9);
    novo.fechar();
  });
});
