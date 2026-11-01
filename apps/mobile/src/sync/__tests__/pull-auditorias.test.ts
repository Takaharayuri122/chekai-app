import type { SQLiteDatabase } from 'expo-sqlite';
import { pullAuditorias, pullAuditoriaDetalhe } from '../pull';
import { getDatabase } from '../../db/client';
import { runMigrations } from '../../db/migrations';
import { abrirBancoEmMemoria, prepararAteV8, type BancoEmMemoria } from '../../db/__tests__/sqlite-memoria';

jest.mock('../../db/client', () => ({ getDatabase: jest.fn() }));
jest.mock('../../api/client', () => ({ apiGet: jest.fn(), ApiError: class extends Error {} }));
jest.mock('../../api/auditoria.api', () => ({ getAuditoriaDetalhe: jest.fn() }));
jest.mock('../../api/checkin.api', () => ({ buscarCheckinAberto: jest.fn() }));
jest.mock('../../api/relatorio-tecnico.api', () => ({ buscarModeloRelatorioTecnico: jest.fn() }));
jest.mock('../../store/auth', () => ({ useAuthStore: { getState: () => ({ user: { id: 'u1' } }) } }));
jest.mock('../../store/modelo-relatorio', () => ({ salvarModeloCache: jest.fn() }));

const { apiGet } = require('../../api/client');
const { getAuditoriaDetalhe } = require('../../api/auditoria.api');

const AGORA = '2026-11-01T10:00:00.000Z';

function semear(db: SQLiteDatabase, syncStatus: 'synced' | 'pending'): void {
  db.runSync(`INSERT INTO clientes (id, razao_social, updated_at) VALUES ('c1', 'Cliente', ?)`, [AGORA]);
  db.runSync(`INSERT INTO unidades (id, nome, cliente_id, updated_at) VALUES ('u1', 'Unidade', 'c1', ?)`, [AGORA]);
  db.runSync(`INSERT INTO checklist_templates (id, nome, updated_at) VALUES ('t1', 'Checklist', ?)`, [AGORA]);
  for (const ti of ['ti1', 'ti2']) {
    db.runSync(
      `INSERT INTO template_itens (id, template_id, descricao, ordem, updated_at) VALUES (?, 't1', ?, 1, ?)`,
      [ti, ti, AGORA],
    );
  }
  // auditoria feita no aparelho (id = localId), já com vínculo no servidor (R1)
  db.runSync(
    `INSERT INTO auditorias (id, remote_id, local_id, status, cliente_id, unidade_id, template_id, sync_status, updated_at)
     VALUES ('L1', 'R1', 'L1', 'concluida', 'c1', 'u1', 't1', ?, ?)`,
    [syncStatus, AGORA],
  );
  db.runSync(
    `INSERT INTO auditoria_itens (id, auditoria_id, template_item_id, resposta, sync_status, updated_at)
     VALUES ('local-1', 'L1', 'ti1', 'conforme', ?, ?), ('local-2', 'L1', 'ti2', 'nao_conforme', ?, ?)`,
    [syncStatus, AGORA, syncStatus, AGORA],
  );
}

/** Resposta da API para a auditoria criada pelo aparelho: devolve o localId e as cópias dos itens. */
const auditoriaDaApi = (respostas: [string, string]) => ({
  id: 'R1', localId: 'L1', status: 'finalizada', unidadeId: 'u1', templateId: 't1',
  unidade: { id: 'u1', clienteId: 'c1' },
  itens: [
    { id: 's1', templateItemId: 'ti1', resposta: respostas[0], pontuacao: 0 },
    { id: 's2', templateItemId: 'ti2', resposta: respostas[1], pontuacao: 0 },
  ],
});

