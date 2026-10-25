import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ChecklistLoteService } from './checklist-lote.service';
import {
  CriticidadeItem,
  TemplateItem,
  TipoRespostaCustomizada,
} from './entities/template-item.entity';
import { ConfigurarLoteDto } from './dto/configurar-lote.dto';

const TEMPLATE_ID = 'template-1';

function criarItem(parcial: Partial<TemplateItem> = {}): TemplateItem {
  return {
    id: 'item-1',
    templateId: TEMPLATE_ID,
    grupoId: 'grupo-1',
    pergunta: 'Pergunta',
    criticidade: CriticidadeItem.MEDIA,
    peso: 1,
    obrigatorio: true,
    ativo: true,
    permiteFoto: true,
    permiteObservacao: true,
    usarRespostasPersonalizadas: false,
    tipoRespostaCustomizada: null,
    opcoesResposta: null,
    opcoesRespostaConfig: [],
    ...parcial,
  } as unknown as TemplateItem;
}

describe('ChecklistLoteService', () => {
  let service: ChecklistLoteService;
  let templateRepository: { findOne: jest.Mock };
  let auditoriaRepository: { count: jest.Mock };
  let save: jest.Mock;
  let updateQuery: jest.Mock;
  let consulta: jest.Mock;
  const usuario = { id: 'gestor-1' };

  function montarTemplate(itens: TemplateItem[], gestorId = 'gestor-1') {
    templateRepository.findOne.mockResolvedValue({
      id: TEMPLATE_ID,
      gestorId,
      itens,
      grupos: [{ id: 'grupo-1' }],
    });
  }

  beforeEach(() => {
    save = jest.fn().mockImplementation((_alvo, itens) => Promise.resolve(itens));
    updateQuery = jest.fn().mockResolvedValue(undefined);
    consulta = jest.fn().mockResolvedValue([]);
    templateRepository = { findOne: jest.fn() };
    auditoriaRepository = { count: jest.fn().mockResolvedValue(0) };
    const itemRepository = {
      manager: { transaction: jest.fn((cb) => cb({ save, query: updateQuery })), query: consulta },
    };
    service = new ChecklistLoteService(
      templateRepository as never,
      itemRepository as never,
      auditoriaRepository as never,
    );
  });

  it('aplica só os campos enviados', async () => {
    const item = criarItem({ criticidade: CriticidadeItem.ALTA });
    montarTemplate([item]);

    const r = await service.configurar(TEMPLATE_ID, { alteracoes: { permiteFoto: false } }, usuario);

    const salvos = save.mock.calls[0][1] as TemplateItem[];
    expect(salvos).toHaveLength(1);
    expect(salvos[0].criticidade).toBe(CriticidadeItem.ALTA);
    expect(salvos[0].permiteFoto).toBe(false);
    expect(r).toMatchObject({ totalAfetados: 1, ignorados: 0, simulado: false });
  });

  it('tipo texto em lote força peso 0 e permiteFoto false', async () => {
    montarTemplate([criarItem({ peso: 3 })]);

    await service.configurar(TEMPLATE_ID, { alteracoes: { tipoResposta: 'texto' } }, usuario);

    const [salvo] = save.mock.calls[0][1] as TemplateItem[];
    expect(salvo.tipoRespostaCustomizada).toBe(TipoRespostaCustomizada.TEXTO);
    expect(salvo.peso).toBe(0);
    expect(salvo.permiteFoto).toBe(false);
  });

  it('sair de texto sem permiteFoto explícito restaura permiteFoto true', async () => {
    montarTemplate([
      criarItem({
        tipoRespostaCustomizada: TipoRespostaCustomizada.TEXTO,
        usarRespostasPersonalizadas: true,
        peso: 0,
        permiteFoto: false,
      }),
    ]);

    await service.configurar(TEMPLATE_ID, { alteracoes: { tipoResposta: 'padrao' } }, usuario);

    const [salvo] = save.mock.calls[0][1] as TemplateItem[];
    expect(salvo.permiteFoto).toBe(true);
    expect(salvo.usarRespostasPersonalizadas).toBe(false);
  });

  it('sair de texto com peso 0 restaura peso 1', async () => {
    montarTemplate([
      criarItem({
        tipoRespostaCustomizada: TipoRespostaCustomizada.TEXTO,
        usarRespostasPersonalizadas: true,
        peso: 0,
        permiteFoto: false,
      }),
    ]);

    await service.configurar(TEMPLATE_ID, { alteracoes: { tipoResposta: 'numero' } }, usuario);

    const [salvo] = save.mock.calls[0][1] as TemplateItem[];
    expect(salvo.peso).toBe(1);
  });

  it('sair de texto preserva peso diferente de 0', async () => {
    montarTemplate([
      criarItem({ tipoRespostaCustomizada: TipoRespostaCustomizada.TEXTO, usarRespostasPersonalizadas: true, peso: 3 }),
    ]);

    await service.configurar(TEMPLATE_ID, { alteracoes: { tipoResposta: 'padrao' } }, usuario);

    const [salvo] = save.mock.calls[0][1] as TemplateItem[];
    expect(salvo.peso).toBe(3);
  });

  it('itemIds vazio sem grupoId → BadRequestException e nada é salvo', async () => {
    montarTemplate([criarItem()]);
    await expect(
      service.configurar(TEMPLATE_ID, { itemIds: [], alteracoes: { obrigatorio: false } }, usuario),
    ).rejects.toThrow('Selecione ao menos uma pergunta');
    expect(save).not.toHaveBeenCalled();
  });

  it('opcoes sem tipoResposta → BadRequestException', async () => {
    montarTemplate([criarItem()]);
    const dto: ConfigurarLoteDto = {
      alteracoes: { opcoes: [{ valor: 'A', fotoObrigatoria: false, observacaoObrigatoria: false }] },
    };
    await expect(service.configurar(TEMPLATE_ID, dto, usuario)).rejects.toThrow(BadRequestException);
  });

  it('alteracoes vazio → BadRequestException', async () => {
    montarTemplate([criarItem()]);
    await expect(service.configurar(TEMPLATE_ID, { alteracoes: {} }, usuario)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('itemIds e grupoId juntos → BadRequestException', async () => {
    montarTemplate([criarItem()]);
    await expect(
      service.configurar(
        TEMPLATE_ID,
        { itemIds: ['item-1'], grupoId: 'grupo-1', alteracoes: { obrigatorio: false } },
        usuario,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('itemIds de outro template → BadRequestException e save não chamado', async () => {
    montarTemplate([criarItem()]);
    await expect(
      service.configurar(
        TEMPLATE_ID,
        { itemIds: ['item-1', 'item-de-outro'], alteracoes: { obrigatorio: false } },
        usuario,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(save).not.toHaveBeenCalled();
  });

  it('grupoId de outro template → BadRequestException', async () => {
    montarTemplate([criarItem()]);
    await expect(
      service.configurar(TEMPLATE_ID, { grupoId: 'grupo-x', alteracoes: { obrigatorio: false } }, usuario),
    ).rejects.toThrow(BadRequestException);
    expect(save).not.toHaveBeenCalled();
  });

  it('escopo por grupoId afeta só itens do grupo', async () => {
    montarTemplate([criarItem(), criarItem({ id: 'item-2', grupoId: 'grupo-2' })]);
    await service.configurar(
      TEMPLATE_ID,
      { grupoId: 'grupo-1', alteracoes: { permiteObservacao: false } },
      usuario,
    );
    const salvos = save.mock.calls[0][1] as TemplateItem[];
    expect(salvos.map((i) => i.id)).toEqual(['item-1']);
  });

  it('ignora itens inativos', async () => {
    montarTemplate([criarItem(), criarItem({ id: 'item-2', ativo: false })]);
    const r = await service.configurar(TEMPLATE_ID, { alteracoes: { permiteFoto: false } }, usuario);
    const salvos = save.mock.calls[0][1] as TemplateItem[];
    expect(salvos.map((i) => i.id)).toEqual(['item-1']);
    expect(r.totalAfetados).toBe(1);
  });

  it('conta como ignorado o item em que nada mudou', async () => {
    montarTemplate([criarItem({ permiteFoto: false }), criarItem({ id: 'item-2' })]);
    const r = await service.configurar(TEMPLATE_ID, { alteracoes: { permiteFoto: false } }, usuario);
    expect(r).toMatchObject({ totalAfetados: 1, ignorados: 1 });
    expect((save.mock.calls[0][1] as TemplateItem[]).map((i) => i.id)).toEqual(['item-2']);
  });

  it('simular não chama save e devolve contagens', async () => {
    montarTemplate([
      criarItem({
        usarRespostasPersonalizadas: true,
        opcoesResposta: ['Sim', 'Não'],
        opcoesRespostaConfig: [
          { valor: 'Sim', fotoObrigatoria: false, observacaoObrigatoria: false },
          { valor: 'Não', fotoObrigatoria: false, observacaoObrigatoria: false },
        ],
      }),
      criarItem({ id: 'item-2' }),
    ]);
    auditoriaRepository.count.mockResolvedValue(3);

    const r = await service.configurar(
      TEMPLATE_ID,
      { simular: true, alteracoes: { tipoResposta: 'padrao' } },
      usuario,
    );

    expect(save).not.toHaveBeenCalled();
    expect(auditoriaRepository.count).toHaveBeenCalledWith({ where: { templateId: TEMPLATE_ID } });
    expect(r).toEqual({
      totalAfetados: 1,
      personalizadosSubstituidos: 1,
      ignorados: 1,
      auditoriasVinculadas: 3,
      simulado: true,
      respostasEmUso: [],
    });
  });

  it('usuário que não é dono → ForbiddenException', async () => {
    montarTemplate([criarItem()], 'outro-gestor');
    await expect(
      service.configurar(TEMPLATE_ID, { alteracoes: { obrigatorio: false } }, usuario),
    ).rejects.toThrow(ForbiddenException);
    expect(save).not.toHaveBeenCalled();
  });

  describe('respostas personalizadas (RN-CHK-018)', () => {
    const opcao = (valor: string, valorOriginal?: string) => ({
      valor,
      ...(valorOriginal !== undefined ? { valorOriginal } : {}),
      pontuacao: null,
      fotoObrigatoria: false,
      observacaoObrigatoria: false,
    });

    function itemPersonalizado(id: string, valores: string[]) {
      return criarItem({
        id,
        usarRespostasPersonalizadas: true,
        opcoesResposta: valores,
        opcoesRespostaConfig: valores.map((valor) => ({
          valor,
          pontuacao: null,
          fotoObrigatoria: false,
          observacaoObrigatoria: false,
        })),
      });
    }

    function lote(opcoes: ReturnType<typeof opcao>[], simular = false): ConfigurarLoteDto {
      return { simular, alteracoes: { tipoResposta: 'personalizada', opcoes } };
    }

    it('renomear propaga às respostas já dadas com um único UPDATE em CASE, na transação', async () => {
      montarTemplate([itemPersonalizado('item-1', ['Sim', 'Não']), itemPersonalizado('item-2', ['Sim', 'Não'])]);

      await service.configurar(TEMPLATE_ID, lote([opcao('Conforme', 'Sim'), opcao('Não', 'Não')]), usuario);

      expect(save).toHaveBeenCalledTimes(1);
      expect(updateQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = updateQuery.mock.calls[0];
      expect(sql).toMatch(/UPDATE auditoria_itens SET resposta = CASE/);
      expect(sql).toMatch(/WHEN resposta = \$1 AND template_item_id = ANY\(\$2\) THEN \$3/);
      expect(sql).toMatch(/ELSE resposta END/);
      expect(sql).toMatch(/WHERE template_item_id = ANY\(\$4\) AND resposta = ANY\(\$5\)/);
      expect(params).toEqual(['Sim', ['item-1', 'item-2'], 'Conforme', ['item-1', 'item-2'], ['Sim']]);
      const salvos = save.mock.calls[0][1] as TemplateItem[];
      expect(salvos[0].opcoesResposta).toEqual(['Conforme', 'Não']);
      expect(salvos[0].opcoesRespostaConfig.map((c) => c.valor)).toEqual(['Conforme', 'Não']);
      expect(salvos[0].opcoesRespostaConfig[0]).not.toHaveProperty('valorOriginal');
    });

    it('troca A↔B em um só UPDATE', async () => {
      montarTemplate([itemPersonalizado('item-1', ['A', 'B'])]);

      await service.configurar(TEMPLATE_ID, lote([opcao('B', 'A'), opcao('A', 'B')]), usuario);

      expect(updateQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = updateQuery.mock.calls[0];
      expect(sql).toMatch(/THEN \$3 WHEN resposta = \$4 AND template_item_id = ANY\(\$5\) THEN \$6/);
      expect(params).toEqual(['A', ['item-1'], 'B', 'B', ['item-1'], 'A', ['item-1'], ['A', 'B']]);
    });

    it('sem renomeação não executa UPDATE nas auditorias', async () => {
      montarTemplate([itemPersonalizado('item-1', ['A', 'B'])]);
      await service.configurar(TEMPLATE_ID, lote([opcao('B', 'B'), opcao('A', 'A')]), usuario);
      expect(save).toHaveBeenCalled();
      expect(updateQuery).not.toHaveBeenCalled();
    });

    it('remover resposta já usada → 400 e nada é salvo', async () => {
      montarTemplate([itemPersonalizado('item-1', ['Sim', 'Não', 'Talvez'])]);
      consulta.mockResolvedValue([
        { templateItemId: 'item-1', resposta: 'Talvez', auditoriaId: 'aud-1' },
        { templateItemId: 'item-1', resposta: 'Talvez', auditoriaId: 'aud-2' },
      ]);

      await expect(
        service.configurar(TEMPLATE_ID, lote([opcao('Sim', 'Sim'), opcao('Não', 'Não')]), usuario),
      ).rejects.toThrow('A resposta "Talvez" já foi usada em 2 auditorias e não pode ser removida.');
      expect(save).not.toHaveBeenCalled();
      expect(updateQuery).not.toHaveBeenCalled();
    });

    it('na simulação, remover resposta usada não bloqueia: só informa respostasEmUso', async () => {
      montarTemplate([itemPersonalizado('item-1', ['Sim', 'Não', 'Talvez'])]);
      consulta.mockResolvedValue([{ templateItemId: 'item-1', resposta: 'Talvez', auditoriaId: 'aud-1' }]);

      const r = await service.configurar(
        TEMPLATE_ID,
        lote([opcao('Sim', 'Sim'), opcao('Não', 'Não')], true),
        usuario,
      );

      expect(r.respostasEmUso).toEqual([{ valor: 'Talvez', auditorias: 1 }]);
    });

    it('remover resposta não usada é permitido', async () => {
      montarTemplate([itemPersonalizado('item-1', ['Sim', 'Não', 'Talvez'])]);
      consulta.mockResolvedValue([{ templateItemId: 'item-1', resposta: 'Sim', auditoriaId: 'aud-1' }]);

      const r = await service.configurar(TEMPLATE_ID, lote([opcao('Sim', 'Sim'), opcao('Não', 'Não')]), usuario);

      expect(r.totalAfetados).toBe(1);
      expect((save.mock.calls[0][1] as TemplateItem[])[0].opcoesResposta).toEqual(['Sim', 'Não']);
    });

    it('simulação devolve respostasEmUso com auditorias distintas', async () => {
      montarTemplate([itemPersonalizado('item-1', ['Sim', 'Não']), itemPersonalizado('item-2', ['Sim', 'Não'])]);
      consulta.mockResolvedValue([
        { templateItemId: 'item-1', resposta: 'Sim', auditoriaId: 'aud-1' },
        { templateItemId: 'item-2', resposta: 'Sim', auditoriaId: 'aud-1' },
        { templateItemId: 'item-2', resposta: 'Sim', auditoriaId: 'aud-2' },
        { templateItemId: 'item-1', resposta: 'Não', auditoriaId: 'aud-3' },
      ]);

      const r = await service.configurar(
        TEMPLATE_ID,
        lote([opcao('Sim', 'Sim'), opcao('Não', 'Não'), opcao('Talvez')], true),
        usuario,
      );

      expect(consulta).toHaveBeenCalledWith(expect.stringMatching(/FROM auditoria_itens/), [
        ['item-1', 'item-2'],
        ['Sim', 'Não'],
      ]);
      expect(r.respostasEmUso).toEqual([
        { valor: 'Sim', auditorias: 2 },
        { valor: 'Não', auditorias: 1 },
      ]);
      expect(save).not.toHaveBeenCalled();
    });

    it('respostasEmUso é vazio e não consulta quando nenhum item é personalizado', async () => {
      montarTemplate([criarItem()]);
      const r = await service.configurar(TEMPLATE_ID, { alteracoes: { permiteFoto: false } }, usuario);
      expect(r.respostasEmUso).toEqual([]);
      expect(consulta).not.toHaveBeenCalled();
    });

    it('item padrão que vira personalizado não dispara bloqueio nem renomeação', async () => {
      montarTemplate([criarItem()]);
      consulta.mockResolvedValue([{ templateItemId: 'item-1', resposta: 'conforme', auditoriaId: 'aud-1' }]);

      await service.configurar(TEMPLATE_ID, lote([opcao('Sim', 'conforme'), opcao('Não')]), usuario);

      expect(save).toHaveBeenCalled();
      expect(updateQuery).not.toHaveBeenCalled();
    });

    it('personalizada com menos de 2 respostas → 400', async () => {
      montarTemplate([itemPersonalizado('item-1', ['Sim', 'Não'])]);
      await expect(service.configurar(TEMPLATE_ID, lote([opcao('Sim', 'Sim')]), usuario)).rejects.toThrow(
        BadRequestException,
      );
      expect(save).not.toHaveBeenCalled();
    });

    it('resposta com texto vazio → 400', async () => {
      montarTemplate([itemPersonalizado('item-1', ['Sim', 'Não'])]);
      await expect(
        service.configurar(TEMPLATE_ID, lote([opcao('Sim', 'Sim'), opcao('   ', 'Não')]), usuario),
      ).rejects.toThrow(BadRequestException);
      expect(save).not.toHaveBeenCalled();
    });

    it('respostas duplicadas (ignorando espaços e maiúsculas) → 400', async () => {
      montarTemplate([itemPersonalizado('item-1', ['Sim', 'Não'])]);
      await expect(
        service.configurar(TEMPLATE_ID, lote([opcao('Sim', 'Sim'), opcao(' sim ', 'Não')]), usuario),
      ).rejects.toThrow(BadRequestException);
      expect(save).not.toHaveBeenCalled();
    });

    it('valorOriginal duplicado → 400', async () => {
      montarTemplate([itemPersonalizado('item-1', ['Sim', 'Não'])]);
      await expect(
        service.configurar(TEMPLATE_ID, lote([opcao('Sim', 'Sim'), opcao('Talvez', 'Sim')]), usuario),
      ).rejects.toThrow(BadRequestException);
      expect(save).not.toHaveBeenCalled();
    });
  });
});
