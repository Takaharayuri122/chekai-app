import * as Location from 'expo-location';
import { obterLocalizacaoRapida } from '../../utils/localizacao';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const loc = Location as jest.Mocked<typeof Location>;
const pos = (latitude: number, longitude: number) => ({ coords: { latitude, longitude } }) as any;

describe('obterLocalizacaoRapida', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    loc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);
  });

  it('retorna a última posição conhecida', async () => {
    loc.getLastKnownPositionAsync.mockResolvedValue(pos(1, 2));
    await expect(obterLocalizacaoRapida()).resolves.toEqual({ latitude: 1, longitude: 2 });
    expect(loc.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('repassa idadeMaximaMs como maxAge', async () => {
    loc.getLastKnownPositionAsync.mockResolvedValue(pos(1, 2));
    await obterLocalizacaoRapida(4000, 60000);
    expect(loc.getLastKnownPositionAsync).toHaveBeenCalledWith({ maxAge: 60000 });
    await obterLocalizacaoRapida();
    expect(loc.getLastKnownPositionAsync).toHaveBeenLastCalledWith({ maxAge: 300000 });
  });

  it('cai para a posição atual quando não há última conhecida', async () => {
    loc.getLastKnownPositionAsync.mockResolvedValue(null);
    loc.getCurrentPositionAsync.mockResolvedValue(pos(3, 4));
    await expect(obterLocalizacaoRapida()).resolves.toEqual({ latitude: 3, longitude: 4 });
  });

  it('retorna undefined sem permissão', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);
    await expect(obterLocalizacaoRapida()).resolves.toBeUndefined();
    expect(loc.getLastKnownPositionAsync).not.toHaveBeenCalled();
  });

  it('retorna undefined sem travar quando a permissão nunca resolve', async () => {
    jest.useFakeTimers();
    try {
      loc.getForegroundPermissionsAsync.mockReturnValue(new Promise(() => {}));
      const r = obterLocalizacaoRapida();
      jest.advanceTimersByTime(4000);
      await expect(r).resolves.toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });
});
