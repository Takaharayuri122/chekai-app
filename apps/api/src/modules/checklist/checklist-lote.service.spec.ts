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
    templateRepository = { findOne: jest.fn() };
    auditoriaRepository = { count: jest.fn().mockResolvedValue(0) };
    const itemRepository = {
      manager: { transaction: jest.fn((cb) => cb({ save })) },
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
    });
  });

  it('usuário que não é dono → ForbiddenException', async () => {
    montarTemplate([criarItem()], 'outro-gestor');
    await expect(
      service.configurar(TEMPLATE_ID, { alteracoes: { obrigatorio: false } }, usuario),
    ).rejects.toThrow(ForbiddenException);
    expect(save).not.toHaveBeenCalled();
  });
});
