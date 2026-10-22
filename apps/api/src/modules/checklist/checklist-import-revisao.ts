import { normalizarConfiguracao } from './checklist-import-mapeamento';
import { TIPOS_RESPOSTA_LOTE } from './dto/configurar-lote.dto';
import { ConfiguracaoPerguntaImportada, PerguntaImportada } from './dto/importar-checklist.dto';
import { CategoriaItem, CriticidadeItem } from './entities/template-item.entity';

export type CampoRevisado =
  | 'pergunta'
  | 'categoria'
  | 'criticidade'
  | 'tipoResposta'
  | 'peso'
  | 'permiteFoto'
  | 'permiteObservacao'
  | 'opcoes';

export interface SugestaoPergunta {
  chave: string;
  perguntaSugerida: string;
  configuracaoSugerida: ConfiguracaoPerguntaImportada;
  alteracoes: CampoRevisado[];
  motivo?: string;
  conferir: boolean;
  motivoConferir?: string;
}

export interface RevisaoGrupoResultado {
  status: 'revisado' | 'sem_creditos' | 'falha';
  grupoNomeSugerido?: string;
  sugestoes: SugestaoPergunta[];
}

const CAMPOS_QUE_EXIGEM_CONFERENCIA: CampoRevisado[] = [
  'tipoResposta',
  'peso',
  'permiteFoto',
  'permiteObservacao',
  'opcoes',
];

const ROTULOS: Record<CampoRevisado, string> = {
  pergunta: 'texto da pergunta',
  categoria: 'categoria',
  criticidade: 'criticidade',
  tipoResposta: 'tipo de resposta',
  peso: 'peso',
  permiteFoto: 'permissão de foto',
  permiteObservacao: 'permissão de observação',
  opcoes: 'opções de resposta',
};

/**
 * Monta o prompt de revisão de um grupo de perguntas importadas.
 */
export function montarPromptRevisao(
  grupo: string,
  perguntas: PerguntaImportada[],
  contextoLegal: string[],
): string {
  const lista = perguntas.map((p) => ({
    chave: p.chave,
    pergunta: p.pergunta,
    categoria: p.configuracao.categoria,
    criticidade: p.configuracao.criticidade,
    tipoResposta: p.configuracao.tipoResposta,
    peso: p.configuracao.peso,
    permiteFoto: p.configuracao.permiteFoto,
    permiteObservacao: p.configuracao.permiteObservacao,
    opcoes: p.configuracao.opcoes,
  }));
  const legal = contextoLegal.length
    ? `\nTRECHOS DA LEGISLAÇÃO:\n${contextoLegal.map((t, i) => `[${i + 1}] ${t}`).join('\n')}\n`
    : '';

  return `Você revisa perguntas de um checklist importado de planilha para auditoria de boas práticas em serviços de alimentação (RDC 216/2004 e a legislação fornecida).

GRUPO: ${grupo}
${legal}
PERGUNTAS (JSON):
${JSON.stringify(lista, null, 2)}

INSTRUÇÕES:
- Corrija ortografia e acentuação sem mudar o sentido da pergunta.
- NÃO crie, remova ou reordene perguntas; use exatamente as chaves recebidas.
- Sugira a configuração mais adequada para cada pergunta (categoria, criticidade, tipo de resposta, peso, foto, observação e opções).
- Se mudar algo além do texto, explique brevemente em "motivo".
- Você também pode sugerir um nome melhor para o grupo em "grupoNome".

VALORES PERMITIDOS:
- categoria: ${Object.values(CategoriaItem).join(', ')}
- criticidade: ${Object.values(CriticidadeItem).join(', ')}
- tipoResposta: ${TIPOS_RESPOSTA_LOTE.join(', ')}
- peso: número maior ou igual a 0
- permiteFoto, permiteObservacao: true ou false
- opcoes: lista de { "valor": string, "pontuacao": número de -10 a 10 ou null, "fotoObrigatoria": boolean, "observacaoObrigatoria": boolean }

Responda APENAS com JSON no formato:
{ "grupoNome": "...", "perguntas": [ { "chave": "...", "pergunta": "...", "categoria": "...", "criticidade": "...", "tipoResposta": "...", "peso": 1, "permiteFoto": true, "permiteObservacao": true, "opcoes": [], "motivo": "..." } ] }`;
}

type Bruto = Record<string, unknown>;

function enumOuOriginal<T extends string>(valor: unknown, permitidos: readonly T[], original: T): T {
  return typeof valor === 'string' && (permitidos as readonly string[]).includes(valor)
    ? (valor as T)
    : original;
}

function opcoesValidas(valor: unknown): ConfiguracaoPerguntaImportada['opcoes'] | undefined {
  if (!Array.isArray(valor)) return undefined;
  const resultado: ConfiguracaoPerguntaImportada['opcoes'] = [];
  for (const o of valor as Bruto[]) {
    if (!o || typeof o !== 'object' || typeof o.valor !== 'string' || !o.valor.trim()) return undefined;
    const p = o.pontuacao;
    if (p != null && (typeof p !== 'number' || !Number.isFinite(p) || p < -10 || p > 10)) return undefined;
    resultado.push({
      valor: o.valor,
      pontuacao: p == null ? null : p,
      fotoObrigatoria: o.fotoObrigatoria === true,
      observacaoObrigatoria: o.observacaoObrigatoria === true,
    });
  }
  return resultado;
}

