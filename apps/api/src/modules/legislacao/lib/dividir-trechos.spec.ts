import { dividirEmTrechos } from './dividir-trechos';

describe('dividirEmTrechos', () => {
  it('agrupa artigos curtos num trecho rotulado pelo primeiro', () => {
    const trechos = dividirEmTrechos('Art. 1º Primeira regra. Art. 2º Segunda regra.');
    expect(trechos).toHaveLength(1);
    expect(trechos[0].artigo).toBe('Art. 1º');
    expect(trechos[0].conteudo).toContain('Art. 2º');
  });

  it('divide artigo longo sem cortar palavras', () => {
    const palavras = Array.from({ length: 700 }, (_, i) => `palavra${i}`).join(' ');
    const trechos = dividirEmTrechos(`Art. 1º ${palavras}`);
    expect(trechos.length).toBeGreaterThan(1);
    for (const t of trechos) {
      expect(t.conteudo.length).toBeLessThanOrEqual(2000);
      expect(t.artigo).toBe('Art. 1º');
    }
    const juntas = trechos.map((t) => t.conteudo).join(' ');
    for (let i = 0; i < 700; i++) expect(juntas).toContain(`palavra${i}`);
    expect(juntas.split(/\s+/).every((p) => p === 'Art.' || p === '1º' || /^palavra\d+$/.test(p))).toBe(
      true,
    );
  });

  it('rotula itens numerados de anexos', () => {
    const texto = [
      '4.1.1 Edificação e instalações devem ser projetadas para evitar contaminação. ' + 'a'.repeat(1200),
      '4.1.2 A área externa deve ser livre de focos de insalubridade. ' + 'b'.repeat(1200),
    ].join('\n');
    const trechos = dividirEmTrechos(texto);
    expect(trechos.map((t) => t.artigo)).toEqual(['Item 4.1.1', 'Item 4.1.2']);
  });

  it('usa artigo nulo em texto sem marcadores', () => {
    const trechos = dividirEmTrechos('Texto simples.\nOutro parágrafo qualquer.');
    expect(trechos).toHaveLength(1);
    expect(trechos[0].artigo).toBeNull();
  });

  it('não gera trechos vazios', () => {
    expect(dividirEmTrechos('   \n\n  ')).toEqual([]);
    const trechos = dividirEmTrechos('\n\nArt. 1º A.\n\n\nArt. 2º B.\n\n');
    expect(trechos.every((t) => t.conteudo.trim().length > 0)).toBe(true);
  });

  it('não confunde referência a artigo no meio da frase com início de artigo', () => {
    const trechos = dividirEmTrechos('Art. 1º Conforme o Art. 5º desta lei.\n' + 'x'.repeat(1600));
    expect(trechos[0].artigo).toBe('Art. 1º');
    expect(trechos.every((t) => t.artigo === 'Art. 1º')).toBe(true);
  });
});
