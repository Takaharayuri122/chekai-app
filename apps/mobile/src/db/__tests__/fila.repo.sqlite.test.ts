import type { SQLiteDatabase } from 'expo-sqlite';
import { FilaRepo } from '../repositories/fila.repo';
import { getDatabase } from '../client';
import { runMigrations } from '../migrations';
import { abrirBancoEmMemoria, type BancoEmMemoria } from './sqlite-memoria';

jest.mock('../client', () => ({ getDatabase: jest.fn() }));
let mockContador = 0;
jest.mock('../../utils/uuid', () => ({ gerarUUID: () => `q${++mockContador}` }));

function inserirSemDona(db: SQLiteDatabase, id: string, entidade: string, localId: string, criadoEm: string): void {
  // linha gravada antes da V8: sem dona (usuario_id NULL)
  db.runSync(
    `INSERT INTO sync_queue (id, entity, operation, payload, retries, created_at)
     VALUES (?, ?, 'push', ?, 0, ?)`,
    [id, entidade, JSON.stringify({ localId }), criadoEm],
  );
}

describe('FilaRepo (SQLite real)', () => {
  let banco: BancoEmMemoria;
  let db: SQLiteDatabase;
  let repo: FilaRepo;

  beforeEach(() => {
    mockContador = 0;
    banco = abrirBancoEmMemoria();
    db = banco.db;
    runMigrations(db);
    (getDatabase as jest.Mock).mockReturnValue(db);
    repo = new FilaRepo();
  });

  afterEach(() => banco.fechar());

  it('atribuirSemDona passa as linhas antigas sem dona para a usuária logada', () => {
    inserirSemDona(db, 'antiga', 'auditoria', 'L1', '2026-10-01T10:00:00.000Z');
    repo.enfileirar('auditoria', 'L2', 'outra');

    repo.atribuirSemDona('u1');

    const donas = db.getAllSync<{ id: string; usuario_id: string }>(
      'SELECT id, usuario_id FROM sync_queue ORDER BY id',
    );
    expect(donas).toEqual([
      { id: 'antiga', usuario_id: 'u1' },
      { id: 'q1', usuario_id: 'outra' },
    ]);
  });

  it('listarParaEnvio e contarPendentes só veem linhas da usuária (sem o ramo NULL)', () => {
    inserirSemDona(db, 'antiga', 'auditoria', 'L1', '2026-10-01T10:00:00.000Z');
    repo.enfileirar('auditoria', 'L2', 'u1');

    expect(repo.listarParaEnvio('u2')).toEqual([]);
    expect(repo.contarPendentes('u2')).toBe(0);
    expect(repo.listarParaEnvio('u1').map((i) => i.localId)).toEqual(['L2']);
    expect(repo.contarPendentes('u1')).toBe(1);
  });

  it('listarParaEnvio traz criadoEm em ordem de criação', () => {
    repo.enfileirar('checkin', 'C1', 'u1');
    const [item] = repo.listarParaEnvio('u1');
    expect(item.criadoEm).toEqual(expect.any(String));
  });

  it('primeiraFalhaEm devolve a criação do item mais antigo que falhou de vez', () => {
    repo.enfileirar('checkin', 'C1', 'u1');
    repo.enfileirar('checkin', 'C2', 'u1');
    expect(repo.primeiraFalhaEm('u1', 'checkin')).toBeNull();
    const [primeiro] = repo.listarParaEnvio('u1');
    repo.registrarFalha(primeiro.id, '409', true);
    expect(repo.primeiraFalhaEm('u1', 'checkin')).toBe(primeiro.criadoEm);
    expect(repo.primeiraFalhaEm('u2', 'checkin')).toBeNull();
    expect(repo.primeiraFalhaEm('u1', 'auditoria')).toBeNull();
  });
});
