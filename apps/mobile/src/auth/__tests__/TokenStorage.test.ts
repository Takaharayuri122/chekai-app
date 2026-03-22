import { TokenStorage } from '../TokenStorage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const SecureStore = require('expo-secure-store');

describe('TokenStorage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve salvar token de acesso', async () => {
    await TokenStorage.setAccessToken('my-token');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'my-token');
  });

  it('deve recuperar token de acesso', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce('my-token');
    const token = await TokenStorage.getAccessToken();
    expect(token).toBe('my-token');
  });

  it('deve retornar null quando token não existe', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce(null);
    const token = await TokenStorage.getAccessToken();
    expect(token).toBeNull();
  });

  it('deve limpar todos os tokens no logout', async () => {
    await TokenStorage.clear();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_user');
  });
});
