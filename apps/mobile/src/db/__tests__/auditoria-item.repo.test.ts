import { AuditoriaItemRepo } from '../repositories/auditoria-item.repo';
import { getDatabase } from '../client';

jest.mock('../client');

const mockDb = { runSync: jest.fn(), getAllSync: jest.fn(), getFirstSync: jest.fn() };
(getDatabase as jest.Mock).mockReturnValue(mockDb);

describe('AuditoriaItemRepo', () => {
  let repo: AuditoriaItemRepo;
  beforeEach(() => { jest.clearAllMocks(); repo = new AuditoriaItemRepo(); });

  it('bulkCreate inserts one row per template item', () => {
    repo.bulkCreate('audit-1', [
      { id: 'ti-1', descricao: 'Item 1', ordem: 1, categoria: 'Higiene',
        tipoResposta: 'padrao', fotoObrigatoria: false,
        observacaoObrigatoria: false, pontuacaoMaxima: 10 },
      { id: 'ti-2', descricao: 'Item 2', ordem: 2, categoria: 'Higiene',
        tipoResposta: 'padrao', fotoObrigatoria: false,
        observacaoObrigatoria: false, pontuacaoMaxima: 5 },
    ]);

    expect(mockDb.runSync).toHaveBeenCalledTimes(2);
    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO auditoria_itens'),
      expect.arrayContaining(['audit-1', 'ti-1'])
    );
  });

  it('upsertResposta updates the item row', () => {
    repo.upsertResposta('item-1', {
      resposta: 'conforme',
      observacao: 'Ok',
      pontuacao: 10,
    });

    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE auditoria_itens'),
      expect.arrayContaining(['conforme', 'Ok', 10, 'item-1'])
    );
  });

  it('findByAuditoria returns all items with template info joined', () => {
    mockDb.getAllSync.mockReturnValue([
      { id: 'item-1', auditoria_id: 'audit-1', template_item_id: 'ti-1',
        resposta: 'nao_avaliado', observacao: null,
        descricao_nao_conformidade: null, plano_acao_final: null,
        pontuacao: 0, sync_status: 'pending',
        descricao: 'Item 1', ordem: 1, categoria: 'Higiene',
        tipo_resposta: 'padrao', opcoes_resposta_config: null,
        foto_obrigatoria: 0, observacao_obrigatoria: 0,
        criticidade: null, pontuacao_maxima: 10,
        descricao_ia: null, plano_acao_sugerido: null },
    ]);

    const items = repo.findByAuditoria('audit-1');

    expect(items).toHaveLength(1);
    expect(items[0].descricao).toBe('Item 1');
    expect(items[0].tipoResposta).toBe('padrao');
  });

  it('findById returns the item when found', () => {
    mockDb.getFirstSync.mockReturnValue({
      id: 'item-1', auditoria_id: 'audit-1', template_item_id: 'ti-1',
      resposta: 'conforme', observacao: null,
      descricao_nao_conformidade: null, plano_acao_final: null,
      descricao_ia: null, plano_acao_sugerido: null,
      pontuacao: 10, sync_status: 'pending',
      descricao: 'Item 1', ordem: 1, categoria: 'Higiene',
      tipo_resposta: 'padrao', opcoes_resposta_config: null,
      foto_obrigatoria: 0, observacao_obrigatoria: 0,
      criticidade: null, pontuacao_maxima: 10,
    });

    const item = repo.findById('item-1');

    expect(item).not.toBeNull();
    expect(item!.id).toBe('item-1');
    expect(item!.fotoObrigatoria).toBe(false);
  });

  it('findById returns null when item not found', () => {
    mockDb.getFirstSync.mockReturnValue(null);

    const item = repo.findById('nonexistent');

    expect(item).toBeNull();
  });
});
