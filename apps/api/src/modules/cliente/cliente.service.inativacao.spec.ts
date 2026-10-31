import { ClienteService } from './cliente.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';

const gestor = { id: 'g-1', perfil: PerfilUsuario.GESTOR };

describe('ClienteService - inativação lógica', () => {
  let service: ClienteService;
  let clienteRepository: { findOne: jest.Mock; save: jest.Mock; createQueryBuilder: jest.Mock };
  let unidadeRepository: { findOne: jest.Mock; save: jest.Mock };
  let queryBuilder: Record<string, jest.Mock>;

  beforeEach(() => {
    queryBuilder = {};
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
});
