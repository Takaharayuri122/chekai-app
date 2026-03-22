import { AuthService } from '../AuthService';

jest.mock('../../api/client', () => ({
  apiPost: jest.fn(),
}));

jest.mock('../TokenStorage', () => ({
  TokenStorage: {
    setAccessToken: jest.fn(),
    setUser: jest.fn(),
    clear: jest.fn(),
  },
}));

const { apiPost } = require('../../api/client');
const { TokenStorage } = require('../TokenStorage');

describe('AuthService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve solicitar OTP com email', async () => {
    apiPost.mockResolvedValueOnce({ message: 'OTP enviado' });
    await AuthService.solicitarOtp('test@test.com');
    expect(apiPost).toHaveBeenCalledWith('/auth/solicitar-otp', { email: 'test@test.com' });
  });

  it('deve validar OTP e salvar token', async () => {
    const mockResponse = {
      accessToken: 'jwt-token',
      usuario: { id: '1', nome: 'Test', email: 'test@test.com', perfil: 'auditor' },
    };
    apiPost.mockResolvedValueOnce(mockResponse);

    const result = await AuthService.validarOtp('test@test.com', '123456');

    expect(TokenStorage.setAccessToken).toHaveBeenCalledWith('jwt-token');
    expect(TokenStorage.setUser).toHaveBeenCalledWith(mockResponse.usuario);
    expect(result).toEqual(mockResponse);
  });

  it('deve limpar tokens no logout', async () => {
    await AuthService.logout();
    expect(TokenStorage.clear).toHaveBeenCalled();
  });
});
