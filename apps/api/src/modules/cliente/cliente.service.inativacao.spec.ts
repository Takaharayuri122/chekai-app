import { ClienteService } from './cliente.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';

const gestor = { id: 'g-1', perfil: PerfilUsuario.GESTOR };

describe('ClienteService - inativação lógica', () => {
  let service: ClienteService;
  let clienteRepository: { findOne: jest.Mock; save: jest.Mock; createQueryBuilder: jest.Mock };
  let unidadeRepository: { findOne: jest.Mock; save: jest.Mock };
  let queryBuilder: Record<string, jest.Mock>;
  let desvinculoRepository: { create: jest.Mock; save: jest.Mock };

  beforeEach(() => {
    queryBuilder = {};
    desvinculoRepository = { create: jest.fn((v) => v), save: jest.fn(async (v) => v) };
    for (const metodo of ['leftJoinAndSelect', 'innerJoin', 'andWhere', 'orderBy', 'skip', 'take']) {
      queryBuilder[metodo] = jest.fn().mockReturnValue(queryBuilder);
    }
    queryBuilder.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
    clienteRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'c-1', gestorId: 'g-1', ativo: true, unidades: [], auditores: [] }),
      save: jest.fn(async (v) => v),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    unidadeRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'u-1',
        ativo: true,
        cliente: { id: 'c-1', gestorId: 'g-1', auditores: [] },
        auditores: [],
      }),
      save: jest.fn(async (v) => v),
    };
    service = new ClienteService(
      clienteRepository as never,
      unidadeRepository as never,
      {} as never,
      {} as never,
      desvinculoRepository as never,
      {} as never,
    );
  });

  it('inativa o cliente sem remover dados', async () => {
    const cliente = await service.definirAtivoCliente('c-1', false, gestor);
    expect(cliente.ativo).toBe(false);
    expect(clienteRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'c-1', ativo: false }));
  });

  it('reativa o cliente', async () => {
    clienteRepository.findOne.mockResolvedValue({ id: 'c-1', gestorId: 'g-1', ativo: false, unidades: [], auditores: [] });
    const cliente = await service.definirAtivoCliente('c-1', true, gestor);
    expect(cliente.ativo).toBe(true);
  });

  it('inativa e reativa a unidade', async () => {
    expect((await service.definirAtivoUnidade('u-1', false, gestor)).ativo).toBe(false);
    expect((await service.definirAtivoUnidade('u-1', true, gestor)).ativo).toBe(true);
  });

  it.each([
    ['ativos', true],
    ['inativos', false],
  ] as const)('filtra a listagem por status %s', async (status, ativo) => {
    await service.listarClientes({ page: 1, limit: 10, status }, gestor);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('cliente.ativo = :ativo', { ativo });
  });

  it('lista todos os clientes quando o status não é informado', async () => {
    await service.listarClientes({ page: 1, limit: 10 }, gestor);
    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith('cliente.ativo = :ativo', expect.anything());
  });

  it('grava inativadoEm ao inativar e limpa ao reativar o cliente', async () => {
    const inativo = await service.definirAtivoCliente('c-1', false, gestor);
    expect(inativo.inativadoEm).toBeInstanceOf(Date);
    const ativo = await service.definirAtivoCliente('c-1', true, gestor);
    expect(ativo.inativadoEm).toBeNull();
  });

  it('grava inativadoEm ao inativar e limpa ao reativar a unidade', async () => {
    expect((await service.definirAtivoUnidade('u-1', false, gestor)).inativadoEm).toBeInstanceOf(Date);
    expect((await service.definirAtivoUnidade('u-1', true, gestor)).inativadoEm).toBeNull();
  });

  describe('atualizarCliente - desvínculo de auditores', () => {
    const auditor = (id: string) => ({ id, perfil: PerfilUsuario.AUDITOR, gestorId: 'g-1' });

    beforeEach(() => {
      clienteRepository.findOne.mockResolvedValue({
        id: 'c-1',
        gestorId: 'g-1',
        ativo: true,
        unidades: [],
        auditores: [auditor('a-1'), auditor('a-2')],
      });
      jest.spyOn(service as never, 'buscarEValidarAuditores').mockResolvedValue([auditor('a-2')] as never);
      jest
        .spyOn(service as never, 'verificarAuditoriasAbertasDosAuditores')
        .mockResolvedValue({ temAuditoriasAbertas: false, quantidade: 0 } as never);
    });

    it('registra um desvínculo para cada auditor removido ao salvar', async () => {
      await service.atualizarCliente('c-1', { auditorIds: ['a-2'] }, gestor);
      expect(desvinculoRepository.save).toHaveBeenCalledTimes(1);
      expect(desvinculoRepository.save.mock.calls[0][0]).toEqual([
        expect.objectContaining({ clienteId: 'c-1', auditorId: 'a-1' }),
      ]);
    });

    it('não registra desvínculo quando devolve o aviso sem salvar', async () => {
      jest
        .spyOn(service as never, 'verificarAuditoriasAbertasDosAuditores')
        .mockResolvedValue({ temAuditoriasAbertas: true, quantidade: 1 } as never);
      const r = await service.atualizarCliente('c-1', { auditorIds: ['a-2'] }, gestor);
      expect(r.warning).toBeDefined();
      expect(desvinculoRepository.save).not.toHaveBeenCalled();
    });

    it('não registra desvínculo quando ninguém é removido', async () => {
      (service as never as { buscarEValidarAuditores: jest.Mock }).buscarEValidarAuditores.mockResolvedValue([
        auditor('a-1'),
        auditor('a-2'),
      ]);
      await service.atualizarCliente('c-1', { auditorIds: ['a-1', 'a-2'] }, gestor);
      expect(desvinculoRepository.save).not.toHaveBeenCalled();
    });
  });
});
