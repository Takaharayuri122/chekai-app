/**
 * Traduz classes DaisyUI para utilitários Tailwind com os tokens da marca (E1).
 * Regras de grupo (btn, badge, input…) só se aplicam quando a base está no mesmo literal;
 * modificadores avulsos (em outro literal/ternário) saem com "!" para vencer o padrão.
 */

const ACENTO = 'accent-[hsl(175_100%_36%)]';

const CORES_BOTAO: Record<string, string> = {
  primary: 'primary',
  secondary: 'info',
  accent: 'warning',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'destructive',
  neutral: 'sidebar',
};

const BTN_BASE = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50';
const BTN_TAMANHO: Record<string, string> = { xs: 'h-7 px-2 text-xs', sm: 'h-9 px-3', md: 'h-10 px-4', lg: 'h-11 px-6 text-base' };
const BTN_QUADRADO: Record<string, string> = { xs: 'h-7 w-7 px-0', sm: 'h-9 w-9 px-0', md: 'h-10 w-10 px-0', lg: 'h-11 w-11 px-0' };

function corBotao(cor: string): string {
  if (cor === 'primary') return 'bg-primary text-primary-foreground hover:bg-primary/90';
  if (cor === 'destructive') return 'bg-destructive text-destructive-foreground hover:bg-destructive/90';
  return `bg-${cor} text-white hover:bg-${cor}/90`;
}

const BADGE_BASE = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold';
const BADGE_TAMANHO: Record<string, string> = { xs: 'px-1.5 py-0 text-[10px]', sm: 'px-2 py-0.5 text-[11px]', md: 'px-2.5 py-0.5 text-xs', lg: 'px-3 py-1 text-sm' };
const BADGE_COR: Record<string, string> = {
  primary: 'bg-primary/12 text-primary',
  secondary: 'bg-info/12 text-[hsl(217_80%_45%)]',
  info: 'bg-info/12 text-[hsl(217_80%_45%)]',
  accent: 'bg-warning/15 text-[hsl(32_95%_34%)]',
  warning: 'bg-warning/15 text-[hsl(32_95%_34%)]',
  success: 'bg-success/12 text-[hsl(160_84%_28%)]',
  error: 'bg-destructive/12 text-[hsl(0_72%_45%)]',
  neutral: 'bg-sidebar text-white',
  ghost: 'bg-muted text-muted-foreground',
  outline: 'border border-border bg-transparent',
};

const CAMPO = 'rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60';
const CAMPO_TAMANHO: Record<string, string> = { xs: 'h-7 px-2 text-xs', sm: 'h-9 px-2.5 text-xs', md: 'h-10 px-3', lg: 'h-11 px-4 text-base' };

