import { describe, expect, it, vi } from 'vitest';
import { criarCacheOpcoes } from './cache-opcoes';

function adiada<T>() {
  let resolver!: (v: T) => void;
  let rejeitar!: (e: unknown) => void;
  const promessa = new Promise<T>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

describe('criarCacheOpcoes', () => {
  it('garantir busca uma vez e compartilha a lista', async () => {
    const buscar = vi.fn().mockResolvedValue(['a']);
    const cache = criarCacheOpcoes(buscar);
    await Promise.all([cache.garantir(), cache.garantir()]);
    await cache.garantir();
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(cache.obter()).toEqual({ opcoes: ['a'], carregando: false, erro: false });
  });

  it('recarregar mostra a lista antiga enquanto busca a nova', async () => {
    const buscar = vi.fn().mockResolvedValueOnce(['a']);
    const cache = criarCacheOpcoes(buscar);
    await cache.garantir();
    const nova = adiada<string[]>();
    buscar.mockReturnValueOnce(nova.promessa);
    const recarga = cache.recarregar();
    expect(cache.obter()).toEqual({ opcoes: ['a'], carregando: true, erro: false });
    nova.resolver(['a', 'b']);
    await recarga;
    expect(cache.obter().opcoes).toEqual(['a', 'b']);
  });

  it('falha marca erro, mantém a lista anterior e permite tentar de novo', async () => {
    const buscar = vi.fn().mockRejectedValueOnce(new Error('rede'));
    const cache = criarCacheOpcoes(buscar);
    await cache.garantir();
    expect(cache.obter()).toEqual({ opcoes: null, carregando: false, erro: true });
    buscar.mockResolvedValueOnce(['a']);
    await cache.recarregar();
    expect(cache.obter()).toEqual({ opcoes: ['a'], carregando: false, erro: false });
  });

  it('resetar esquece a lista e descarta a busca em andamento', async () => {
    const velha = adiada<string[]>();
    const buscar = vi.fn().mockReturnValueOnce(velha.promessa).mockResolvedValueOnce(['nova']);
    const cache = criarCacheOpcoes(buscar);
    const primeira = cache.garantir();
    cache.resetar();
    velha.resolver(['velha']);
    await primeira;
    expect(cache.obter().opcoes).toBeNull();
    await cache.garantir();
    expect(cache.obter().opcoes).toEqual(['nova']);
  });

  it('avisa os assinantes a cada mudança', async () => {
    const cache = criarCacheOpcoes(vi.fn().mockResolvedValue(['a']));
    const ouvinte = vi.fn();
    const sair = cache.assinar(ouvinte);
    await cache.garantir();
    expect(ouvinte).toHaveBeenCalled();
    sair();
    ouvinte.mockClear();
    cache.resetar();
    expect(ouvinte).not.toHaveBeenCalled();
  });
});
