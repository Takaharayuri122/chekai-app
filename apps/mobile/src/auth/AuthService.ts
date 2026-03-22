import { apiPost } from '../api/client';
import { TokenStorage } from './TokenStorage';
import type { LoginResponse } from '@meta-app/shared';

export const AuthService = {
  async solicitarOtp(email: string): Promise<{ message: string }> {
    return apiPost<{ message: string }>('/auth/solicitar-otp', { email });
  },

  async validarOtp(email: string, codigo: string): Promise<LoginResponse> {
    const response = await apiPost<LoginResponse>('/auth/validar-otp', { email, codigo });
    await TokenStorage.setAccessToken(response.accessToken);
    await TokenStorage.setUser(response.usuario);
    return response;
  },

  async logout(): Promise<void> {
    await TokenStorage.clear();
  },
};
