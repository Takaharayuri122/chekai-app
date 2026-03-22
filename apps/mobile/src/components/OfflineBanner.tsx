// apps/mobile/src/components/OfflineBanner.tsx
import { useEffect, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import { syncQueue } from '../sync/SyncQueue';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const opacity = new Animated.Value(0);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !state.isConnected;
      setIsOffline(offline);
      if (offline) {
        setPendingCount(syncQueue.size());
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      } else {
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      }
    });
    return unsubscribe;
  }, []);

  if (!isOffline) return null;

  return (
    <Animated.View style={{ opacity }}>
      <View className="bg-neutral px-4 py-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <WifiOff size={14} color="white" />
          <Text className="text-white font-sans text-sm">Modo offline</Text>
        </View>
        {pendingCount > 0 && (
          <View className="flex-row items-center gap-1">
            <RefreshCw size={12} color="#9CA3AF" />
            <Text className="text-gray-400 font-sans text-xs">{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}
