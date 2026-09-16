import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const LOGO_SIZE = 140;
const HOLD_DURATION_MS = 1100;

interface AnimatedSplashProps {
  /** Chamado quando a animação termina e a splash deve ser removida. */
  onFinish: () => void;
}

/**
 * Camada de splash animada exibida sobre o app durante o carregamento.
 * Mantém o mesmo fundo branco e logo da splash nativa, aplicando
 * fade + scale na entrada, um pulso sutil e fade-out ao revelar a UI.
 */
export function AnimatedSplash({ onFinish }: AnimatedSplashProps): JSX.Element {
  const containerOpacity = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.85);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) });
    logoScale.value = withSequence(
      withTiming(1.06, { duration: 520, easing: Easing.out(Easing.cubic) }),
      withTiming(0.97, { duration: 360, easing: Easing.inOut(Easing.quad) }),
      withTiming(1, { duration: 300, easing: Easing.inOut(Easing.quad) }),
    );
    containerOpacity.value = withDelay(
      HOLD_DURATION_MS,
      withTiming(0, { duration: 420, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onFinish)();
      }),
    );
  }, [containerOpacity, logoOpacity, logoScale, onFinish]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: containerOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, containerStyle]}>
      <Animated.Image
        source={require('../../assets/icon.png')}
        style={[styles.logo, logoStyle]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    zIndex: 999,
  },
  logo: {
    height: LOGO_SIZE,
    width: LOGO_SIZE,
  },
});
