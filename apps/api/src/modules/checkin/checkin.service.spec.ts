import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Cliente } from '../cliente/entities/cliente.entity';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { Usuario } from '../usuario/entities/usuario.entity';
import { Unidade } from '../cliente/entities/unidade.entity';
import { CheckinService } from './checkin.service';
import { Checkin, StatusCheckin } from './entities/checkin.entity';
import { AgruparHorasCheckin } from './dto/relatorio-horas-checkin.dto';

type RepoMock<T extends object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

function criarCheckin(parcial: Partial<Checkin> = {}): Checkin {
  return {
    id: 'checkin-1',
    usuarioId: 'usuario-1',
    clienteId: 'cliente-1',
    unidadeId: 'unidade-1',
    status: StatusCheckin.ABERTO,
    dataCheckin: new Date(),
    dataCheckout: null,
    latitudeCheckin: -23.5,
    longitudeCheckin: -46.6,
    latitudeCheckout: null,
    longitudeCheckout: null,
    alerta3hEmitidoEm: null,
    comentario: null,
    encerradoAutomaticamente: false,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    usuario: { id: 'usuario-1', nome: 'Auditor Um' } as never,
    cliente: { id: 'cliente-1', nomeFantasia: 'Cliente Um', gestorId: 'gestor-1' } as never,
    unidade: { id: 'unidade-1', nome: 'Unidade Um' } as never,
    ...parcial,
  };
}

