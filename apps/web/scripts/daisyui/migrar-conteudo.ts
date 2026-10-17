import { converterClasses } from './converter-classes';

/** Converte cada literal de string (aspas simples/duplas e partes estáticas de template) de um trecho de código. */
function converterLiterais(trecho: string): string {
  let saida = '';
  let i = 0;
  while (i < trecho.length) {
    const ch = trecho[i];
    if (ch === "'" || ch === '"') {
      const fim = trecho.indexOf(ch, i + 1);
      if (fim < 0) return saida + trecho.slice(i);
      saida += ch + converterClasses(trecho.slice(i + 1, fim)) + ch;
      i = fim + 1;
    } else if (ch === '`') {
      let j = i + 1;
      let estatico = '';
      saida += '`';
      while (j < trecho.length && trecho[j] !== '`') {
        if (trecho[j] === '$' && trecho[j + 1] === '{') {
          saida += converterClassesPreservandoBordas(estatico);
          estatico = '';
          let prof = 1;
          let k = j + 2;
          while (k < trecho.length && prof > 0) {
            if (trecho[k] === '{') prof += 1;
            if (trecho[k] === '}') prof -= 1;
            k += 1;
          }
          saida += '${' + converterLiterais(trecho.slice(j + 2, k - 1)) + '}';
          j = k;
        } else {
          estatico += trecho[j];
          j += 1;
        }
      }
      saida += converterClassesPreservandoBordas(estatico) + '`';
      i = j + 1;
    } else {
      saida += ch;
      i += 1;
    }
  }
  return saida;
}

/** Mantém espaços nas bordas (separam do ${...} vizinho). */
function converterClassesPreservandoBordas(s: string): string {
  const ini = s.match(/^\s*/)?.[0] ?? '';
  const fim = s.match(/\s*$/)?.[0] ?? '';
  const meio = s.trim();
  return meio ? ini + converterClasses(meio) + fim : s;
}

function fimBalanceado(codigo: string, inicio: number, abre: string, fecha: string): number {
  let prof = 0;
  for (let i = inicio; i < codigo.length; i++) {
    const ch = codigo[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      const fimStr = codigo.indexOf(ch, i + 1);
      if (fimStr < 0) return codigo.length;
      i = fimStr;
      continue;
    }
    if (ch === abre) prof += 1;
    if (ch === fecha) {
      prof -= 1;
      if (prof === 0) return i;
    }
  }
  return codigo.length;
}

export function migrarConteudo(codigo: string): string {
  let saida = '';
  let i = 0;
  const padrao = /className=|\bcn\(|\bclsx\(/g;
  let m: RegExpExecArray | null;
  while ((m = padrao.exec(codigo))) {
    const inicio = m.index + m[0].length;
    saida += codigo.slice(i, inicio);
    if (m[0] === 'className=') {
      const ch = codigo[inicio];
      if (ch === '"' || ch === "'") {
        const fim = codigo.indexOf(ch, inicio + 1);
        saida += ch + converterClasses(codigo.slice(inicio + 1, fim)) + ch;
        i = fim + 1;
      } else if (ch === '{') {
        const fim = fimBalanceado(codigo, inicio, '{', '}');
        saida += '{' + converterLiterais(codigo.slice(inicio + 1, fim)) + '}';
        i = fim + 1;
      } else {
        i = inicio;
      }
    } else {
      const fim = fimBalanceado(codigo, inicio - 1, '(', ')');
      saida += converterLiterais(codigo.slice(inicio, fim)) + ')';
      i = fim + 1;
    }
    padrao.lastIndex = i;
  }
  return saida + codigo.slice(i);
}

const DISTINTIVAS =
  /(?<![\w-])(btn(?:-(?:primary|secondary|accent|info|success|warning|error|neutral|ghost|outline|xs|sm|md|lg|square|circle|block|wide|link|disabled|active))?|badge(?:-(?:primary|secondary|accent|info|success|warning|error|neutral|ghost|outline|xs|sm|md|lg))?|card-body|card-title|card-actions|form-control|label-text(?:-alt)?|input-bordered|select-bordered|textarea-bordered|(?:input|select|textarea)-(?:xs|sm|lg|error)|loading-(?:spinner|xs|sm|md|lg|dots)|alert-(?:info|success|warning|error)|tab-active|tabs-(?:bordered|lifted|boxed)|stat-(?:title|value|desc|figure)|step-primary|join-item|modal-box|modal-open|dropdown-content|dropdown-(?:end|top|bottom|left|right)|checkbox-(?:primary|secondary|sm|xs|lg)|toggle-(?:sm|xs|lg|primary|success)|range-(?:sm|xs)|progress-(?:primary|success|warning|error|info)|table-(?:zebra|xs|sm)|rounded-box|(?:bg|text|border|ring|from|to|via|stroke|fill|divide)-(?:base-100|base-200|base-300|base-content|primary-content|secondary|secondary-content|accent|accent-content|neutral|neutral-content|error|error-content|success-content|warning-content|info-content)(?:\/\d+)?)(?![\w-])/g;

/** Classes DaisyUI em qualquer literal do arquivo (usado pelo teste-guarda). */
export function encontrarClassesDaisy(codigo: string): string[] {
  const achados: string[] = [];
  const literais = codigo.match(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g) ?? [];
  for (const lit of literais) {
    for (const m of lit.matchAll(DISTINTIVAS)) achados.push(m[1]);
  }
  for (const m of codigo.matchAll(/className=(["'])([^"']*)\1/g)) {
    for (const t of m[2].split(/\s+/)) {
      const core = t.replace(/^(?:[a-z0-9-]+:)+/, '');
      if (['btn', 'badge', 'card', 'input', 'select', 'textarea', 'label', 'loading', 'alert', 'tabs', 'tab', 'stat', 'stats', 'steps', 'step', 'join', 'divider', 'checkbox', 'toggle', 'radio', 'range', 'progress', 'table', 'menu', 'dropdown', 'modal', 'collapse', 'avatar', 'placeholder', 'kbd', 'link', 'tooltip', 'swap', 'navbar', 'drawer', 'mask', 'rating', 'file-input'].includes(core) && !achados.includes(core)) {
        achados.push(core);
      }
    }
  }
  return [...new Set(achados)];
}
