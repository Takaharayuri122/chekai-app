// apps/mobile/src/sync/SyncService.ts
import NetInfo from '@react-native-community/netinfo';
import { pullAll } from './pull';
import { pushPending } from './push';

let _syncInProgress = false;
let _autoSyncUnsubscribe: (() => void) | null = null;
let _wasConnected: boolean | null = null;

export const SyncService = {
  async sync(): Promise<void> {
    if (_syncInProgress) {
      console.log('[SyncService] Sync já em andamento, ignorando');
      return;
    }

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      console.log('[SyncService] Sem conexão, sync cancelado');
      return;
    }

    _syncInProgress = true;
    const inicio = Date.now();
    console.log('[SyncService] Iniciando sync...');
    try {
      console.log('[SyncService] Push pendentes...');
      await pushPending();
      console.log('[SyncService] Pull dados do servidor...');
      await pullAll();
      console.log(`[SyncService] Sync concluído em ${Date.now() - inicio}ms`);
    } catch (error) {
      console.error(`[SyncService] Erro no sync (${Date.now() - inicio}ms):`, error);
    } finally {
      _syncInProgress = false;
    }
  },

  isOnline(): Promise<boolean> {
    return NetInfo.fetch().then((s) => !!s.isConnected);
  },

  /**
   * Registra um listener de conexão que dispara o sync (push antes de pull)
   * sempre que o aparelho recupera a conexão. Idempotente: retorna o mesmo
   * cancelamento se já estiver ativo.
   */
  initAutoSync(): () => void {
    if (_autoSyncUnsubscribe) {
      return _autoSyncUnsubscribe;
    }
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = !!state.isConnected;
      if (_wasConnected === false && isConnected) {
        console.log('[SyncService] Conexão recuperada, drenando fila e atualizando dados...');
        void SyncService.sync();
      }
      _wasConnected = isConnected;
    });
    _autoSyncUnsubscribe = () => {
      unsubscribe();
      _autoSyncUnsubscribe = null;
      _wasConnected = null;
    };
    return _autoSyncUnsubscribe;
  },
};
