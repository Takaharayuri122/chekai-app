import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/auth';
import { PermissionOnboarding } from '../../src/components/onboarding/PermissionOnboarding';

export default function OnboardingScreen() {
  const setOnboardingCompleted = useAuthStore((s) => s.setOnboardingCompleted);

  function handleComplete() {
    setOnboardingCompleted();
    router.replace('/(app)');
  }

  return <PermissionOnboarding onComplete={handleComplete} />;
}
