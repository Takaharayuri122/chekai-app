'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { LegislacaoChunk } from '@/lib/api';

/** Trechos lidos da legislação, somente leitura, com busca e recolhível. */
export function ListaTrechos({ trechos }: { trechos: LegislacaoChunk[] }) {
  const [aberta, setAberta] = useState(false);
  const [busca, setBusca] = useState('');

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return trechos;
    return trechos.filter(
      (t) => t.conteudo.toLowerCase().includes(termo) || (t.artigo ?? '').toLowerCase().includes(termo),
    );
  }, [trechos, busca]);

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="flex min-h-[48px] w-full items-center justify-between px-4 text-left"
      >
        <span className="font-display text-base font-semibold">Trechos lidos ({trechos.length})</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${aberta ? 'rotate-180' : ''}`} />
      </button>
      {aberta && (
        <div className="space-y-3 border-t border-border p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nos trechos..."
              aria-label="Buscar nos trechos"
              className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {filtrados.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhum trecho encontrado.</p>
          ) : (
            <ul className="max-h-[480px] space-y-2 overflow-y-auto">
              {filtrados.map((t) => (
                <li key={t.id} className="rounded-md border border-border p-3">
                  {t.artigo && <p className="mb-1 text-xs font-semibold text-primary">{t.artigo}</p>}
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{t.conteudo}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
