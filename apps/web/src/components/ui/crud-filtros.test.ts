import { describe, expect, it } from 'vitest';
import { contarPreenchidos } from './crud-filtros';

describe('contarPreenchidos', () => {
  it('conta campos diferentes do valor inicial e não vazios', () => {
    const iniciais = { status: 'agendada', responsavelId: '', busca: '' };
    expect(contarPreenchidos(iniciais, iniciais)).toBe(0);
    expect(contarPreenchidos({ ...iniciais, responsavelId: 'u1' }, iniciais)).toBe(1);
    expect(contarPreenchidos({ ...iniciais, status: '', busca: 'x' }, iniciais)).toBe(1);
  });
});
