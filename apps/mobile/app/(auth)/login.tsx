// apps/mobile/app/(auth)/login.tsx
import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AuthService } from '../../src/auth/AuthService';
import { useAuthStore } from '../../src/store/auth';

type Step = 'email' | 'codigo';

export default function LoginScreen() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted);

  async function handleSolicitarOtp() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await AuthService.solicitarOtp(email.trim().toLowerCase());
      setStep('codigo');
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro ao enviar código.');
    } finally {
      setLoading(false);
    }
  }

  async function handleValidarOtp() {
    if (codigo.length !== 6) return;
    setLoading(true);
    try {
      const response = await AuthService.validarOtp(email.trim().toLowerCase(), codigo);
      setUser(response.usuario);
      if (onboardingCompleted) {
        router.replace('/(app)');
      } else {
        router.replace('/(app)/onboarding');
      }
    } catch (error) {
      Alert.alert('Código inválido', error instanceof Error ? error.message : 'Código incorreto ou expirado.');
      setCodigo('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-6 justify-center">
          {/* Logo / título */}
          <View className="items-center mb-12">
            <Text className="font-display text-4xl text-primary">chekAI</Text>
            <Text className="font-sans text-gray-500 mt-2">Auditoria Alimentar</Text>
          </View>

          {step === 'email' ? (
            <View className="gap-4">
              <Text className="font-sans-semibold text-neutral text-lg">Entrar</Text>
              <Text className="font-sans text-gray-500">
                Digite seu e-mail para receber o código de acesso.
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3.5 font-sans text-neutral text-base"
                placeholder="seu@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={handleSolicitarOtp}
                returnKeyType="send"
              />
              <Pressable
                onPress={handleSolicitarOtp}
                disabled={!email.trim() || loading}
                className="bg-primary rounded-xl py-4 items-center disabled:opacity-50"
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-sans-semibold text-base">Enviar código</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View className="gap-4">
              <Text className="font-sans-semibold text-neutral text-lg">Código de acesso</Text>
              <Text className="font-sans text-gray-500">
                Enviamos um código de 6 dígitos para{'\n'}
                <Text className="text-neutral font-sans-medium">{email}</Text>
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3.5 font-sans text-neutral text-2xl text-center tracking-widest"
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                value={codigo}
                onChangeText={setCodigo}
                onSubmitEditing={handleValidarOtp}
                returnKeyType="done"
                autoFocus
              />
              <Pressable
                onPress={handleValidarOtp}
                disabled={codigo.length !== 6 || loading}
                className="bg-primary rounded-xl py-4 items-center disabled:opacity-50"
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-sans-semibold text-base">Entrar</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => { setStep('email'); setCodigo(''); }}
                className="items-center py-2"
              >
                <Text className="text-primary font-sans-medium">Usar outro e-mail</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
