/** Largura máxima da imagem exportada: suficiente para o PDF e leve para gravar na resposta. */
export const LARGURA_MAXIMA_EXPORTACAO = 600;

export interface Ponto {
  x: number;
  y: number;
}

/** Tamanho da imagem exportada mantendo a proporção do quadro, limitado à largura máxima. */
export function tamanhoDaExportacao(largura: number, altura: number): { largura: number; altura: number } {
  if (largura <= 0 || altura <= 0) return { largura: 0, altura: 0 };
  const escala = Math.min(1, LARGURA_MAXIMA_EXPORTACAO / largura);
  return { largura: Math.round(largura * escala), altura: Math.round(altura * escala) };
}

/** Ponto do evento em coordenadas do quadro (CSS px), independente de rolagem e zoom. */
export function pontoNoQuadro(
  evento: { clientX: number; clientY: number },
  retangulo: { left: number; top: number },
): Ponto {
  return { x: evento.clientX - retangulo.left, y: evento.clientY - retangulo.top };
}

/** Ponto médio entre dois pontos: usado para suavizar o traço com curvas. */
export function pontoMedio(a: Ponto, b: Ponto): Ponto {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