function aplicarSugestaoBruta(
  original: ConfiguracaoPerguntaImportada,
  bruto: Bruto,
): ConfiguracaoPerguntaImportada {
  const peso = bruto.peso;
  return {
    ...original,
    categoria: enumOuOriginal(bruto.categoria, Object.values(CategoriaItem), original.categoria),
    criticidade: enumOuOriginal(bruto.criticidade, Object.values(CriticidadeItem), original.criticidade),
    tipoResposta: enumOuOriginal(bruto.tipoResposta, TIPOS_RESPOSTA_LOTE, original.tipoResposta),
    peso: typeof peso === 'number' && Number.isFinite(peso) && peso >= 0 ? peso : original.peso,
    permiteFoto: typeof bruto.permiteFoto === 'boolean' ? bruto.permiteFoto : original.permiteFoto,
    permiteObservacao:
      typeof bruto.permiteObservacao === 'boolean' ? bruto.permiteObservacao : original.permiteObservacao,
    opcoes: opcoesValidas(bruto.opcoes) ?? original.opcoes,
  };
}

function diferencas(
  original: PerguntaImportada,
  perguntaSugerida: string,
  c: ConfiguracaoPerguntaImportada,
): CampoRevisado[] {
  const o = original.configuracao;
  const campos: CampoRevisado[] = [];
  if (perguntaSugerida !== original.pergunta) campos.push('pergunta');
  if (c.categoria !== o.categoria) campos.push('categoria');
  if (c.criticidade !== o.criticidade) campos.push('criticidade');
  if (c.tipoResposta !== o.tipoResposta) campos.push('tipoResposta');
  if (c.peso !== o.peso) campos.push('peso');
  if (c.permiteFoto !== o.permiteFoto) campos.push('permiteFoto');
  if (c.permiteObservacao !== o.permiteObservacao) campos.push('permiteObservacao');
  if (JSON.stringify(c.opcoes) !== JSON.stringify(o.opcoes)) campos.push('opcoes');
  return campos;
}

function descreverConflito(
  original: PerguntaImportada,
  sugerida: ConfiguracaoPerguntaImportada,
  alteracoes: CampoRevisado[],
): string | undefined {
  const o = original.configuracao;
  if (original.motivoConferir) return original.motivoConferir;
  if (sugerida.tipoResposta === 'texto' && o.tipoResposta !== 'texto') {
    return 'A sugestão muda a resposta para texto. Como resposta em texto não tem pontuação nem fotos, removemos pontuação e fotos desta pergunta.';
  }
  const tocados = alteracoes.filter((a) => CAMPOS_QUE_EXIGEM_CONFERENCIA.includes(a));
  if (!tocados.length) return undefined;
  return `A sugestão altera ${tocados.map((c) => ROTULOS[c]).join(', ')}. Confira antes de aceitar.`;
}

/**
 * Interpreta a resposta JSON da IA. Lança erro se o JSON não puder ser lido.
 */
export function interpretarRespostaIa(
  bruto: string,
  perguntas: PerguntaImportada[],
): { grupoNomeSugerido?: string; sugestoes: SugestaoPergunta[] } {
  const dados = JSON.parse(bruto) as Bruto;
  if (!dados || typeof dados !== 'object') throw new Error('Resposta da IA inválida');

  const lista = Array.isArray(dados.perguntas) ? (dados.perguntas as Bruto[]) : [];
  const porChave = new Map<string, Bruto>();
  for (const item of lista) {
    if (item && typeof item.chave === 'string') porChave.set(item.chave, item);
  }

  const sugestoes = perguntas.map((original): SugestaoPergunta => {
    const sugestaoBruta = porChave.get(original.chave);
    const perguntaSugerida =
      typeof sugestaoBruta?.pergunta === 'string' && sugestaoBruta.pergunta.trim()
        ? sugestaoBruta.pergunta.trim()
        : original.pergunta;
    const configuracaoSugerida = sugestaoBruta
      ? normalizarConfiguracao(aplicarSugestaoBruta(original.configuracao, sugestaoBruta))
      : original.configuracao;
    const alteracoes = diferencas(original, perguntaSugerida, configuracaoSugerida);
    const conferir =
      !!original.motivoConferir || alteracoes.some((a) => CAMPOS_QUE_EXIGEM_CONFERENCIA.includes(a));
    const sugestao: SugestaoPergunta = {
      chave: original.chave,
      perguntaSugerida,
      configuracaoSugerida,
      alteracoes,
      conferir,
    };
    if (typeof sugestaoBruta?.motivo === 'string' && sugestaoBruta.motivo.trim()) {
      sugestao.motivo = sugestaoBruta.motivo.trim();
    }
    if (conferir) sugestao.motivoConferir = descreverConflito(original, configuracaoSugerida, alteracoes);
    return sugestao;
  });

  const nome = typeof dados.grupoNome === 'string' ? dados.grupoNome.trim() : '';
  return { grupoNomeSugerido: nome || undefined, sugestoes };
}
