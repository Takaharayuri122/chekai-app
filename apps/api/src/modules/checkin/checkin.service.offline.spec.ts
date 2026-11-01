import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Cliente } from '../cliente/entities/cliente.entity';
import { PerfilUsuario, Usuario } from '../usuario/entities/usuario.entity';
import { Unidade } from '../cliente/entities/unidade.entity';
import {
  CheckinService,
  COMENTARIO_CHECKOUT_AUTOMATICO,
  LIMITE_CHECKOUT_AUTOMATICO_MS,
} from './checkin.service';
import { Checkin, StatusCheckin } from './entities/checkin.entity';
import { AgruparHorasCheckin } from './dto/relatorio-horas-checkin.dto';

type RepoMock<T extends object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const MIN = 60 * 1000;
const HORA = 60 * MIN;
const LOCAL_ID = '11111111-1111-4111-8111-111111111111';

function criarCheckin(parcial: Partial<Checkin> = {}): Checkin {
  return {
    id: 'checkin-1',
    localId: null,
    usuarioId: 'usuario-1',
    clienteId: 'cliente-1',
    unidadeId: 'unidade-1',
    status: StatusCheckin.ABERTO,
    dataCheckin: new Date(Date.now() - 2 * HORA),
    dataCheckout: null,
    latitudeCheckin: -23.5,
    longitudeCheckin: -46.6,
    latitudeCheckout: null,
    longitudeCheckout: null,
    alerta3hEmitidoEm: null,
    comentario: null,
    encerradoAutomaticamente: false,
    checkinOffline: false,
    checkinSincronizadoEm: null,
    checkoutOffline: false,
    checkoutSincronizadoEm: null,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    usuario: { id: 'usuario-1', nome: 'Auditor Um' } as never,
    cliente: { id: 'cliente-1', nomeFantasia: 'Cliente Um', gestorId: 'gestor-1' } as never,
    unidade: { id: 'unidade-1', nome: 'Unidade Um' } as never,
    ...parcial,
  };
}

