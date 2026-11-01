import NetInfo from '@react-native-community/netinfo';
import { temInternet } from '../../utils/conexao';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn() },
}));

const fetchMock = NetInfo.fetch as jest.Mock;

describe('temInternet', () => {
  it('falso sem conexão', async () => {
    fetchMock.mockResolvedValue({ isConnected: false, isInternetReachable: false });
    expect(await temInternet()).toBe(false);
  });

  it('falso com rede conectada e isInternetReachable false', async () => {
    fetchMock.mockResolvedValue({ isConnected: true, isInternetReachable: false });
    expect(await temInternet()).toBe(false);
  });

  it('verdadeiro com isInternetReachable null (iOS ainda medindo)', async () => {
    fetchMock.mockResolvedValue({ isConnected: true, isInternetReachable: null });
    expect(await temInternet()).toBe(true);
  });
});
