import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { Unidade } from '../cliente/entities/unidade.entity';
import { CheckinService } from './checkin.service';
import { Checkin, StatusCheckin } from './entities/checkin.entity';

type RepoMock<T extends object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('CheckinService', () => {
  let service: CheckinService;
  let checkinRepository: RepoMock<Checkin>;
  let unidadeRepository: RepoMock<Unidade>;

  const usuarioAuditor = {
    id: 'usuario-1',
    perfil: PerfilUsuario.AUDITOR,
    gestorId: 'gestor-1',
  };

  beforeEach(() => {
    checkinRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findOneOrFail: jest.fn(),
    };
    unidadeRepository = {
      findOne: jest.fn(),
    };
    service = new CheckinService(
      checkinRepository as unknown as Repository<Checkin>,
      unidadeRepository as unknown as Repository<Unidade>,
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
    const checkinAtrasado: Checkin = {
      id: 'checkin-1',
      usuarioId: 'usuario-1',
      clienteId: 'cliente-1',
      unidadeId: 'unidade-1',
      status: StatusCheckin.ABERTO,
      dataCheckin: dataAntiga,
      dataCheckout: null,
      latitudeCheckin: -23.5,
      longitudeCheckin: -46.6,
      latitudeCheckout: null,
      longitudeCheckout: null,
      alerta3hEmitidoEm: null,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      usuario: {} as never,
      cliente: {} as never,
      unidade: {} as never,
    };
    (checkinRepository.findOne as jest.Mock).mockResolvedValue(checkinAtrasado);
    (checkinRepository.save as jest.Mock).mockImplementation(async (valor: Checkin) => valor);
    const resultado = await service.buscarCheckinAbertoDoUsuario('usuario-1');
    expect(resultado.checkin?.alerta3hEmitidoEm).toBeInstanceOf(Date);
    expect(resultado.isAtrasado3h).toBe(true);
    expect(checkinRepository.save).toHaveBeenCalledTimes(1);
  });

  it('deve finalizar checkin aberto com coordenadas do checkout', async () => {
    const checkinAberto: Checkin = {
      id: 'checkin-2',
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
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      usuario: {} as never,
      cliente: {} as never,
      unidade: {} as never,
    };
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
});
