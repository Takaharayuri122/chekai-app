import { useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { MapPin, Camera, Bell, CheckCircle } from 'lucide-react-native';
import { PermissionStep } from './PermissionStep';

type StepId = 'location' | 'camera' | 'notifications' | 'done';

const STEPS: StepId[] = ['location', 'camera', 'notifications', 'done'];

interface Props {
  onComplete: () => void;
}

export function PermissionOnboarding({ onComplete }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [granted, setGranted] = useState<Record<string, boolean>>({});

  const currentStep = STEPS[stepIndex];
  const advance = () => setStepIndex((i) => i + 1);

  async function handleLocation() {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    setGranted((g) => ({ ...g, location: status === 'granted' }));
    advance();
  }

  async function handleCamera() {
    const [cameraResult, libraryResult] = await Promise.all([
      ImagePicker.requestCameraPermissionsAsync(),
      ImagePicker.requestMediaLibraryPermissionsAsync(),
    ]);
    const isGranted = cameraResult.status === 'granted' || libraryResult.status === 'granted';
    setGranted((g) => ({ ...g, camera: isGranted }));
    advance();
  }

  async function handleNotifications() {
    const { status } = await Notifications.requestPermissionsAsync();
    setGranted((g) => ({ ...g, notifications: status === 'granted' }));
    advance();
  }

  const allDenied = !granted.location && !granted.camera && !granted.notifications;

  if (currentStep === 'location') {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
          <View className="h-1 bg-primary" style={{ width: '25%' }} />
        </View>
        <PermissionStep
          icon={<MapPin size={64} color="#00B8A9" />}
          title="Localização"
          description="Precisamos de acesso à sua localização, mesmo com o app fechado."
          benefit="Detectamos automaticamente quando você chega em uma unidade cliente e fazemos o check-in sem você precisar abrir o app."
          onAllow={handleLocation}
          onSkip={advance}
        />
      </SafeAreaView>
    );
  }

  if (currentStep === 'camera') {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
          <View className="h-1 bg-primary" style={{ width: '50%' }} />
        </View>
        <PermissionStep
          icon={<Camera size={64} color="#00B8A9" />}
          title="Câmera e Fotos"
          description="Precisamos de acesso à câmera e galeria de fotos."
          benefit="Registre evidências fotográficas durante as auditorias diretamente pelo app."
          onAllow={handleCamera}
          onSkip={advance}
        />
      </SafeAreaView>
    );
  }

  if (currentStep === 'notifications') {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
          <View className="h-1 bg-primary" style={{ width: '75%' }} />
        </View>
        <PermissionStep
          icon={<Bell size={64} color="#00B8A9" />}
          title="Notificações"
          description="Enviaremos alertas importantes sobre suas auditorias."
          benefit="Seja avisado sobre check-ins detectados, sincronização concluída e análises de IA disponíveis."
          onAllow={handleNotifications}
          onSkip={advance}
        />
      </SafeAreaView>
    );
  }

  // Done screen
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="absolute top-0 left-0 right-0 h-1 bg-primary" />
      <View className="flex-1 px-8 justify-center gap-6">
        <View className="items-center">
          <CheckCircle size={72} color="#00B8A9" />
        </View>
        <View className="gap-2">
          <Text className="font-display text-2xl text-neutral text-center">Tudo pronto!</Text>
          {allDenied && (
            <View className="bg-warning/10 rounded-xl p-4 mt-2">
              <Text className="font-sans text-warning text-center text-sm">
                Algumas funcionalidades estão limitadas. Você pode ajustar as permissões nas
                configurações do celular a qualquer momento.
              </Text>
            </View>
          )}
        </View>
        <View className="gap-3 mt-4">
          <Pressable onPress={onComplete} className="bg-primary rounded-xl py-4 items-center">
            <Text className="text-white font-sans-semibold text-base">Começar</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openSettings()} className="items-center py-2">
            <Text className="text-primary font-sans-medium text-sm">Ajustar permissões</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