describe('CheckinService - marcação offline', () => {
  let service: CheckinService;
  let checkinRepository: RepoMock<Checkin>;
  let unidadeRepository: RepoMock<Unidade>;

  const auditor = { id: 'usuario-1', perfil: PerfilUsuario.AUDITOR, gestorId: 'gestor-1' };
  const gestor = { id: 'gestor-1', perfil: PerfilUsuario.GESTOR, gestorId: null };

  const unidadeAtiva = (extra: Partial<Unidade> = {}) =>
    ({
      id: 'unidade-1',
      clienteId: 'cliente-1',
      ativo: true,
      inativadoEm: null,
      cliente: { id: 'cliente-1', gestorId: 'gestor-1', ativo: true, inativadoEm: null },
      ...extra,
    }) as unknown as Unidade;

  beforeEach(() => {
    checkinRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((v) => ({ id: 'novo-1', ...v })),
      save: jest.fn().mockImplementation(async (v: Checkin) => v),
      findOneOrFail: jest.fn().mockImplementation(async () => criarCheckin()),
      createQueryBuilder: jest.fn(),
    };
    unidadeRepository = { findOne: jest.fn().mockResolvedValue(unidadeAtiva()) };
    service = new CheckinService(
      checkinRepository as unknown as Repository<Checkin>,
      unidadeRepository as unknown as Repository<Unidade>,
      { find: jest.fn() } as unknown as Repository<Cliente>,
      { find: jest.fn() } as unknown as Repository<Usuario>,
    );
  });

  const base = { clienteId: 'cliente-1', unidadeId: 'unidade-1' };

  it('check-in offline usa o horário do celular e marca offline', async () => {
    const dataCheckin = new Date(Date.now() - 3 * HORA).toISOString();
    const antes = Date.now();
    await service.iniciarCheckin(auditor, {
      ...base, latitude: -23.5, longitude: -46.6, localId: LOCAL_ID, dataCheckin, offline: true,
    });
    const criado = (checkinRepository.create as jest.Mock).mock.calls[0][0];
    expect(criado.dataCheckin.toISOString()).toBe(dataCheckin);
    expect(criado.checkinOffline).toBe(true);
    expect(criado.localId).toBe(LOCAL_ID);
    expect(criado.checkinSincronizadoEm.getTime()).toBeGreaterThanOrEqual(antes);
  });

  it('check-in offline repetido com o mesmo localId devolve o mesmo registro', async () => {
    const existente = criarCheckin({ id: 'ja-existe', localId: LOCAL_ID, checkinOffline: true });
    (checkinRepository.findOne as jest.Mock).mockImplementation(async ({ where }) =>
      where.localId === LOCAL_ID ? existente : null,
    );
    const resultado = await service.iniciarCheckin(auditor, {
      ...base, localId: LOCAL_ID, dataCheckin: new Date().toISOString(), offline: true,
    });
    expect(resultado).toBe(existente);
    expect(checkinRepository.create).not.toHaveBeenCalled();
    expect(checkinRepository.save).not.toHaveBeenCalled();
  });

  it('recusa horário do celular mais de 5 min no futuro', async () => {
    const futuro = new Date(Date.now() + 10 * MIN).toISOString();
    await expect(
      service.iniciarCheckin(auditor, { ...base, dataCheckin: futuro, offline: true }),
    ).rejects.toThrow(
      new BadRequestException('O horário informado está no futuro. Verifique o relógio do celular.'),
    );
  });

  it('check-in sem localização é aceito', async () => {
    await service.iniciarCheckin(auditor, { ...base });
    const criado = (checkinRepository.create as jest.Mock).mock.calls[0][0];
    expect(criado.latitudeCheckin).toBeNull();
    expect(criado.longitudeCheckin).toBeNull();
  });

  it('check-in offline com outro aberto → 409', async () => {
    (checkinRepository.findOne as jest.Mock).mockImplementation(async ({ where }) =>
      where.status === StatusCheckin.ABERTO ? criarCheckin({ id: 'aberto' }) : null,
    );
    await expect(
      service.iniciarCheckin(auditor, {
        ...base, localId: LOCAL_ID, dataCheckin: new Date().toISOString(), offline: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('check-in offline em unidade inativada depois da marcação é aceito', async () => {
    const dataCheckin = new Date(Date.now() - 3 * HORA);
    (unidadeRepository.findOne as jest.Mock).mockResolvedValue(
      unidadeAtiva({ ativo: false, inativadoEm: new Date(Date.now() - HORA) }),
    );
    await expect(
      service.iniciarCheckin(auditor, {
        ...base, localId: LOCAL_ID, dataCheckin: dataCheckin.toISOString(), offline: true,
      }),
    ).resolves.toBeDefined();
  });

  it('check-in offline em unidade inativada antes da marcação é recusado', async () => {
    (unidadeRepository.findOne as jest.Mock).mockResolvedValue(
      unidadeAtiva({ ativo: false, inativadoEm: null }),
    );
    await expect(
      service.iniciarCheckin(auditor, {
        ...base, localId: LOCAL_ID, dataCheckin: new Date(Date.now() - HORA).toISOString(), offline: true,
      }),
    ).rejects.toThrow('Unidade não encontrada');
  });

  describe('checkout offline', () => {
    it('substitui o encerramento automático quando é anterior a ele', async () => {
      const dataCheckin = new Date(Date.now() - 20 * HORA);
      const automatico = criarCheckin({
        dataCheckin,
        status: StatusCheckin.FECHADO,
        dataCheckout: new Date(dataCheckin.getTime() + LIMITE_CHECKOUT_AUTOMATICO_MS),
        encerradoAutomaticamente: true,
        comentario: `Visita longa\n${COMENTARIO_CHECKOUT_AUTOMATICO}`,
      });
      (checkinRepository.findOne as jest.Mock).mockResolvedValue(automatico);
      const dataCheckout = new Date(dataCheckin.getTime() + 2 * HORA).toISOString();
      const resultado = await service.finalizarCheckin('checkin-1', auditor, {
        dataCheckout, offline: true, latitude: -22.9, longitude: -43.2,
      });
      expect(resultado.dataCheckout?.toISOString()).toBe(dataCheckout);
      expect(resultado.encerradoAutomaticamente).toBe(false);
      expect(resultado.checkoutOffline).toBe(true);
      expect(resultado.checkoutSincronizadoEm).toBeInstanceOf(Date);
      expect(resultado.latitudeCheckout).toBe(-22.9);
      expect(resultado.comentario).toBe('Visita longa');
    });

    it('remove o comentário automático quando era o único', async () => {
      const dataCheckin = new Date(Date.now() - 20 * HORA);
      (checkinRepository.findOne as jest.Mock).mockResolvedValue(
        criarCheckin({
          dataCheckin,
          status: StatusCheckin.FECHADO,
          dataCheckout: new Date(dataCheckin.getTime() + LIMITE_CHECKOUT_AUTOMATICO_MS),
          encerradoAutomaticamente: true,
          comentario: COMENTARIO_CHECKOUT_AUTOMATICO,
        }),
      );
      const resultado = await service.finalizarCheckin('checkin-1', auditor, {
        dataCheckout: new Date(dataCheckin.getTime() + HORA).toISOString(), offline: true,
      });
      expect(resultado.comentario).toBeNull();
      expect(resultado.latitudeCheckout).toBeNull();
    });

    it('posterior ao encerramento automático mantém o automático', async () => {
      const dataCheckin = new Date(Date.now() - 20 * HORA);
      const automatico = criarCheckin({
        dataCheckin,
        status: StatusCheckin.FECHADO,
        dataCheckout: new Date(dataCheckin.getTime() + LIMITE_CHECKOUT_AUTOMATICO_MS),
        encerradoAutomaticamente: true,
        comentario: COMENTARIO_CHECKOUT_AUTOMATICO,
      });
      (checkinRepository.findOne as jest.Mock).mockResolvedValue(automatico);
      const resultado = await service.finalizarCheckin('checkin-1', auditor, {
        dataCheckout: new Date(dataCheckin.getTime() + 15 * HORA).toISOString(), offline: true,
      });
      expect(resultado).toBe(automatico);
      expect(resultado.encerradoAutomaticamente).toBe(true);
      expect(checkinRepository.save).not.toHaveBeenCalled();
    });

    it('em check-in já encerrado por outro meio → 409 genérico', async () => {
      (checkinRepository.findOne as jest.Mock).mockResolvedValue(
        criarCheckin({
          status: StatusCheckin.FECHADO,
          dataCheckout: new Date(Date.now() - HORA),
          encerradoAutomaticamente: false,
          checkoutOffline: false,
        }),
      );
      await expect(
        service.finalizarCheckin('checkin-1', auditor, {
          dataCheckout: new Date(Date.now() - 90 * MIN).toISOString(), offline: true,
        }),
      ).rejects.toThrow(new ConflictException('Este check-in já foi encerrado.'));
    });

    it('repetido (mesmo dataCheckout) devolve sem erro', async () => {
      const dataCheckout = new Date(Date.now() - HORA);
      const fechado = criarCheckin({
        status: StatusCheckin.FECHADO, dataCheckout, checkoutOffline: true,
      });
      (checkinRepository.findOne as jest.Mock).mockResolvedValue(fechado);
      const resultado = await service.finalizarCheckin('checkin-1', auditor, {
        dataCheckout: dataCheckout.toISOString(), offline: true,
      });
      expect(resultado).toBe(fechado);
      expect(checkinRepository.save).not.toHaveBeenCalled();
    });

    it('antes do check-in → BadRequestException', async () => {
      (checkinRepository.findOne as jest.Mock).mockResolvedValue(criarCheckin());
      await expect(
        service.finalizarCheckin('checkin-1', auditor, {
          dataCheckout: new Date(Date.now() - 5 * HORA).toISOString(), offline: true,
        }),
      ).rejects.toThrow(
        new BadRequestException('A data de checkout não pode ser anterior à data de checkin.'),
      );
    });

    it('em check-in aberto usa o horário do celular e marca offline', async () => {
      (checkinRepository.findOne as jest.Mock).mockResolvedValue(criarCheckin());
      const dataCheckout = new Date(Date.now() - 30 * MIN).toISOString();
      const resultado = await service.finalizarCheckin('checkin-1', auditor, {
        dataCheckout, offline: true,
      });
      expect(resultado.status).toBe(StatusCheckin.FECHADO);
      expect(resultado.dataCheckout?.toISOString()).toBe(dataCheckout);
      expect(resultado.checkoutOffline).toBe(true);
    });
  });

  it('relatório de horas conta quantidadeOffline', async () => {
    const agora = new Date();
    const lista = [
      criarCheckin({ id: 'a', checkinOffline: true }),
      criarCheckin({ id: 'b', checkoutOffline: true, status: StatusCheckin.FECHADO, dataCheckout: agora }),
      criarCheckin({ id: 'c' }),
    ];
    (checkinRepository.createQueryBuilder as jest.Mock).mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(lista),
    });
    const relatorio = await service.relatorioHoras(
      { agruparPor: AgruparHorasCheckin.USUARIO, dataInicio: '2026-11-01', dataFim: '2026-11-01' } as never,
      gestor,
      agora,
    );
    expect(relatorio.itens[0].quantidade).toBe(3);
    expect(relatorio.itens[0].quantidadeOffline).toBe(2);
  });
});
