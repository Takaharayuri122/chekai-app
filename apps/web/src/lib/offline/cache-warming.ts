import { TipoAtividade } from '../api';
import { listarClientes, listarTemplatesPorTipo } from './data-layer';

// Rotas cujo HTML deve estar disponível offline após o login
const ROTAS_CRITICAS = [
  '/admin/auditorias',
  '/admin/auditoria/nova',
  '/admin/dashboard',
];

/**
 * Aquece o cache de dados (IndexedDB) buscando todos os templates e clientes.
 * Usa o data-layer existente que já persiste no IndexedDB automaticamente.
 */
async function aquecerDados(): Promise<void> {
  const tipos = Object.values(TipoAtividade);
  await Promise.all([
    listarClientes().catch(() => {}),
    ...tipos.map((tipo) => listarTemplatesPorTipo(tipo).catch(() => {})),
  ]);
}

/**
 * Aquece o SW Cache API buscando o HTML de cada rota crítica.
 * O SW (StaleWhileRevalidate) intercepta o fetch e salva no "pages-cache".
 * cache: 'reload' força a busca na rede mesmo que já haja cache, garantindo conteúdo fresco.
 */
async function aquecerHtml(): Promise<void> {
  await Promise.all(
    ROTAS_CRITICAS.map((rota) =>
      fetch(rota, { cache: 'reload' }).catch(() => {})
    )
  );
}

/**
 * Dispara o cache warming completo após o login.
 * Silencioso: erros são ignorados — o warming não é crítico para o login.
 * Idempotente: pode ser chamado múltiplas vezes sem efeitos colaterais.
 */
export async function esquentarCachePostLogin(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!navigator.onLine) return;

  // Executa em paralelo, sem bloquear a UI
  await Promise.all([aquecerDados(), aquecerHtml()]);
}
