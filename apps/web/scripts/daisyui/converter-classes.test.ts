import { describe, expect, it } from 'vitest';
import { converterClasses as c } from './converter-classes';

const tem = (saida: string, ...classes: string[]) => classes.every((x) => saida.split(/\s+/).includes(x));
const naoTem = (saida: string, ...classes: string[]) => classes.every((x) => !saida.split(/\s+/).includes(x));

describe('botões', () => {
  it('base + variante + tamanho no mesmo literal', () => {
    const s = c('btn btn-primary btn-sm gap-2');
    expect(tem(s, 'inline-flex', 'bg-primary', 'text-primary-foreground', 'h-9', 'px-3', 'gap-2')).toBe(true);
    expect(naoTem(s, 'btn', 'btn-primary', 'btn-sm', 'h-10', 'px-4')).toBe(true);
  });
  it('quadrado e círculo', () => {
    expect(tem(c('btn btn-ghost btn-sm btn-square'), 'h-9', 'w-9', 'px-0')).toBe(true);
    expect(tem(c('btn btn-circle btn-xs'), 'h-7', 'w-7', 'rounded-full')).toBe(true);
  });
  it('outline colorido', () => {
    const s = c('btn btn-outline btn-primary');
    expect(tem(s, 'border', 'border-primary', 'text-primary')).toBe(true);
    expect(naoTem(s, 'bg-primary')).toBe(true);
  });
  it('sem variante usa fundo neutro', () => {
    expect(tem(c('btn'), 'bg-muted')).toBe(true);
  });
  it('modificador avulso vence com !important', () => {
    expect(tem(c('btn-primary'), '!bg-primary', '!text-primary-foreground')).toBe(true);
    expect(tem(c('btn-sm'), '!h-9', '!px-3')).toBe(true);
  });
});

describe('badges', () => {
  it('base + cor + tamanho', () => {
    const s = c('badge badge-success badge-sm');
    expect(tem(s, 'rounded-full', 'bg-success/12', 'text-[11px]')).toBe(true);
    expect(naoTem(s, 'badge', 'badge-success', 'badge-sm', 'text-xs')).toBe(true);
  });
  it('prefixo responsivo em modificador', () => {
    expect(tem(c('sm:badge-lg'), 'sm:!text-sm')).toBe(true);
  });
});

describe('formulários', () => {
  it('input e select com borda e tamanho', () => {
    const s = c('input input-bordered input-sm w-full');
    expect(tem(s, 'h-9', 'rounded-md', 'border', 'border-input', 'bg-card', 'w-full')).toBe(true);
    expect(naoTem(s, 'input', 'input-bordered', 'input-sm', 'h-10')).toBe(true);
    expect(tem(c('select select-bordered'), 'h-10', 'border-input')).toBe(true);
  });
  it('textarea com erro', () => {
    expect(tem(c('textarea textarea-bordered textarea-error'), 'border-destructive')).toBe(true);
  });
  it('form-control, label e label-text', () => {
    expect(c('form-control')).toBe('flex flex-col');
    expect(tem(c('label'), 'flex', 'justify-between')).toBe(true);
    expect(tem(c('label-text'), 'text-sm', 'font-medium')).toBe(true);
    expect(tem(c('label-text-alt'), 'text-xs', 'text-muted-foreground')).toBe(true);
  });
  it('checkbox e toggle', () => {
    expect(tem(c('checkbox checkbox-primary checkbox-sm'), 'accent-[hsl(175_100%_36%)]', 'h-3.5', 'w-3.5')).toBe(true);
    const t = c('toggle toggle-sm');
    expect(tem(t, 'appearance-none', 'h-4', 'w-7')).toBe(true);
    expect(naoTem(t, 'h-5', 'w-9')).toBe(true);
  });
});