describe('CheckinService', () => {
  let service: CheckinService;
  let checkinRepository: RepoMock<Checkin>;
  let unidadeRepository: RepoMock<Unidade>;
  let clienteRepository: RepoMock<Cliente>;
  let usuarioRepository: RepoMock<Usuario>;

  const usuarioAuditor = {
    id: 'usuario-1',
    perfil: PerfilUsuario.AUDITOR,
    gestorId: 'gestor-1',
  };

  const usuarioGestor = {
    id: 'gestor-1',
    perfil: PerfilUsuario.GESTOR,
    gestorId: null,
  };

  const usuarioMaster = {
    id: 'master-1',
    perfil: PerfilUsuario.MASTER,
    gestorId: null,
  };

  beforeEach(() => {
    checkinRepository = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      save: jest.fn(),
      findOneOrFail: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    unidadeRepository = {
      findOne: jest.fn(),
    };
    clienteRepository = {
      find: jest.fn(),
    };
    usuarioRepository = {
      find: jest.fn(),
    };
    service = new CheckinService(
      checkinRepository as unknown as Repository<Checkin>,
      unidadeRepository as unknown as Repository<Unidade>,
      clienteRepository as unknown as Repository<Cliente>,
      usuarioRepository as unknown as Repository<Usuario>,
    );
  });

  it('deve impedir iniciar novo checkin quando já existe aberto', async () => {
    (checkinRepository.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'checkin-aberto', status: StatusCheckin.ABERTO });
    await expect(service.iniciarCheckin(usuarioAuditor, {
      clienteId: 'cliente-1',
      unidadeId: 'unidade-1',
      latitude: -23.5,
      longitude: -46.6,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deve registrar alerta quando checkin aberto estiver acima de 3 horas', async () => {
    const dataAntiga = new Date(Date.now() - (3 * 60 * 60 * 1000 + 1000));
    const checkinAtrasado = criarCheckin({
      dataCheckin: dataAntiga,
    });
    (checkinRepository.findOne as jest.Mock).mockResolvedValue(checkinAtrasado);
    (checkinRepository.save as jest.Mock).mockImplementation(async (valor: Checkin) => valor);
    const resultado = await service.buscarCheckinAbertoDoUsuario('usuario-1');
    expect(resultado.checkin?.alerta3hEmitidoEm).toBeInstanceOf(Date);
    expect(resultado.isAtrasado3h).toBe(true);
    expect(checkinRepository.save).toHaveBeenCalledTimes(1);
  });

  it('deve finalizar checkin aberto com coordenadas do checkout', async () => {
    const checkinAberto = criarCheckin({ id: 'checkin-2' });
    (checkinRepository.findOne as jest.Mock).mockResolvedValue(checkinAberto);
    (checkinRepository.save as jest.Mock).mockImplementation(async (valor: Checkin) => valor);
    const resultado = await service.finalizarCheckin('checkin-2', usuarioAuditor, {
      latitude: -22.9,
      longitude: -43.2,
    });
    expect(resultado.status).toBe(StatusCheckin.FECHADO);
    expect(resultado.latitudeCheckout).toBe(-22.9);
    expect(resultado.longitudeCheckout).toBe(-43.2);
  });

  it('deve encerrar checkin aberto há mais de 12h reusando lat/lng e gravando comentário', async () => {
    const dataCheckin = new Date(Date.now() - (12 * 60 * 60 * 1000 + 60_000));
    const expirado = criarCheckin({
      id: 'checkin-expirado',
      dataCheckin,
      latitudeCheckin: -23.55,
      longitudeCheckin: -46.63,
    });
    (checkinRepository.find as jest.Mock).mockResolvedValue([expirado]);
    (checkinRepository.save as jest.Mock).mockImplementation(async (valor: Checkin) => valor);

    const quantidade = await service.encerrarCheckinsExpirados();

    expect(quantidade).toBe(1);
    expect(expirado.status).toBe(StatusCheckin.FECHADO);
    expect(expirado.encerradoAutomaticamente).toBe(true);
    expect(expirado.latitudeCheckout).toBe(-23.55);
    expect(expirado.longitudeCheckout).toBe(-46.63);
    expect(expirado.comentario).toBe('Encerrado automaticamente após 12 horas.');
    expect(expirado.dataCheckout?.getTime()).toBe(dataCheckin.getTime() + 12 * 60 * 60 * 1000);
  });

  it('não deve encerrar checkin aberto há menos de 12h', async () => {
    (checkinRepository.find as jest.Mock).mockResolvedValue([]);
    const quantidade = await service.encerrarCheckinsExpirados();
    expect(quantidade).toBe(0);
    expect(checkinRepository.save).not.toHaveBeenCalled();
  });

  it('ao buscar checkin aberto expirado, deve encerrar automaticamente e retornar nulo', async () => {
    const dataCheckin = new Date(Date.now() - (12 * 60 * 60 * 1000 + 60_000));
    const expirado = criarCheckin({ dataCheckin });
    (checkinRepository.findOne as jest.Mock).mockResolvedValue(expirado);
    (checkinRepository.save as jest.Mock).mockImplementation(async (valor: Checkin) => valor);

    const resultado = await service.buscarCheckinAbertoDoUsuario('usuario-1');

    expect(resultado.checkin).toBeNull();
    expect(resultado.isAtrasado3h).toBe(false);
    expect(expirado.status).toBe(StatusCheckin.FECHADO);
    expect(expirado.encerradoAutomaticamente).toBe(true);
  });

  it('gestor deve editar datas e comentário de checkin no seu isolamento', async () => {
    const checkin = criarCheckin({
      status: StatusCheckin.FECHADO,
      dataCheckout: new Date('2026-09-15T18:00:00.000Z'),
    });
    (checkinRepository.findOne as jest.Mock).mockResolvedValue(checkin);
    (unidadeRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'unidade-1',
      cliente: { gestorId: 'gestor-1' },
    });
    (checkinRepository.save as jest.Mock).mockImplementation(async (valor: Checkin) => valor);

    const resultado = await service.editarCheckin('checkin-1', usuarioGestor, {
      dataCheckin: '2026-09-15T08:00:00.000Z',
      dataCheckout: '2026-09-15T12:00:00.000Z',
      comentario: 'Ajuste de horário',
    });

    expect(resultado.dataCheckin.toISOString()).toBe('2026-09-15T08:00:00.000Z');
    expect(resultado.dataCheckout?.toISOString()).toBe('2026-09-15T12:00:00.000Z');
    expect(resultado.comentario).toBe('Ajuste de horário');
  });

  it('auditor não pode editar checkin', async () => {
    await expect(service.editarCheckin('checkin-1', usuarioAuditor, {
      comentario: 'não pode',
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('gestor não pode editar checkin de cliente de outro gestor', async () => {
    const checkin = criarCheckin();
    (checkinRepository.findOne as jest.Mock).mockResolvedValue(checkin);
    (unidadeRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'unidade-1',
      cliente: { gestorId: 'gestor-outro' },
    });
    await expect(service.editarCheckin('checkin-1', usuarioGestor, {
      comentario: 'invasão',
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deve rejeitar checkout anterior ao checkin', async () => {
    const checkin = criarCheckin({
      status: StatusCheckin.FECHADO,
      dataCheckout: new Date('2026-09-15T18:00:00.000Z'),
    });
    (checkinRepository.findOne as jest.Mock).mockResolvedValue(checkin);
    (unidadeRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'unidade-1',
      cliente: { gestorId: 'gestor-1' },
    });
    await expect(service.editarCheckin('checkin-1', usuarioGestor, {
      dataCheckin: '2026-09-15T12:00:00.000Z',
      dataCheckout: '2026-09-15T08:00:00.000Z',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('não deve reabrir checkin já fechado', async () => {
    const checkin = criarCheckin({
      status: StatusCheckin.FECHADO,
      dataCheckout: new Date('2026-09-15T18:00:00.000Z'),
    });
    (checkinRepository.findOne as jest.Mock).mockResolvedValue(checkin);
    (unidadeRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'unidade-1',
      cliente: { gestorId: 'gestor-1' },
    });
    await expect(service.editarCheckin('checkin-1', usuarioGestor, {
      dataCheckout: null,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ao preencher checkout em checkin aberto, deve fechar copiando coords se vazias', async () => {
    const checkin = criarCheckin({
      dataCheckin: new Date('2026-09-15T08:00:00.000Z'),
      latitudeCheckin: -23.1,
      longitudeCheckin: -46.2,
    });
    (checkinRepository.findOne as jest.Mock).mockResolvedValue(checkin);
    (unidadeRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'unidade-1',
      cliente: { gestorId: 'gestor-1' },
    });
    (checkinRepository.save as jest.Mock).mockImplementation(async (valor: Checkin) => valor);

    const resultado = await service.editarCheckin('checkin-1', usuarioGestor, {
      dataCheckout: '2026-09-15T18:00:00.000Z',
    });

    expect(resultado.status).toBe(StatusCheckin.FECHADO);
    expect(resultado.latitudeCheckout).toBe(-23.1);
    expect(resultado.longitudeCheckout).toBe(-46.2);
  });

  it('deve agrupar total de horas por cliente incluindo abertos em andamento', async () => {
    const agora = new Date('2026-09-15T18:00:00.000Z');
    const fechado = criarCheckin({
      id: 'c1',
      status: StatusCheckin.FECHADO,
      dataCheckin: new Date('2026-09-15T08:00:00.000Z'),
      dataCheckout: new Date('2026-09-15T10:00:00.000Z'),
    });
    const aberto = criarCheckin({
      id: 'c2',
      dataCheckin: new Date('2026-09-15T16:00:00.000Z'),
    });
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([fechado, aberto]),
    };
    (checkinRepository.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const relatorio = await service.relatorioHoras(
      {
        agruparPor: AgruparHorasCheckin.CLIENTE,
        dataInicio: '2026-09-15',
        dataFim: '2026-09-15',
      },
      usuarioGestor,
      agora,
    );

    expect(relatorio.agruparPor).toBe('cliente');
    expect(relatorio.itens).toHaveLength(1);
    expect(relatorio.itens[0].nome).toBe('Cliente Um');
    expect(relatorio.itens[0].quantidade).toBe(2);
    expect(relatorio.itens[0].minutosFechados).toBe(120);
    expect(relatorio.itens[0].minutosAbertos).toBe(120);
    expect(relatorio.itens[0].minutosTotal).toBe(240);
    expect(relatorio.totalGeralMinutos).toBe(240);
  });

  it('deve agrupar total de horas por usuário', async () => {
    const agora = new Date('2026-09-15T12:00:00.000Z');
    const fechado = criarCheckin({
      status: StatusCheckin.FECHADO,
      dataCheckin: new Date('2026-09-15T08:00:00.000Z'),
      dataCheckout: new Date('2026-09-15T09:30:00.000Z'),
    });
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([fechado]),
    };
    (checkinRepository.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const relatorio = await service.relatorioHoras(
      {
        agruparPor: AgruparHorasCheckin.USUARIO,
        dataInicio: '2026-09-15',
        dataFim: '2026-09-15',
      },
      usuarioMaster,
      agora,
    );

    expect(relatorio.itens[0].nome).toBe('Auditor Um');
    expect(relatorio.itens[0].minutosTotal).toBe(90);
  });

  it('auditor não pode consultar relatório de horas', async () => {
    await expect(service.relatorioHoras(
      { agruparPor: AgruparHorasCheckin.CLIENTE, dataInicio: '2026-09-15', dataFim: '2026-09-15' },
      usuarioAuditor,
    )).rejects.toBeInstanceOf(ForbiddenException);
  });
});
