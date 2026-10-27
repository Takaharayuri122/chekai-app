'use client';

import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { TipoRespostaCustomizada, type AuditoriaItem } from '@/lib/api';
import { renderEmoji } from '@/lib/emoji';
import { cn } from '@/lib/cn';
import { classeDoSentido, sentidoDaOpcao } from '@/lib/checklist/sentido';
import { emojiDoIcone } from '@/components/checklist/seletor-sentido-icone.logic';
import { Input } from '@/components/ui/shadcn/input';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { CampoAssinatura } from './campo-assinatura';

interface RespostasItemProps {
  item: AuditoriaItem;
  valorCustomizado: string;
  somenteLeitura: boolean;
  onResponder: (valor: string) => void;
  onAlterarCustomizado: (valor: string) => void;
  onConfirmarCustomizado: (valor: string) => void;
}

const BOTAO = 'flex min-h-[48px] items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

export function RespostasItem({ item, valorCustomizado, somenteLeitura, onResponder, onAlterarCustomizado, onConfirmarCustomizado }: RespostasItemProps) {
  const t = item.templateItem;
  const valor = valorCustomizado === 'nao_avaliado' ? '' : valorCustomizado;

  if (t.tipoRespostaCustomizada === TipoRespostaCustomizada.TEXTO) {
    return (
      <Textarea
        rows={3}
        placeholder="Digite sua resposta…"
        value={valor}
        disabled={somenteLeitura}
        onChange={(e) => onAlterarCustomizado(e.target.value)}
        onBlur={(e) => onConfirmarCustomizado(e.target.value)}
      />
    );
  }
  if (t.tipoRespostaCustomizada === TipoRespostaCustomizada.NUMERO) {
    return (
      <Input
        type="number"
        inputMode="decimal"
        placeholder="Digite um número…"
        value={Number.isNaN(Number(valor)) ? '' : valor}
        disabled={somenteLeitura}
        onChange={(e) => onAlterarCustomizado(e.target.value)}
        onBlur={(e) => onConfirmarCustomizado(e.target.value)}
      />
    );
  }
  if (t.tipoRespostaCustomizada === TipoRespostaCustomizada.DATA) {
    return (
      <Input
        type="date"
        value={/^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : ''}
        disabled={somenteLeitura}
        onChange={(e) => onConfirmarCustomizado(e.target.value)}
      />
    );
  }
  if (t.tipoRespostaCustomizada === TipoRespostaCustomizada.ASSINATURA) {
    return <CampoAssinatura valor={valor} somenteLeitura={somenteLeitura} onSalvar={onConfirmarCustomizado} />;
  }
  if (t.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT) {
    const opcoes = t.opcoesResposta ?? [];
    return (
      <select
        className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
        value={opcoes.includes(valor) ? valor : ''}
        disabled={somenteLeitura}
        onChange={(e) => onConfirmarCustomizado(e.target.value)}
      >
        <option value="">Selecione uma opção</option>
        {opcoes.map((o) => (
          <option key={o} value={o}>
            {renderEmoji(o)}
          </option>
        ))}
      </select>
    );
  }

  if (t.usarRespostasPersonalizadas && t.opcoesResposta?.length) {
    return (
      <div className={cn('grid gap-2', t.opcoesResposta.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3')}>
        {t.opcoesResposta.map((opcao) => {
          const selecionada = item.resposta === opcao;
          const sentido = sentidoDaOpcao(t, opcao);
          const icone = emojiDoIcone(t.opcoesRespostaConfig?.find((c) => c.valor === opcao)?.icone);
          return (
            <button
              key={opcao}
              type="button"
              disabled={somenteLeitura}
              onClick={() => onResponder(opcao)}
              className={cn(BOTAO, classeDoSentido(selecionada ? sentido ?? 'neutra' : null))}
            >
              {icone && <span aria-hidden="true">{icone}</span>}
              <span className="truncate">{renderEmoji(opcao)}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const padrao = [
    { valor: 'conforme', rotulo: 'Conforme', icone: CheckCircle2, cor: 'border-success bg-success/12 text-[hsl(160_84%_28%)]' },
    { valor: 'nao_conforme', rotulo: 'Não conforme', icone: XCircle, cor: 'border-destructive bg-destructive/12 text-[hsl(0_72%_45%)]' },
    { valor: 'nao_aplicavel', rotulo: 'N/A', icone: MinusCircle, cor: 'border-muted-foreground/40 bg-muted text-foreground' },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {padrao.map(({ valor: v, rotulo, icone: Icone, cor }) => (
        <button
          key={v}
          type="button"
          disabled={somenteLeitura}
          onClick={() => onResponder(v)}
          className={cn(BOTAO, 'flex-col gap-1 sm:flex-row sm:gap-2', item.resposta === v ? cor : 'border-border bg-card hover:bg-muted')}
        >
          <Icone className="h-5 w-5" />
          <span className="text-xs sm:text-sm">{rotulo}</span>
        </button>
      ))}
    </div>
  );
}