const LOADING_TAMANHO: Record<string, string> = { xs: 'h-3 w-3', sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-8 w-8' };
const LOADING_BASE = 'inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent';

const TOGGLE_TAMANHO: Record<string, string> = {
  xs: 'h-3.5 w-6 before:h-2.5 before:w-2.5 checked:before:translate-x-2.5',
  sm: 'h-4 w-7 before:h-3 before:w-3 checked:before:translate-x-3',
  md: 'h-5 w-9 before:h-4 before:w-4 checked:before:translate-x-4',
  lg: 'h-6 w-11 before:h-5 before:w-5 checked:before:translate-x-5',
};
const TOGGLE_BASE = 'relative shrink-0 cursor-pointer appearance-none rounded-full bg-muted-foreground/30 transition-colors checked:bg-primary before:absolute before:left-0.5 before:top-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform disabled:opacity-50';

const CHECK_TAMANHO: Record<string, string> = { xs: 'h-3 w-3', sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' };

const TABELA_TAMANHO: Record<string, string> = {
  xs: 'text-xs [&_th]:px-2 [&_th]:py-1.5 [&_td]:px-2 [&_td]:py-1.5',
  sm: 'text-sm [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2',
  md: 'text-sm [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-3',
  lg: 'text-base [&_th]:px-6 [&_th]:py-4 [&_td]:px-6 [&_td]:py-4',
};
const TABELA_BASE = 'w-full text-left [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground [&_tr]:border-b [&_tr]:border-border';

const ALERTA_COR: Record<string, string> = {
  info: 'border-info/30 bg-info/10',
  success: 'border-success/30 bg-success/10',
  warning: 'border-warning/40 bg-warning/15',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
};

const PROGRESSO_COR: Record<string, string> = {
  primary: 'primary',
  secondary: 'info',
  accent: 'warning',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'destructive',
};
const progresso = (cor: string) =>
  `[&::-webkit-progress-value]:bg-${cor} [&::-moz-progress-bar]:bg-${cor}`;
const PROGRESSO_BASE = 'h-2 w-full appearance-none overflow-hidden rounded-full bg-muted [&::-webkit-progress-bar]:bg-muted';

/** Classes simples, sem regras de grupo. Valor vazio = remover. */
const SIMPLES: Record<string, string> = {
  'form-control': 'flex flex-col',
  label: 'flex items-center justify-between gap-2 py-1',
  'label-text': 'text-sm font-medium text-foreground',
  'label-text-alt': 'text-xs text-muted-foreground',
  card: 'relative flex flex-col rounded-lg border border-border bg-card',
  'card-title': 'flex items-center gap-2 font-display text-lg font-semibold',
  'card-actions': 'flex flex-wrap items-start justify-end gap-2',
  'card-compact': '',
  'card-bordered': '',
  'input-bordered': '',
  'select-bordered': '',
  'textarea-bordered': '',
  'input-ghost': 'border-transparent bg-transparent',
  'input-group': 'flex items-stretch',
  'loading-spinner': '',
  'loading-dots': '',
  'loading-ring': '',
  tabs: 'flex items-center gap-1 border-b border-border',
  'tabs-bordered': '',
  'tabs-lifted': '',
  'tabs-boxed': '',
  steps: 'flex w-full gap-2',
  step: 'flex-1 text-center text-xs text-muted-foreground',
  'step-primary': '!font-semibold !text-primary',
  join: 'inline-flex items-stretch [&>*]:rounded-none [&>*:first-child]:rounded-l-md [&>*:last-child]:rounded-r-md',
  'join-item': '',
  divider: 'my-4 flex items-center gap-4 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border',
  stats: 'grid rounded-lg border border-border bg-card',
  stat: 'flex flex-col gap-1 p-4',
  'stat-title': 'text-sm text-muted-foreground',
  'stat-value': 'font-display text-3xl font-semibold',
  'stat-desc': 'text-xs text-muted-foreground',
  'stat-figure': 'float-right',
  'table-zebra': '[&_tbody_tr:nth-child(even)]:bg-muted/40',
  kbd: 'rounded border border-border bg-muted px-1.5 text-[11px] font-medium',
  link: 'cursor-pointer underline underline-offset-2',
  'link-primary': 'text-primary',
  'link-hover': 'no-underline hover:underline',
  'rounded-box': 'rounded-lg',
  avatar: 'relative inline-flex',
  placeholder: '[&>div]:flex [&>div]:items-center [&>div]:justify-center',
  radio: `h-4 w-4 cursor-pointer ${ACENTO}`,
  range: `w-full cursor-pointer ${ACENTO}`,
  'range-sm': '',
  'range-xs': '',
  'btn-block': 'w-full',
  'btn-wide': 'w-64',
  'btn-disabled': 'pointer-events-none opacity-50',
  'btn-active': 'bg-muted',
  'btn-link': 'text-primary underline-offset-4 hover:underline',
};

const PREFIXO = /^((?:[a-z0-9-]+:|\[[^\]]+\]:)*)(.*)$/;

function prefixar(prefixo: string, classes: string): string {
  if (!prefixo) return classes;
  return classes
    .split(/\s+/)
    .filter(Boolean)
    .map((cl) => (cl.startsWith('!') ? `${prefixo}!${cl.slice(1)}` : `${prefixo}${cl}`))
    .join(' ');
}

const importante = (classes: string) =>
  classes
    .split(/\s+/)
    .filter(Boolean)
    .map((cl) => {
      const idx = cl.lastIndexOf(':');
      if (idx < 0) return `!${cl}`;
      return `${cl.slice(0, idx + 1)}!${cl.slice(idx + 1)}`;
    })
    .join(' ');

function converterCor(core: string): string | null {
  const m = core.match(/^([a-z]+(?:-[a-z]+)?)-(base-100|base-200|base-300|base-content|primary-content|secondary-content|accent-content|neutral-content|error-content|success-content|warning-content|info-content|secondary|accent|neutral|error)(\/\d+)?$/);
  if (!m) return null;
  const [, prop, cor, alfa = ''] = m;
  const propsValidas = ['bg', 'text', 'border', 'ring', 'from', 'to', 'via', 'fill', 'stroke', 'outline', 'divide', 'placeholder', 'shadow', 'border-t', 'border-b', 'border-l', 'border-r', 'ring-offset', 'decoration', 'caret', 'accent'];
  if (!propsValidas.includes(prop)) return null;
  if (cor === 'base-content') {
    if (prop === 'text' && alfa) {
      const n = Number(alfa.slice(1));
      if (n >= 75) return `text-foreground${alfa}`;
      if (n >= 50) return 'text-muted-foreground';
      if (n >= 40) return 'text-muted-foreground/70';
      if (n >= 30) return 'text-muted-foreground/50';
      return 'text-muted-foreground/40';
    }
    return `${prop}-foreground${alfa}`;
  }
  const mapa: Record<string, string> = {
    'base-100': 'card',
    'base-200': 'muted',
    'base-300': prop === 'bg' ? 'border' : 'border',
    'primary-content': 'primary-foreground',
    'error-content': 'destructive-foreground',
    'secondary-content': 'white',
    'accent-content': 'white',
    'neutral-content': 'white',
    'success-content': 'white',
    'warning-content': 'white',
    'info-content': 'white',
    secondary: 'info',
    accent: 'warning',
    neutral: 'sidebar',
    error: 'destructive',
  };
  const destino = mapa[cor];
  return `${prop}-${destino}${destino === 'white' ? '' : alfa}`;
}

const tamanhoDe = (tokens: string[], base: string) => {
  for (const t of ['xs', 'sm', 'md', 'lg']) if (tokens.includes(`${base}-${t}`)) return t;
  return 'md';
};
const temPadding = (tokens: string[]) => tokens.some((t) => /^(p|px|py|pt|pb|pl|pr)-/.test(t));

export function converterClasses(classes: string): string {
  if (!classes.trim()) return classes;
  // Interpolações ${...} viram tokens opacos (podem conter espaços)
  const partes = classes.match(/\$\{[^}]*\}|\S+/g) ?? [];
  const tokens = partes;
  const nus = tokens.filter((t) => !t.startsWith('${') && !t.includes(':'));
  const consumidos = new Set<string>();
  const saida: string[] = [];

  const consumir = (...ts: string[]) => ts.forEach((t) => consumidos.add(t));

  // Grupos com base presente no mesmo literal
  if (nus.includes('btn')) {
    const tam = tamanhoDe(nus, 'btn');
    const quadrado = nus.includes('btn-square') || nus.includes('btn-circle');
    const outline = nus.includes('btn-outline');
    const ghost = nus.includes('btn-ghost');
    const corKey = Object.keys(CORES_BOTAO).find((k) => nus.includes(`btn-${k}`));
    let variante = 'bg-muted text-foreground hover:bg-muted/80';
    if (ghost) variante = 'hover:bg-muted';
    if (corKey) variante = corBotao(CORES_BOTAO[corKey]);
    if (outline) variante = corKey ? `border border-${CORES_BOTAO[corKey]} bg-transparent text-${CORES_BOTAO[corKey]} hover:bg-${CORES_BOTAO[corKey]} hover:text-white` : 'border border-input bg-card hover:bg-muted';
    const forma = quadrado ? `${BTN_QUADRADO[tam]}${nus.includes('btn-circle') ? ' rounded-full' : ''}` : BTN_TAMANHO[tam];
    saida.push(`${BTN_BASE} ${forma} ${variante}`);
    consumir('btn', 'btn-xs', 'btn-sm', 'btn-md', 'btn-lg', 'btn-square', 'btn-circle', 'btn-outline', 'btn-ghost', ...Object.keys(CORES_BOTAO).map((k) => `btn-${k}`));
  }
  if (nus.includes('badge')) {
    const tam = tamanhoDe(nus, 'badge');
    const cores = Object.keys(BADGE_COR).filter((k) => nus.includes(`badge-${k}`));
    const cor = cores.length ? cores.map((k) => BADGE_COR[k]).join(' ') : 'bg-muted text-foreground';
    saida.push(`${BADGE_BASE} ${BADGE_TAMANHO[tam]} ${cor}`);
    consumir('badge', 'badge-xs', 'badge-sm', 'badge-md', 'badge-lg', ...Object.keys(BADGE_COR).map((k) => `badge-${k}`));
  }
  for (const campo of ['input', 'select'] as const) {
    if (nus.includes(campo)) {
      const tam = tamanhoDe(nus, campo);
      const erro = nus.includes(`${campo}-error`) ? ' border-destructive' : '';
      saida.push(`${CAMPO} ${CAMPO_TAMANHO[tam]}${erro}`.replace('border-input border-destructive', 'border-destructive'));
      consumir(campo, `${campo}-xs`, `${campo}-sm`, `${campo}-md`, `${campo}-lg`, `${campo}-error`, `${campo}-primary`);
    }
  }
  if (nus.includes('textarea')) {
    const erro = nus.includes('textarea-error');
    saida.push(`min-h-[80px] px-3 py-2 ${CAMPO}${erro ? ' border-destructive' : ''}`);
    consumir('textarea', 'textarea-xs', 'textarea-sm', 'textarea-md', 'textarea-lg', 'textarea-error', 'textarea-primary');
  }
  if (nus.includes('card-body')) {
    saida.push(`flex flex-1 flex-col gap-2${temPadding(nus) ? '' : ' p-6'}`);
    consumir('card-body');
  }
  if (nus.includes('loading')) {
    saida.push(`${LOADING_BASE} ${LOADING_TAMANHO[tamanhoDe(nus, 'loading')]}`);
    consumir('loading', 'loading-xs', 'loading-sm', 'loading-md', 'loading-lg');
  }
  if (nus.includes('checkbox')) {
    saida.push(`${CHECK_TAMANHO[tamanhoDe(nus, 'checkbox')]} shrink-0 cursor-pointer rounded border-input ${ACENTO}`);
    consumir('checkbox', 'checkbox-xs', 'checkbox-sm', 'checkbox-md', 'checkbox-lg', ...Object.keys(BADGE_COR).map((k) => `checkbox-${k}`));
  }
  if (nus.includes('toggle')) {
    saida.push(`${TOGGLE_BASE} ${TOGGLE_TAMANHO[tamanhoDe(nus, 'toggle')]}`);
    consumir('toggle', 'toggle-xs', 'toggle-sm', 'toggle-md', 'toggle-lg', ...Object.keys(BADGE_COR).map((k) => `toggle-${k}`));
  }
  if (nus.includes('table')) {
    saida.push(`${TABELA_BASE} ${TABELA_TAMANHO[tamanhoDe(nus, 'table')]}`);
    consumir('table', 'table-xs', 'table-sm', 'table-md', 'table-lg');
  }
  if (nus.includes('tab')) {
    const ativa = nus.includes('tab-active');
    saida.push(
      ativa
        ? '-mb-px inline-flex h-10 cursor-pointer items-center gap-2 border-b-2 border-primary px-3 text-sm font-medium text-foreground'
        : '-mb-px inline-flex h-10 cursor-pointer items-center gap-2 border-b-2 border-transparent px-3 text-sm text-muted-foreground hover:text-foreground',
    );
    consumir('tab', 'tab-active', 'tab-bordered', 'tab-lifted');
  }
  if (nus.includes('alert')) {
    const corKey = Object.keys(ALERTA_COR).find((k) => nus.includes(`alert-${k}`));
    saida.push(`flex w-full items-start gap-3 rounded-md border p-4 text-sm ${corKey ? ALERTA_COR[corKey] : 'border-border bg-muted'}`);
    consumir('alert', ...Object.keys(ALERTA_COR).map((k) => `alert-${k}`));
  }
  if (nus.includes('progress')) {
    const corKey = Object.keys(PROGRESSO_COR).find((k) => nus.includes(`progress-${k}`));
    saida.push(`${PROGRESSO_BASE} ${progresso(corKey ? PROGRESSO_COR[corKey] : 'primary')}`);
    consumir('progress', ...Object.keys(PROGRESSO_COR).map((k) => `progress-${k}`));
  }

  const resultado: string[] = [];
  let gruposEmitidos = false;
  for (const token of tokens) {
    if (token.startsWith('${')) {
      resultado.push(token);
      continue;
    }
    if (consumidos.has(token)) {
      if (!gruposEmitidos) {
        resultado.push(...saida);
        gruposEmitidos = true;
      }
      continue;
    }
    const [, prefixo, core] = token.match(PREFIXO) as RegExpMatchArray;
    const cor = converterCor(core);
    if (cor !== null) {
      resultado.push(prefixar(prefixo, cor));
      continue;
    }
    if (core in SIMPLES) {
      const v = SIMPLES[core];
      if (v) resultado.push(prefixar(prefixo, v));
      continue;
    }
    // Modificadores avulsos (base em outro literal): vencem com !important
    const avulso = converterAvulso(core);
    if (avulso !== null) {
      if (avulso) resultado.push(prefixar(prefixo, importante(avulso)));
      continue;
    }
    resultado.push(token);
  }
  if (!gruposEmitidos && saida.length) resultado.unshift(...saida);
  return resultado.filter(Boolean).join(' ');
}

