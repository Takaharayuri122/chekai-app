import { ConflictException } from '@nestjs/common';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { RelatorioTecnico, StatusRelatorioTecnico } from './entities/relatorio-tecnico.entity';
import { ModeloSecao, mesclarComPadrao, modeloPadrao } from './modelo-secoes';
import { RelatorioTecnicoService } from './relatorio-tecnico.service';

const auditor = { id: 'a1', perfil: PerfilUsuario.AUDITOR, gestorId: 'g1', nome: 'Ana' };

const SEM_AVALIACAO = mesclarComPadrao([{ secao: 'avaliacaoTecnica', ativa: false, titulo: '' }]);
const RETORNO_CLIENTE = mesclarComPadrao([
  { secao: 'recomendacoesConsultora', ativa: true, titulo: 'Retorno do Cliente' },
]);
const SEM_APOIO = mesclarComPadrao([{ secao: 'apoioAnalitico', ativa: false, titulo: '' }]);

function relatorioBase(sobrescrever: Partial<RelatorioTecnico> = {}): RelatorioTecnico {
  return {
    id: 'r1',
    clienteId: 'c1',
    unidadeId: null,
    consultoraId: 'a1',
    consultora: { id: 'a1', perfil: PerfilUsuario.AUDITOR, gestorId: 'g1', nome: 'Ana' },
    identificacao: 'Cozinha',
    descricaoOcorrenciaHtml: '<p>desc</p>',
    avaliacaoTecnicaHtml: '<p>aval</p>',
    acoesExecutadas: ['ação'],
    recomendacoesConsultoraHtml: '<p>rec</p>',
    planoAcaoSugeridoHtml: '<p>plano</p>',
    apoioAnaliticoChekAi: null,
    modeloSecoes: null,
    status: StatusRelatorioTecnico.RASCUNHO,
    assinaturaNomeConsultora: 'Ana',
    responsavel: '',
    pdfUrl: null,
    pdfGeradoEm: null,
    fotos: [],
    ...sobrescrever,
  } as unknown as RelatorioTecnico;
}

function criarService(relatorio: RelatorioTecnico, vigente: ModeloSecao[] = modeloPadrao()) {
  const repo = {
    findOne: jest.fn().mockResolvedValue(relatorio),
    save: jest.fn().mockImplementation(async (e) => ({ ...e })),
    create: jest.fn().mockImplementation((e) => e),
  };
  const fotoRepo = {};
  const clienteService = {
    buscarClientePorId: jest.fn().mockResolvedValue({ id: 'c1' }),
    buscarUnidadePorId: jest.fn(),
  };
  const iaService = { gerarApoioAnaliticoRelatorioTecnico: jest.fn().mockResolvedValue('apoio') };
  const modeloService = {
    resolverDono: jest.fn((u: { perfil: PerfilUsuario; id: string; gestorId?: string | null }) =>
      u.perfil === PerfilUsuario.AUDITOR ? u.gestorId ?? null : u.id,
    ),
    obterVigente: jest.fn().mockResolvedValue(vigente),
  };
  const service = new RelatorioTecnicoService(
    repo as never,
    fotoRepo as never,
    clienteService as never,
    iaService as never,
    modeloService as never,
  );
  return { service, repo, iaService, modeloService };
}

