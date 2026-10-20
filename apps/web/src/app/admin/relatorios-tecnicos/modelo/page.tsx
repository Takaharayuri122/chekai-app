'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, RotateCcw } from 'lucide-react';
import { AppLayout, PageHeader } from '@/components';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import { Switch } from '@/components/ui/shadcn/switch';
import { relatorioTecnicoService } from '@/lib/api';
import {
  SECOES_CONFIGURAVEIS,
  TITULO_MAXIMO,
  type ModeloSecao,
  modeloPadrao,
  validarModelo,
} from '@/lib/relatorio-tecnico/modelo-secoes';
import { useAuthStore } from '@/lib/store';
import { toastService } from '@/lib/toast';

const AVISO_SEM_RECURSO = 'Seu plano atual não inclui a personalização do relatório técnico.';

function SecaoFixa({ titulo }: { titulo: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3">
      <span className="font-medium">{titulo}</span>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        Sempre incluída
      </span>
    </li>
  );
}

export default function ModeloRelatorioTecnicoPage() {
  const router = useRouter();
  const { isAuditor } = useAuthStore();
  const [carregando, setCarregando] = useState<boolean>(true);
  const [salvando, setSalvando] = useState<boolean>(false);
  const [podePersonalizar, setPodePersonalizar] = useState<boolean>(false);
  const [secoes, setSecoes] = useState<ModeloSecao[]>(modeloPadrao());
  const [confirmarRestaurar, setConfirmarRestaurar] = useState<boolean>(false);

  useEffect(() => {
    if (isAuditor()) {
      router.replace('/admin/relatorios-tecnicos');
      return;
    }
    async function carregar(): Promise<void> {
      try {
        const resposta = await relatorioTecnicoService.buscarModelo();
        setSecoes(resposta.secoes);
        setPodePersonalizar(resposta.podePersonalizar);
      } catch {
        toastService.error('Não foi possível carregar o modelo do relatório.');
      } finally {
        setCarregando(false);
      }
    }
    void carregar();
  }, [isAuditor, router]);

  const atualizarSecao = (indice: number, alteracao: Partial<ModeloSecao>): void => {
    setSecoes((atual) => atual.map((s, i) => (i === indice ? { ...s, ...alteracao } : s)));
  };

  const salvar = async (): Promise<void> => {
    const erro = validarModelo(secoes);
    if (erro) {
      toastService.warning(erro);
      return;
    }
    setSalvando(true);
    try {
      const resposta = await relatorioTecnicoService.salvarModelo(secoes);
      setSecoes(resposta.secoes);
      toastService.success('Modelo do relatório salvo.');
    } catch {
      toastService.error('Não foi possível salvar o modelo do relatório.');
    } finally {
      setSalvando(false);
    }
  };

  const somenteLeitura = !podePersonalizar || salvando;

  return (
    <AppLayout>
      <PageHeader
        title="Modelo do relatório técnico"
        subtitle="Escolha as seções que aparecem no relatório e como cada uma se chama"
        backHref="/admin/relatorios-tecnicos"
      />

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 lg:px-8">
        {!carregando && !podePersonalizar && (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            {AVISO_SEM_RECURSO}
          </div>
        )}

        {carregando ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-20 w-full" />))}
          </div>
        ) : (
          <ul className="space-y-2">
            <SecaoFixa titulo="Identificação" />
            {secoes.map((secao, indice) => {
              const padrao = SECOES_CONFIGURAVEIS.find((s) => s.secao === secao.secao)?.tituloPadrao ?? '';
              const idInput = `titulo-${secao.secao}`;
              return (
                <li
                  key={secao.secao}
                  className={`rounded-lg border border-border bg-card px-4 py-3 shadow-sm ${secao.ativa ? '' : 'opacity-70'}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="flex shrink-0 items-center gap-2 text-sm font-medium sm:w-28">
                      <Switch
                        checked={secao.ativa}
                        disabled={somenteLeitura}
                        onCheckedChange={(ativa) => atualizarSecao(indice, { ativa })}
                        aria-label={`Incluir ${padrao}`}
                      />
                      Incluir
                    </label>
                    <div className="min-w-0 flex-1 space-y-1">
                      <Input
                        id={idInput}
                        className="h-11"
                        value={secao.titulo}
                        placeholder={padrao}
                        maxLength={TITULO_MAXIMO}
                        disabled={somenteLeitura || !secao.ativa}
                        onChange={(e) => atualizarSecao(indice, { titulo: e.target.value })}
                        aria-label={`Título da seção ${padrao}`}
                      />
                      <p className="text-xs text-muted-foreground">Padrão: {padrao}</p>
                    </div>
                  </div>
                </li>
              );
            })}
            <SecaoFixa titulo="Assinaturas" />
          </ul>
        )}

        {!carregando && podePersonalizar && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Tooltip content="Volta todas as seções para o formato original" className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={salvando}
                onClick={() => setConfirmarRestaurar(true)}
              >
                <RotateCcw className="h-4 w-4" />
                Restaurar padrão
              </Button>
            </Tooltip>
            <Tooltip content="Aplica o modelo aos relatórios em rascunho e aos próximos" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto" disabled={salvando} onClick={() => void salvar()}>
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </Tooltip>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmarRestaurar}
        onClose={() => setConfirmarRestaurar(false)}
        onConfirm={() => {
          setSecoes(modeloPadrao());
          setConfirmarRestaurar(false);
          toastService.info('Modelo padrão restaurado. Salve para aplicar.');
        }}
        title="Restaurar modelo padrão"
        message="Todas as seções voltam a ser incluídas, com os nomes originais. A alteração só vale depois de salvar."
        confirmLabel="Restaurar"
        cancelLabel="Cancelar"
        variant="info"
      />
    </AppLayout>
  );
}
