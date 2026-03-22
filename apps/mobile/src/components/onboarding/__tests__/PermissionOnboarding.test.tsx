import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PermissionOnboarding } from '../PermissionOnboarding';

jest.mock('expo-location', () => ({
  requestBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));
jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('lucide-react-native', () => ({
  MapPin: () => null,
  Camera: () => null,
  Bell: () => null,
  CheckCircle: () => null,
}));

describe('PermissionOnboarding', () => {
  it('deve exibir primeiro passo de localização', () => {
    const { getAllByText } = render(<PermissionOnboarding onComplete={jest.fn()} />);
    expect(getAllByText(/localização/i).length).toBeGreaterThan(0);
  });

  it('deve avançar para próximo passo ao permitir', async () => {
    const { getByText, getAllByText } = render(<PermissionOnboarding onComplete={jest.fn()} />);
    fireEvent.press(getByText('Permitir'));
    await new Promise((r) => setTimeout(r, 0));
    expect(getAllByText(/câmera/i).length).toBeGreaterThan(0);
  });

  it('deve chamar onComplete ao finalizar', async () => {
    const onComplete = jest.fn();
    const { getByText } = render(<PermissionOnboarding onComplete={onComplete} />);

    for (let i = 0; i < 3; i++) {
      fireEvent.press(getByText('Permitir'));
      await new Promise((r) => setTimeout(r, 0));
    }
    fireEvent.press(getByText('Começar'));
    expect(onComplete).toHaveBeenCalled();
  });
});
