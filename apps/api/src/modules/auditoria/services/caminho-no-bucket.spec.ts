import { caminhoNoBucket } from './caminho-no-bucket';

const BASE = 'https://x.supabase.co/storage/v1/object/public';

describe('caminhoNoBucket', () => {
  it('extrai o caminho do arquivo no bucket', () => {
    expect(caminhoNoBucket(`${BASE}/relatorios/auditorias/a-1/r.pdf`, 'relatorios')).toBe('auditorias/a-1/r.pdf');
  });

  it('decodifica caracteres escapados na URL', () => {
    expect(caminhoNoBucket(`${BASE}/relatorios/auditorias/a-1/relat%C3%B3rio%20final.pdf`, 'relatorios')).toBe(
      'auditorias/a-1/relatório final.pdf',
    );
  });

  it('ignora parâmetros de consulta', () => {
    expect(caminhoNoBucket(`${BASE}/relatorios/auditorias/a-1/r.pdf?t=123`, 'relatorios')).toBe('auditorias/a-1/r.pdf');
  });

  it('devolve null para URL de outro bucket', () => {
    expect(caminhoNoBucket(`${BASE}/fotos/a.jpg`, 'relatorios')).toBeNull();
  });
});