function converterAvulso(core: string): string | null {
  let m = core.match(/^btn-(xs|sm|md|lg)$/);
  if (m) return BTN_TAMANHO[m[1]];
  m = core.match(/^btn-(primary|secondary|accent|info|success|warning|error|neutral)$/);
  if (m) return corBotao(CORES_BOTAO[m[1]]);
  if (core === 'btn-ghost') return 'bg-transparent hover:bg-muted';
  if (core === 'btn-outline') return 'border border-input bg-card hover:bg-muted';
  if (core === 'btn-square') return 'w-10 px-0';
  if (core === 'btn-circle') return 'w-10 rounded-full px-0';
  m = core.match(/^badge-(xs|sm|md|lg)$/);
  if (m) return BADGE_TAMANHO[m[1]];
  m = core.match(/^badge-(primary|secondary|accent|info|success|warning|error|neutral|ghost|outline)$/);
  if (m) return BADGE_COR[m[1]];
  m = core.match(/^(input|select)-(xs|sm|md|lg)$/);
  if (m) return CAMPO_TAMANHO[m[2]];
  if (/^(input|select|textarea)-error$/.test(core)) return 'border-destructive';
  if (core === 'tab-active') return 'border-primary font-medium text-foreground';
  m = core.match(/^loading-(xs|sm|md|lg)$/);
  if (m) return LOADING_TAMANHO[m[1]];
  m = core.match(/^checkbox-(primary|secondary|accent|info|success|warning|error)$/);
  if (m) return '';
  m = core.match(/^alert-(info|success|warning|error)$/);
  if (m) return ALERTA_COR[m[1]];
  m = core.match(/^progress-(primary|secondary|accent|info|success|warning|error)$/);
  if (m) return progresso(PROGRESSO_COR[m[1]]);
  return null;
}
