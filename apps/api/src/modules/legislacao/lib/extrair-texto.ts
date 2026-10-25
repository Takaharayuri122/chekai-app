import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import { SituacaoLegislacao } from '../entities/legislacao.entity';

const DESCARTADOS = 'script, style, nav, header, footer, form, aside, noscript, svg, iframe';
const BLOCOS = 'p, div, li, h1, h2, h3, h4, h5, h6, tr, table, blockquote, section, article, ul, ol';
const CANDIDATOS = new Set(['div', 'article', 'section', 'main', 'td', 'body']);

/**
 * Decodifica o HTML pelo charset do header, depois pela meta, com padrão UTF-8.
 */
export function decodificarHtml(buffer: Buffer, contentType: string | null): string {
  let charset = contentType?.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1];
  if (!charset) {
    const inicio = buffer.subarray(0, 4096).toString('latin1');
    charset = inicio.match(/<meta[^>]+charset\s*=\s*["']?([^"'\s;>\/]+)/i)?.[1];
  }
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

function indicioDeSituacao(texto: string): SituacaoLegislacao | null {
  if (/revogad/i.test(texto)) return SituacaoLegislacao.REVOGADA;
  if (/vigente\s+com\s+altera[çc][õo]es/i.test(texto)) return SituacaoLegislacao.VIGENTE_COM_ALTERACOES;
  if (/vigente/i.test(texto)) return SituacaoLegislacao.VIGENTE;
  return null;
}

function limpar(texto: string): string {
  return texto
    .replace(/ /g, ' ')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function textoDescendente(no: AnyNode): string {
  if (no.type === 'text') return no.data;
  if (no.type !== 'tag') return '';
  const el = no as Element;
  if (CANDIDATOS.has(el.name)) return '';
  return el.children.map(textoDescendente).join('');
}

/** Texto do elemento sem o dos blocos candidatos aninhados. */
function textoProprio(el: Element): string {
  return el.children.map(textoDescendente).join('');
}

/**
 * Extrai o texto útil do HTML e um indício de situação (revogada/vigente) lido da página inteira.
 */
export function extrairTextoHtml(html: string): {
  texto: string;
  indicioSituacao: SituacaoLegislacao | null;
} {
  const $ = cheerio.load(html);
  const indicioSituacao = indicioDeSituacao($.root().text());

  $(DESCARTADOS).remove();
  $('br').replaceWith('\n');
  $(BLOCOS).each((_, el) => {
    $(el).append('\n');
  });
  $('td, th').each((_, el) => {
    $(el).append(' ');
  });

  const dou = $('.texto-dou').first();
  if (dou.length && limpar(dou.text())) {
    return { texto: limpar(dou.text()), indicioSituacao };
  }

  // Heurística: elemento (div/article/section/main/td/body) com mais texto próprio; se ele
  // tiver menos da metade do texto da página, usa o body inteiro.
  const corpo = $('body').first(); // o parser HTML sempre cria o body
  const totalCorpo = limpar(corpo.text());
  let melhor = '';
  corpo.find('div, article, section, main, td').each((_, el) => {
    const proprio = limpar(textoProprio(el as Element));
    if (proprio.length > melhor.length) melhor = proprio;
  });
  const proprioCorpo = limpar(corpo.contents().toArray().map(textoDescendente).join(''));
  if (proprioCorpo.length > melhor.length) melhor = proprioCorpo;

  const texto = melhor.length >= totalCorpo.length / 2 ? melhor : totalCorpo;
  return { texto, indicioSituacao };
}

/**
 * Indica se o conteúdo é PDF (content-type ou assinatura %PDF-).
 */
export function ehPdf(buffer: Buffer, contentType: string | null): boolean {
  if (contentType && /application\/pdf/i.test(contentType)) return true;
  return buffer.subarray(0, 1024).toString('latin1').includes('%PDF-');
}

/**
 * Extrai o texto de um PDF.
 */
export async function extrairTextoPdf(buffer: Buffer): Promise<string> {
  // Import direto do lib evita o modo de depuração do index do pdf-parse.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (
    dados: Buffer,
  ) => Promise<{ text: string }>;
  const { text } = await pdfParse(buffer);
  return limpar(text);
}
