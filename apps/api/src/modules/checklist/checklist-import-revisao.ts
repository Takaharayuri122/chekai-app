import { normalizarConfiguracao, PESO_MAX } from './checklist-import-mapeamento';
import { RESPOSTAS_PADRAO_VALORES } from './checklist-regras';
import { TAMANHO_MAXIMO_OPCAO, TIPOS_RESPOSTA_LOTE } from './dto/configurar-lote.dto';
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
- Em "grupoNome", devolva o nome do grupo apenas com correção de ortografia e acentuação; não troque palavras nem o sentido. Se não houver o que corrigir, repita o nome recebido.

VALORES PERMITIDOS:
- categoria: ${Object.values(CategoriaItem).join(', ')}
- criticidade: ${Object.values(CriticidadeItem).join(', ')}
- tipoResposta: ${TIPOS_RESPOSTA_LOTE.join(', ')}
- peso: número inteiro maior ou igual a 0 (no máximo ${PESO_MAX})
- permiteFoto, permiteObservacao: true ou false
- opcoes: lista de { "valor": string, "pontuacao": número de -10 a 10, "fotoObrigatoria": boolean, "observacaoObrigatoria": boolean }
- pontuacao: omita para usar a pontuação padrão; use null apenas em opções que não pontuam (como "não aplicável")

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
    if (
      !o ||
      typeof o !== 'object' ||
      typeof o.valor !== 'string' ||
      !o.valor.trim() ||
      o.valor.length > TAMANHO_MAXIMO_OPCAO
    ) {
      return undefined;
    }
    const p = o.pontuacao;
    if (p != null && (typeof p !== 'number' || !Number.isFinite(p) || p < -10 || p > 10)) return undefined;
    const opcao: ConfiguracaoPerguntaImportada['opcoes'][number] = {
      valor: o.valor,
      fotoObrigatoria: o.fotoObrigatoria === true,
      observacaoObrigatoria: o.observacaoObrigatoria === true,
    };
    // Ausente = pontuação padrão; null explícito = não pontua
    if (p !== undefined) opcao.pontuacao = p as number | null;
    resultado.push(opcao);
  }
  return resultado;
}

type Opcao = ConfiguracaoPerguntaImportada['opcoes'][number];

const SEM_PONTUACAO = ['nao_aplicavel', 'nao_avaliado'];

/** Remove a chave pontuacao (ausente = pontuação padrão da auditoria). */
function semPontuacao(o: Opcao): Opcao {
  const { pontuacao: _descartada, ...resto } = o;
  return resto;
}

/** Padrão: null só vale para N/A e N/Av; nas demais respostas vira pontuação padrão. */
function pontuacaoPadrao(o: Opcao): Opcao {
  return o.pontuacao === null && !SEM_PONTUACAO.includes(o.valor) ? semPontuacao(o) : o;
}

/** Personalizada: null da IA vira ausente, salvo se a opção original já tinha null explícito. */
function pontuacaoPersonalizada(o: Opcao, original: Opcao[]): Opcao {
  if (o.pontuacao !== null) return o;
  const anterior = original.find((x) => x.valor === o.valor);
  return anterior && anterior.pontuacao === null ? o : semPontuacao(o);
}

function reconciliarOpcoes(
  original: ConfiguracaoPerguntaImportada,
  tipo: ConfiguracaoPerguntaImportada['tipoResposta'],
  opcoesIa: ConfiguracaoPerguntaImportada['opcoes'] | undefined,
): Pick<ConfiguracaoPerguntaImportada, 'tipoResposta' | 'opcoes'> {
  if (tipo === 'texto' || tipo === 'numero' || tipo === 'data') return { tipoResposta: tipo, opcoes: [] };

  if (tipo === 'padrao') {
    const doOriginal = original.tipoResposta === 'padrao' ? original.opcoes : [];
    const alvo = doOriginal.length ? doOriginal.map((o) => o.valor) : [...RESPOSTAS_PADRAO_VALORES];
    const opcoes = RESPOSTAS_PADRAO_VALORES.filter((v) => alvo.includes(v)).map(
      (valor) =>
        opcoesIa?.find((o) => o.valor === valor) ??
        doOriginal.find((o) => o.valor === valor) ??
        (valor === 'nao_aplicavel' || valor === 'nao_avaliado'
          ? { valor, pontuacao: null, fotoObrigatoria: false, observacaoObrigatoria: false }
          : { valor, fotoObrigatoria: false, observacaoObrigatoria: false }),
    );
    return { tipoResposta: 'padrao', opcoes };
  }

  // personalizada: exige ao menos uma opção válida; senão mantém tipo e opções originais
  if (opcoesIa?.length) return { tipoResposta: 'personalizada', opcoes: opcoesIa };
  return { tipoResposta: original.tipoResposta, opcoes: original.opcoes };
}

function aplicarSugestaoBruta(
  original: ConfiguracaoPerguntaImportada,
  bruto: Bruto,
): ConfiguracaoPerguntaImportada {
  const peso = bruto.peso;
  const tipo = enumOuOriginal(bruto.tipoResposta, TIPOS_RESPOSTA_LOTE, original.tipoResposta);
  // null da IA só é aceito onde realmente não há pontuação; as opções do original ficam como estão
  const opcoesOriginaisPersonalizadas = original.tipoResposta === 'personalizada' ? original.opcoes : [];
  const opcoesIa = opcoesValidas(bruto.opcoes)?.map((o) =>
    tipo === 'padrao' ? pontuacaoPadrao(o) : pontuacaoPersonalizada(o, opcoesOriginaisPersonalizadas),
  );
  // Tipo mantido e opções ausentes/inválidas: preserva as opções originais
  const opcoesBase = tipo === original.tipoResposta && !opcoesIa ? original.opcoes : opcoesIa;
  return {
    ...original,
    categoria: enumOuOriginal(bruto.categoria, Object.values(CategoriaItem), original.categoria),
    criticidade: enumOuOriginal(bruto.criticidade, Object.values(CriticidadeItem), original.criticidade),
    ...reconciliarOpcoes(original, tipo, opcoesBase),
    peso: typeof peso === 'number' && Number.isInteger(peso) && peso >= 0 && peso <= PESO_MAX ? peso : original.peso,
    permiteFoto: typeof bruto.permiteFoto === 'boolean' ? bruto.permiteFoto : original.permiteFoto,
    permiteObservacao:
      typeof bruto.permiteObservacao === 'boolean' ? bruto.permiteObservacao : original.permiteObservacao,
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
