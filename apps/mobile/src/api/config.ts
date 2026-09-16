import Constants from 'expo-constants';

const URL_PADRAO_LOCAL = 'http://localhost:3001/api';

/**
 * URL base da API resolvida em ordem de prioridade:
 * 1. `EXPO_PUBLIC_API_URL` — definida via `.env`/`.env.local`, permite o dev local apontar para localhost.
 * 2. `expo.extra.apiUrl` (app.json) — valor versionado de produção, sempre embutido no bundle do Archive.
 * 3. Fallback local — usado apenas se nenhuma das anteriores estiver disponível.
 */
const extraApiUrl: string | undefined = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;

export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? extraApiUrl ?? URL_PADRAO_LOCAL;
