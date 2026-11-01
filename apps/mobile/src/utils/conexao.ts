import NetInfo from '@react-native-community/netinfo';

/** True só com rede conectada e internet não comprovadamente inacessível. */
export async function temInternet(): Promise<boolean> {
  const estado = await NetInfo.fetch();
  return !!estado.isConnected && estado.isInternetReachable !== false;
}