describe('cards', () => {
  it('card-body ganha padding só se não houver', () => {
    expect(tem(c('card-body'), 'p-6')).toBe(true);
    const s = c('card-body p-4');
    expect(tem(s, 'p-4')).toBe(true);
    expect(naoTem(s, 'p-6')).toBe(true);
    expect(naoTem(c('card-body px-4 py-3'), 'p-6')).toBe(true);
  });
  it('card e card-title', () => {
    expect(tem(c('card bg-base-100'), 'rounded-lg', 'bg-card')).toBe(true);
    expect(tem(c('card-title'), 'font-semibold')).toBe(true);
  });
});

describe('abas, alerta, loading, tabela, progresso', () => {
  it('aba ativa no mesmo literal não mantém cor conflitante', () => {
    const s = c('tab tab-active');
    expect(tem(s, 'border-primary', 'text-foreground')).toBe(true);
    expect(naoTem(s, 'border-transparent', 'text-muted-foreground')).toBe(true);
    expect(tem(c('tab-active'), '!border-primary')).toBe(true);
  });
  it('alerta por variante', () => {
    expect(tem(c('alert alert-warning'), 'bg-warning/15', 'rounded-md')).toBe(true);
    expect(tem(c('alert alert-error'), 'text-destructive')).toBe(true);
  });
  it('loading por tamanho', () => {
    const s = c('loading loading-spinner loading-lg text-primary');
    expect(tem(s, 'animate-spin', 'h-8', 'w-8', 'text-primary')).toBe(true);
    expect(naoTem(s, 'h-5')).toBe(true);
  });
  it('tabela zebrada', () => {
    expect(tem(c('table table-zebra'), 'w-full', '[&_tbody_tr:nth-child(even)]:bg-muted/40')).toBe(true);
  });
  it('progress com cor', () => {
    expect(tem(c('progress progress-primary w-full'), '[&::-webkit-progress-value]:bg-primary', 'w-full')).toBe(true);
  });
});

describe('cores', () => {
  it('base e conteúdo', () => {
    expect(c('bg-base-100')).toBe('bg-card');
    expect(c('bg-base-200/50')).toBe('bg-muted/50');
    expect(c('border-base-300')).toBe('border-border');
    expect(c('text-base-content')).toBe('text-foreground');
    expect(c('text-base-content/60')).toBe('text-muted-foreground');
    expect(c('text-base-content/80')).toBe('text-foreground/80');
    expect(c('text-base-content/40')).toBe('text-muted-foreground/70');
    expect(c('hover:bg-base-200')).toBe('hover:bg-muted');
  });
  it('cores removidas do tema', () => {
    expect(c('text-secondary')).toBe('text-info');
    expect(c('bg-secondary/10')).toBe('bg-info/10');
    expect(c('text-error')).toBe('text-destructive');
    expect(c('hover:text-error')).toBe('hover:text-destructive');
    expect(c('text-primary-content')).toBe('text-primary-foreground');
    expect(c('text-error-content')).toBe('text-destructive-foreground');
    expect(c('bg-accent/10')).toBe('bg-warning/10');
    expect(c('from-base-100')).toBe('from-card');
  });
});

describe('preservação', () => {
  it('mantém tokens desconhecidos e interpolações', () => {
    expect(c('flex gap-2 ${ativo ? "x" : ""} mt-4')).toBe('flex gap-2 ${ativo ? "x" : ""} mt-4');
  });
  it('remove modificadores sem efeito', () => {
    expect(c('input-bordered')).toBe('');
    expect(c('select-bordered')).toBe('');
    expect(c('loading-spinner')).toBe('');
  });
});

describe('duplicadas', () => {
  it('remove classes repetidas mantendo a primeira ocorrência', () => {
    const s = c('card bg-base-100 shadow-sm border border-base-300');
    const lista = s.split(/\s+/);
    expect(lista.filter((x) => x === 'bg-card')).toHaveLength(1);
    expect(lista.filter((x) => x === 'border')).toHaveLength(1);
    expect(lista.filter((x) => x === 'border-border')).toHaveLength(1);
    expect(c('btn btn-primary gap-2').split(/\s+/).filter((x) => x === 'gap-2')).toHaveLength(1);
  });
});