const detalheDaApi = () => ({
  id: 'R1', templateId: 't1', template: { id: 't1', nome: 'Checklist' },
  itens: [
    {
      id: 's1', templateItemId: 'ti1', resposta: 'conforme',
      templateItem: { id: 'ti1', pergunta: 'ti1', ordem: 1 },
      fotos: [{ id: 'fr1', url: 'https://remoto/f1.jpg' }],
    },
    {
      id: 's2', templateItemId: 'ti2', resposta: 'nao_avaliado',
      templateItem: { id: 'ti2', pergunta: 'ti2', ordem: 2 },
      fotos: [],
    },
  ],
});

// Aparelhos antigos (V8, sem índice único) e o banco atual: o pull não pode depender do índice
describe.each([
  ['banco V8 (sem índice único)', false],
  ['banco atual', true],
])('pull de auditoria criada no aparelho — %s', (_nome, migrarAteAtual) => {
  let banco: BancoEmMemoria;
  let db: SQLiteDatabase;

  const itens = () =>
    db.getAllSync<{ id: string; template_item_id: string; resposta: string }>(
      `SELECT id, template_item_id, resposta FROM auditoria_itens ORDER BY template_item_id, id`,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    banco = abrirBancoEmMemoria();
    db = banco.db;
    prepararAteV8(db);
    if (migrarAteAtual) runMigrations(db);
    (getDatabase as jest.Mock).mockReturnValue(db);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    banco.fechar();
  });

  it('enviada e puxada de volta: não duplica os itens', async () => {
    semear(db, 'synced');
    apiGet.mockResolvedValue({ items: [auditoriaDaApi(['conforme', 'nao_conforme'])], hasNext: false });
    getAuditoriaDetalhe.mockResolvedValue({ itens: [] });

    await pullAuditorias();

    expect(itens()).toEqual([
      { id: 'local-1', template_item_id: 'ti1', resposta: 'conforme' },
      { id: 'local-2', template_item_id: 'ti2', resposta: 'nao_conforme' },
    ]);
  });

  it('auditoria aguardando envio: itens locais não são tocados nem ganham cópias', async () => {
    semear(db, 'pending');
    apiGet.mockResolvedValue({ items: [auditoriaDaApi(['nao_avaliado', 'nao_avaliado'])], hasNext: false });

    await pullAuditorias();

    expect(itens()).toEqual([
      { id: 'local-1', template_item_id: 'ti1', resposta: 'conforme' },
      { id: 'local-2', template_item_id: 'ti2', resposta: 'nao_conforme' },
    ]);
  });

  it('detalhe: atualiza o item local da mesma pergunta e liga as fotos a ele', async () => {
    semear(db, 'synced');
    getAuditoriaDetalhe.mockResolvedValue(detalheDaApi());

    await pullAuditoriaDetalhe({ localId: 'L1', remoteId: 'R1' });

    expect(itens()).toEqual([
      { id: 'local-1', template_item_id: 'ti1', resposta: 'conforme' },
      { id: 'local-2', template_item_id: 'ti2', resposta: 'nao_avaliado' },
    ]);
    const remotos = db.getAllSync<{ id: string; remote_id: string }>(
      `SELECT id, remote_id FROM auditoria_itens ORDER BY id`,
    );
    expect(remotos).toEqual([
      { id: 'local-1', remote_id: 's1' },
      { id: 'local-2', remote_id: 's2' },
    ]);
    const fotos = db.getAllSync<{ id: string; auditoria_item_id: string }>(
      `SELECT id, auditoria_item_id FROM fotos`,
    );
    expect(fotos).toEqual([{ id: 'fr1', auditoria_item_id: 'local-1' }]);
  });

  it('detalhe de auditoria aguardando envio não altera nada', async () => {
    semear(db, 'pending');
    getAuditoriaDetalhe.mockResolvedValue(detalheDaApi());

    await pullAuditoriaDetalhe({ localId: 'L1', remoteId: 'R1' });

    expect(itens()).toEqual([
      { id: 'local-1', template_item_id: 'ti1', resposta: 'conforme' },
      { id: 'local-2', template_item_id: 'ti2', resposta: 'nao_conforme' },
    ]);
    expect(db.getAllSync(`SELECT id FROM fotos`)).toEqual([]);
  });
});

