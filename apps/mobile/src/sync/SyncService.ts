// apps/mobile/src/sync/SyncService.ts
import NetInfo from '@react-native-community/netinfo';
import { pullAll } from './pull';
import { pushPending } from './push';

let _syncInProgress = false;

export const SyncService = {
  async sync(): Promise<void> {
    if (_syncInProgress) return;

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return;

    _syncInProgress = true;
    try {
      await pushPending();   // push before pull to avoid conflicts
      await pullAll();
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
