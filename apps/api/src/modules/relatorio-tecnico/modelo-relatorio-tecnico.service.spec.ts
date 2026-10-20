import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { ModeloRelatorioTecnicoService } from './modelo-relatorio-tecnico.service';
import { ModeloSecao, mesclarComPadrao, modeloPadrao } from './modelo-secoes';

const PERSONALIZADO: ModeloSecao[] = [
  { secao: 'avaliacaoTecnica', ativa: false, titulo: '' },
  { secao: 'recomendacoesConsultora', ativa: true, titulo: 'Retorno do Cliente' },
];

function criarService(opcoes: {
  registro?: { gestorId: string; secoes: ModeloSecao[] } | null;
  permite?: boolean | null; // null = sem assinatura
  perfilDono?: PerfilUsuario;
}) {
  const modeloRepo = {
    findOne: jest.fn().mockResolvedValue(opcoes.registro ?? null),
    save: jest.fn().mockImplementation(async (e) => e),
    create: jest.fn().mockImplementation((e) => e),
    delete: jest.fn(),
  };
  const usuarioRepo = {
    findOne: jest.fn().mockResolvedValue({ perfil: opcoes.perfilDono ?? PerfilUsuario.GESTOR }),
  };
  const assinaturaService = {
    buscarAssinaturaAtivaComValidacao: jest
      .fn()
      .mockResolvedValue(
        opcoes.permite === null || opcoes.permite === undefined
          ? null
          : { plano: { permiteModeloRelatorioTecnico: opcoes.permite } },
      ),
  };
  const service = new ModeloRelatorioTecnicoService(
    modeloRepo as never,
    usuarioRepo as never,
    assinaturaService as never,
  );
  return { service, modeloRepo, usuarioRepo, assinaturaService };
}

const gestor = { id: 'g1', perfil: PerfilUsuario.GESTOR, gestorId: null };
const auditor = { id: 'a1', perfil: PerfilUsuario.AUDITOR, gestorId: 'g1' };

describe('ModeloRelatorioTecnicoService', () => {
  describe('resolverDono', () => {
    const { service } = criarService({});
    it('AUDITOR usa o gestor', () => expect(service.resolverDono(auditor)).toBe('g1'));
    it('AUDITOR sem gestor não tem dono', () =>
      expect(service.resolverDono({ ...auditor, gestorId: null })).toBeNull());
    it('GESTOR é o próprio dono', () => expect(service.resolverDono(gestor)).toBe('g1'));
    it('MASTER é o próprio dono', () =>
      expect(service.resolverDono({ id: 'm1', perfil: PerfilUsuario.MASTER })).toBe('m1'));
  });

  describe('obterVigente', () => {
    it('sem registro devolve o padrão', async () => {
      const { service } = criarService({ registro: null, permite: true });
      expect(await service.obterVigente('g1')).toEqual(modeloPadrao());
    });

    it('com registro e plano com o recurso devolve o modelo mesclado', async () => {
      const { service } = criarService({ registro: { gestorId: 'g1', secoes: PERSONALIZADO }, permite: true });
      expect(await service.obterVigente('g1')).toEqual(mesclarComPadrao(PERSONALIZADO));
    });

    it('com registro e plano sem o recurso devolve o padrão e mantém o registro', async () => {
      const { service, modeloRepo } = criarService({
        registro: { gestorId: 'g1', secoes: PERSONALIZADO },
        permite: false,
      });
      expect(await service.obterVigente('g1')).toEqual(modeloPadrao());
      expect(modeloRepo.delete).not.toHaveBeenCalled();
      expect(modeloRepo.save).not.toHaveBeenCalled();
    });

    it('sem assinatura devolve o padrão', async () => {
      const { service } = criarService({ registro: { gestorId: 'g1', secoes: PERSONALIZADO }, permite: null });
      expect(await service.obterVigente('g1')).toEqual(modeloPadrao());
    });

    it('sem dono devolve o padrão', async () => {
      const { service } = criarService({ registro: { gestorId: 'g1', secoes: PERSONALIZADO }, permite: true });
      expect(await service.obterVigente(null)).toEqual(modeloPadrao());
    });

    it('dono MASTER não depende de assinatura', async () => {
      const { service } = criarService({
        registro: { gestorId: 'm1', secoes: PERSONALIZADO },
        permite: null,
        perfilDono: PerfilUsuario.MASTER,
      });
      expect(await service.obterVigente('m1')).toEqual(mesclarComPadrao(PERSONALIZADO));
    });
  });

  describe('salvar', () => {
    it('AUDITOR não pode salvar', async () => {
      const { service } = criarService({ permite: true });
      await expect(service.salvar(auditor, PERSONALIZADO)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('GESTOR sem o recurso no plano recebe 403 com mensagem clara', async () => {
      const { service } = criarService({ permite: false });
      await expect(service.salvar(gestor, PERSONALIZADO)).rejects.toThrow(
        new ForbiddenException('Seu plano atual não inclui a personalização do relatório técnico.'),
      );
    });

    it('GESTOR com o recurso e modelo inválido recebe 400', async () => {
      const { service } = criarService({ permite: true });
      const invalido = [{ secao: 'avaliacaoTecnica', ativa: true, titulo: 'a'.repeat(61) }] as ModeloSecao[];
      await expect(service.salvar(gestor, invalido)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('GESTOR com o recurso salva (upsert por gestor) e devolve o mesclado', async () => {
      const { service, modeloRepo } = criarService({
        registro: { gestorId: 'g1', secoes: [] },
        permite: true,
      });
      const resposta = await service.salvar(gestor, PERSONALIZADO);
      expect(modeloRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ gestorId: 'g1', secoes: mesclarComPadrao(PERSONALIZADO) }),
      );
      expect(resposta).toEqual({ secoes: mesclarComPadrao(PERSONALIZADO), podePersonalizar: true });
    });

    it('MASTER sem assinatura salva', async () => {
      const { service, modeloRepo } = criarService({ permite: null, perfilDono: PerfilUsuario.MASTER });
      await service.salvar({ id: 'm1', perfil: PerfilUsuario.MASTER }, PERSONALIZADO);
      expect(modeloRepo.save).toHaveBeenCalled();
    });
  });

  it('obterParaUsuario de AUDITOR devolve o modelo do gestor sem permissão de personalizar', async () => {
    const { service } = criarService({ registro: { gestorId: 'g1', secoes: PERSONALIZADO }, permite: true });
    expect(await service.obterParaUsuario(auditor)).toEqual({
      secoes: mesclarComPadrao(PERSONALIZADO),
      podePersonalizar: false,
    });
  });
});
