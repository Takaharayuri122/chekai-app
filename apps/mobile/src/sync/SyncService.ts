// apps/mobile/src/sync/SyncService.ts
import NetInfo from '@react-native-community/netinfo';
import { pullAll } from './pull';

let _syncInProgress = false;

export const SyncService = {
  async sync(): Promise<void> {
    if (_syncInProgress) return;

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return;

    _syncInProgress = true;
    try {
      await pullAll();
      // push será adicionado no Plano 2
    } catch (error) {
      console.error('[SyncService] Erro no sync:', error);
    } finally {
      _syncInProgress = false;
    }
  },

  isOnline(): Promise<boolean> {
    return NetInfo.fetch().then((s) => !!s.isConnected);
  },
};