describe('RelatorioTecnicoService com modelo', () => {
  it('finaliza rascunho sem a seção desligada e grava o snapshot do modelo vigente', async () => {
    const { service, repo, modeloService } = criarService(
      relatorioBase({ avaliacaoTecnicaHtml: '' }),
      SEM_AVALIACAO,
    );
    await service.atualizar('r1', { status: StatusRelatorioTecnico.FINALIZADO }, auditor);
    expect(modeloService.obterVigente).toHaveBeenCalledWith('g1');
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: StatusRelatorioTecnico.FINALIZADO, modeloSecoes: SEM_AVALIACAO }),
    );
  });

  it('recusa finalizar quando falta seção ativa, citando o título personalizado', async () => {
    const { service } = criarService(relatorioBase({ recomendacoesConsultoraHtml: '' }), RETORNO_CLIENTE);
    await expect(
      service.atualizar('r1', { status: StatusRelatorioTecnico.FINALIZADO }, auditor),
    ).rejects.toThrow(
      new ConflictException('Preencha a seção "Retorno do Cliente" antes de finalizar o relatório'),
    );
  });

  it('identificação continua obrigatória', async () => {
    const { service } = criarService(relatorioBase({ identificacao: '' }), SEM_AVALIACAO);
    await expect(
      service.atualizar('r1', { status: StatusRelatorioTecnico.FINALIZADO }, auditor),
    ).rejects.toThrow(/Identificação/);
  });

  it('reenvio de status finalizado não refaz o snapshot', async () => {
    const { service, repo, modeloService } = criarService(
      relatorioBase({ status: StatusRelatorioTecnico.FINALIZADO, modeloSecoes: SEM_AVALIACAO, avaliacaoTecnicaHtml: '' }),
      RETORNO_CLIENTE,
    );
    await service.atualizar('r1', { status: StatusRelatorioTecnico.FINALIZADO, responsavel: 'João' }, auditor);
    expect(modeloService.obterVigente).not.toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ modeloSecoes: SEM_AVALIACAO }));
  });

  it('ignora modeloSecoes enviado pelo cliente ao finalizar e ao editar finalizado', async () => {
    const forjado = mesclarComPadrao([{ secao: 'planoAcaoSugerido', ativa: false, titulo: '<b>x' }]);
    const rascunho = criarService(relatorioBase(), SEM_AVALIACAO);
    await rascunho.service.atualizar(
      'r1',
      { status: StatusRelatorioTecnico.FINALIZADO, modeloSecoes: forjado } as never,
      auditor,
    );
    expect(rascunho.repo.save).toHaveBeenCalledWith(expect.objectContaining({ modeloSecoes: SEM_AVALIACAO }));

    const finalizado = criarService(
      relatorioBase({ status: StatusRelatorioTecnico.FINALIZADO, modeloSecoes: SEM_AVALIACAO }),
    );
    await finalizado.service.atualizar('r1', { modeloSecoes: forjado } as never, auditor);
    expect(finalizado.repo.save).toHaveBeenCalledWith(expect.objectContaining({ modeloSecoes: SEM_AVALIACAO }));
  });

  it('finalizado legado sem snapshot valida com o padrão', async () => {
    const { service } = criarService(
      relatorioBase({ status: StatusRelatorioTecnico.FINALIZADO, avaliacaoTecnicaHtml: '' }),
      SEM_AVALIACAO,
    );
    await expect(service.atualizar('r1', { responsavel: 'João' }, auditor)).rejects.toThrow(
      /Avaliação Técnica/,
    );
  });

  it('salvar rascunho não valida nem grava snapshot', async () => {
    const { service, repo } = criarService(relatorioBase({ descricaoOcorrenciaHtml: '' }));
    await service.atualizar('r1', { responsavel: 'João' }, auditor);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ modeloSecoes: null }));
  });

  it('gerar apoio em rascunho não grava o modelo efetivo no snapshot', async () => {
    const { service, repo } = criarService(relatorioBase(), RETORNO_CLIENTE);
    await service.atualizarApoioAnalitico('r1', undefined, auditor);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ apoioAnaliticoChekAi: 'apoio', modeloSecoes: null }),
    );
  });

  it('apoio envia à IA só as seções de texto ativas, com os títulos do modelo', async () => {
    const modelo = mesclarComPadrao([
      { secao: 'avaliacaoTecnica', ativa: false, titulo: '' },
      { secao: 'recomendacoesConsultora', ativa: true, titulo: 'Retorno do Cliente' },
    ]);
    const { service, iaService } = criarService(relatorioBase(), modelo);
    await service.atualizarApoioAnalitico('r1', 'extra', auditor);
    expect(iaService.gerarApoioAnaliticoRelatorioTecnico).toHaveBeenCalledWith(
      {
        identificacao: 'Cozinha',
        secoes: [
          { titulo: 'Descrição da Ocorrência', conteudo: '<p>desc</p>' },
          { titulo: 'Ações Executadas na Visita', conteudo: '1. ação' },
          { titulo: 'Retorno do Cliente', conteudo: '<p>rec</p>' },
          { titulo: 'Plano de Ação Sugerido', conteudo: '<p>plano</p>' },
        ],
        nomeConsultora: 'Ana',
        contextoComplementar: 'extra',
      },
      auditor,
    );
  });

  it('apoio desligado no modelo bloqueia a geração sem chamar a IA', async () => {
    const { service, iaService } = criarService(relatorioBase(), SEM_APOIO);
    await expect(service.atualizarApoioAnalitico('r1', undefined, auditor)).rejects.toThrow(
      new ConflictException('O apoio analítico não está habilitado no modelo deste relatório.'),
    );
    expect(iaService.gerarApoioAnaliticoRelatorioTecnico).not.toHaveBeenCalled();
  });

  it('buscarComModelo devolve o modelo vigente para rascunho e o snapshot para finalizado', async () => {
    const rascunho = criarService(relatorioBase(), RETORNO_CLIENTE);
    expect((await rascunho.service.buscarComModelo('r1', auditor)).modeloEfetivo).toEqual(RETORNO_CLIENTE);
    const finalizado = criarService(
      relatorioBase({ status: StatusRelatorioTecnico.FINALIZADO, modeloSecoes: SEM_AVALIACAO }),
      RETORNO_CLIENTE,
    );
    expect((await finalizado.service.buscarComModelo('r1', auditor)).modeloEfetivo).toEqual(SEM_AVALIACAO);
  });

  it('criar sem os campos opcionais grava textos vazios e lista de ações vazia', async () => {
    const { service, repo } = criarService(relatorioBase());
    await service.criar({ clienteId: 'c1', identificacao: 'Cozinha' }, auditor);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        descricaoOcorrenciaHtml: '',
        avaliacaoTecnicaHtml: '',
        recomendacoesConsultoraHtml: '',
        planoAcaoSugeridoHtml: '',
        acoesExecutadas: [],
      }),
    );
  });
});
