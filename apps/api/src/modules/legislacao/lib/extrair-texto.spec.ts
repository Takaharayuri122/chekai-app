import { readFileSync } from 'fs';
import { join } from 'path';
import { SituacaoLegislacao } from '../entities/legislacao.entity';
import { decodificarHtml, ehPdf, extrairTextoHtml, extrairTextoPdf } from './extrair-texto';

const fixture = (nome: string) => readFileSync(join(__dirname, '__fixtures__', nome));

describe('extrairTextoHtml', () => {
  it('usa o miolo .texto-dou e descarta o menu', () => {
    const { texto } = extrairTextoHtml(decodificarHtml(fixture('dou.html'), 'text/html; charset=utf-8'));
    expect(texto.startsWith('RESOLUÇÃO-RDC Nº 216, DE 15 DE SETEMBRO DE 2004')).toBe(true);
    expect(texto).not.toContain('Menu principal');
    expect(texto).not.toContain('Rodapé');
    expect(texto).not.toContain('var x');
    expect(texto.length).toBeGreaterThan(500);
    expect(texto).toContain('\n');
  });

  it('decodifica ISO-8859-1 pela meta e captura a situação', () => {
    const html = decodificarHtml(fixture('datalegis-latin1.html'), 'text/html');
    expect(html).toContain('Resolução');
    expect(html).toContain('Boas Práticas');
    const { texto, indicioSituacao } = extrairTextoHtml(html);
    expect(indicioSituacao).toBe(SituacaoLegislacao.VIGENTE_COM_ALTERACOES);
    expect(texto).toContain('Resolução RDC nº 216');
    expect(texto).not.toContain('Início');
  });

  it('decodifica pelo charset do header', () => {
    const buf = Buffer.from('<p>Ação</p>', 'latin1');
    expect(decodificarHtml(buf, 'text/html; charset=ISO-8859-1')).toContain('Ação');
  });

  it('extrai o maior bloco de texto em páginas comuns (Planalto)', () => {
    const { texto } = extrairTextoHtml(decodificarHtml(fixture('planalto.html'), null));
    expect(texto).toContain('LEI Nº 8.078');
    expect(texto).toContain('Art. 4º');
    expect(texto.length).toBeGreaterThan(500);
  });

  it('escolhe o bloco com mais texto próprio quando há vários', () => {
    const html =
      '<body><div id="menu">Menu curto</div><div id="miolo"><p>' +
      'texto do miolo '.repeat(60) +
      '</p></div></body>';
    const { texto } = extrairTextoHtml(html);
    expect(texto).toContain('texto do miolo');
    expect(texto).not.toContain('Menu curto');
  });

  it('detecta revogada', () => {
    const { indicioSituacao } = extrairTextoHtml('<body><p>Situação: Revogada pela Resolução X</p></body>');
    expect(indicioSituacao).toBe(SituacaoLegislacao.REVOGADA);
  });

  it('detecta vigente e ausência de indício', () => {
    expect(extrairTextoHtml('<body><p>Situação: Vigente</p></body>').indicioSituacao).toBe(
      SituacaoLegislacao.VIGENTE,
    );
    expect(extrairTextoHtml('<body><p>Nada</p></body>').indicioSituacao).toBeNull();
  });

  it('rótulo explícito prevalece sobre "(Revogado)" em artigo', () => {
    const { indicioSituacao } = extrairTextoHtml(
      '<body><p>Situação: Vigente com Alterações</p><p>Art. 5º (Revogado)</p></body>',
    );
    expect(indicioSituacao).toBe(SituacaoLegislacao.VIGENTE_COM_ALTERACOES);
  });

  it('frase solta "vigente" sem rótulo não gera indício', () => {
    const { indicioSituacao } = extrairTextoHtml(
      '<body><p>Art. 3º Sujeita-se à legislação sanitária vigente. Art. 4º (Revogado)</p></body>',
    );
    expect(indicioSituacao).toBeNull();
  });

  it('"Não vigente" é revogada', () => {
    expect(extrairTextoHtml('<body><p>Situação: Não vigente</p></body>').indicioSituacao).toBe(
      SituacaoLegislacao.REVOGADA,
    );
  });

  it('script e style não geram indício', () => {
    expect(
      extrairTextoHtml('<body><script>var s="Situação: Revogada"</script><p>Texto</p></body>')
        .indicioSituacao,
    ).toBeNull();
  });

  it('remove texto tachado do conteúdo', () => {
    const { texto } = extrairTextoHtml(
      '<body><p>Art. 1º <strike>texto revogado</strike> novo texto <del>apagado</del></p></body>',
    );
    expect(texto).not.toContain('texto revogado');
    expect(texto).not.toContain('apagado');
    expect(texto).toContain('novo texto');
  });

  it('página de firewall rende texto curto', () => {
    const { texto } = extrairTextoHtml(decodificarHtml(fixture('firewall.html'), 'text/html'));
    expect(texto.length).toBeLessThan(500);
  });
});

describe('ehPdf', () => {
  it('reconhece pela assinatura', () => {
    expect(ehPdf(Buffer.from('%PDF-1.4'), null)).toBe(true);
  });
  it('reconhece pelo content-type', () => {
    expect(ehPdf(Buffer.from('xx'), 'application/pdf; qs=1')).toBe(true);
  });
  it('rejeita HTML', () => {
    expect(ehPdf(Buffer.from('<html>'), 'text/html')).toBe(false);
  });
});

describe('extrairTextoPdf', () => {
  it('carrega o pdf-parse e rejeita conteúdo que não é PDF', async () => {
    await expect(extrairTextoPdf(Buffer.from('não é pdf'))).rejects.toBeDefined();
  });
});
