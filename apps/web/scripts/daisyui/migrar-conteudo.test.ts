import { describe, expect, it } from 'vitest';
import { encontrarClassesDaisy, migrarConteudo } from './migrar-conteudo';

describe('migrarConteudo', () => {
  it('converte className com aspas duplas', () => {
    const s = migrarConteudo('<div className="card bg-base-100 p-4">x</div>');
    expect(s).toContain('bg-card');
    expect(s).not.toContain('base-100');
    expect(s).toContain('>x</div>');
  });
  it('converte literais dentro de className={...} e preserva comparações', () => {
    const s = migrarConteudo("<b className={`btn ${status === 'error' ? 'btn-error' : 'btn-ghost'}`} />");
    expect(s).toContain("status === 'error'");
    expect(s).toContain('!bg-destructive');
    expect(s).not.toMatch(/\bbtn\b/);
  });
  it('converte argumentos de cn() e clsx()', () => {
    expect(migrarConteudo("cn('badge badge-sm', ativo && 'badge-primary')")).toContain('!bg-primary/12');
  });
  it('não mexe em texto fora de className/cn', () => {
    const codigo = "const titulo = 'card de cliente'; <p>btn</p>";
    expect(migrarConteudo(codigo)).toBe(codigo);
  });
});

describe('encontrarClassesDaisy', () => {
  it('aponta classes DaisyUI em className e em literais típicos', () => {
    expect(encontrarClassesDaisy('<div className="btn btn-primary" />')).toEqual(['btn', 'btn-primary']);
    expect(encontrarClassesDaisy("const estilo = { botao: 'btn-error' };")).toEqual(['btn-error']);
    expect(encontrarClassesDaisy('<div className="bg-card text-foreground" />')).toEqual([]);
  });
});

describe('espaços em template literal', () => {
  it('mantém o espaço entre classes e interpolações', () => {
    const s = migrarConteudo('<div className={`tooltip ${pos} card p-2`} />');
    expect(s).toContain('tooltip ${pos} ');
    expect(s).not.toMatch(/\S\$\{pos\}/);
    const s2 = migrarConteudo('<div className={`btn ${a ? "btn-primary" : ""}`} />');
    expect(s2).toMatch(/px-4[^`$]* \$\{/);
  });
});
