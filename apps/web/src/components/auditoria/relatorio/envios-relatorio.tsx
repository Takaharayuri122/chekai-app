'use client';

import { useCallback, useEffect, useState } from 'react';
import { auditoriaService, type AuditoriaEnvioRelatorio } from '@/lib/api';
import { toastService } from '@/lib/toast';
import { Button } from '@/components/ui/shadcn/button';

interface EnviosRelatorioProps {
  auditoriaId: string;
  /** Muda quando um novo envio é feito, para recarregar a lista. */
  atualizar?: number;
}

const formatarDataHora = (iso: string) => {
  const d = new Date(iso);
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${data} às ${hora}`;
};

export function EnviosRelatorio({ auditoriaId, atualizar = 0 }: EnviosRelatorioProps) {
  const [envios, setEnvios] = useState<AuditoriaEnvioRelatorio[]>([]);
  const [reenviando, setReenviando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setEnvios(await auditoriaService.listarEnviosRelatorio(auditoriaId));
    } catch {
      setEnvios([]);
    }
  }, [auditoriaId]);

  useEffect(() => {
    carregar();
  }, [carregar, atualizar]);

  const tentarDeNovo = async (envio: AuditoriaEnvioRelatorio) => {
    setReenviando(envio.id);
    try {
      const novo = await auditoriaService.enviarRelatorio(auditoriaId, envio.destinatarios);
      if (novo.sucesso) toastService.success('Relatório enviado com sucesso.');
      else toastService.error('Não foi possível enviar o relatório.');
    } catch {
      toastService.error('Não foi possível enviar o relatório.');
    } finally {
      setReenviando(null);
      carregar();
    }
  };

  if (envios.length === 0) return null;

  return (
    <ul className="space-y-1 text-sm text-muted-foreground">
      {envios.slice(0, 5).map((e) => (
        <li key={e.id} className="flex flex-wrap items-center gap-x-2">
          {e.sucesso ? (
            <span>
              Relatório enviado para {e.destinatarios.join(', ')} em {formatarDataHora(e.criadoEm)}
            </span>
          ) : (
            <>
              <span className="text-destructive">
                Falha ao enviar para {e.destinatarios.join(', ')} em {formatarDataHora(e.criadoEm)}
              </span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={reenviando === e.id}
                onClick={() => tentarDeNovo(e)}
              >
                Tentar de novo
              </Button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
