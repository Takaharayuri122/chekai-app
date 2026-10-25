import { LegislacaoVinculoService } from './legislacao-vinculo.service';
import { Legislacao, TipoLegislacao } from './entities/legislacao.entity';

describe('LegislacaoVinculoService', () => {
  let service: LegislacaoVinculoService;
  let legislacaoRepo: { find: jest.Mock };
  let templateRepo: { query: jest.Mock };
  let auditoriaRepo: { query: jest.Mock };

  const rdc216 = {
    id: 'l-216',
    tipo: TipoLegislacao.RDC,
    numero: '216',
    ano: 2004,
    titulo: 'Boas Práticas',
    ativo: true,
  } as Legislacao;

  beforeEach(() => {
    legislacaoRepo = { find: jest.fn() };
    templateRepo = { query: jest.fn() };
    auditoriaRepo = { query: jest.fn() };
    service = new LegislacaoVinculoService(
      legislacaoRepo as never,
      templateRepo as never,
      auditoriaRepo as never,
    );
  });

  it('textoDerivado junta os nomes curtos ou devolve null', () => {
    const cvs = { ...rdc216, id: 'l-cvs', tipo: TipoLegislacao.PORTARIA, numero: '5', ano: 2013 } as Legislacao;
    expect(service.textoDerivado([rdc216, cvs])).toBe('RDC 216/2004; Portaria 5/2013');
    expect(service.textoDerivado([])).toBeNull();
  });

  it('idsPorTexto casa as chaves do texto com as legislações ativas', async () => {
    legislacaoRepo.find.mockResolvedValue([
      rdc216,
      { ...rdc216, id: 'l-lei', tipo: TipoLegislacao.LEI, numero: '8078', ano: 1990 },
    ]);
    await expect(service.idsPorTexto('Lei 8.078/1990 e RDC nº 216/2004')).resolves.toEqual(['l-lei', 'l-216']);
    await expect(service.idsPorTexto(null)).resolves.toEqual([]);
  });

  it('ligarReferenciasAntigas liga só itens sem vínculo que citam a legislação', async () => {
    templateRepo.query.mockImplementation((sql: string) => {
      if (sql.includes('INSERT')) return Promise.resolve([]);
      return Promise.resolve([
        { id: 't-novo', texto: 'RDC 216/2004; Portaria CVS 5/2013', vinculado: false },
        { id: 't-ja', texto: 'RDC 216/2004', vinculado: true },
        { id: 't-outra', texto: 'RDC 275/2004', vinculado: false },
      ]);
    });
    auditoriaRepo.query.mockImplementation((sql: string) => {
      if (sql.includes('INSERT')) return Promise.resolve([]);
      return Promise.resolve([
        { id: 'a-novo', texto: 'RDC nº 216, de 15 de setembro de 2004', vinculado: false },
      ]);
    });

    const resultado = await service.ligarReferenciasAntigas(rdc216);

    expect(resultado).toEqual({ templateItens: 1, auditoriaItens: 1 });
    const insertTemplate = templateRepo.query.mock.calls.find((c) => c[0].includes('INSERT'));
    expect(insertTemplate[1]).toEqual([['t-novo'], 'l-216']);
    const insertAuditoria = auditoriaRepo.query.mock.calls.find((c) => c[0].includes('INSERT'));
    expect(insertAuditoria[1]).toEqual([['a-novo'], 'l-216']);
  });

  it('ligarReferenciasAntigas não faz nada sem chave (sem número/ano)', async () => {
    const semNumero = { ...rdc216, numero: null } as Legislacao;
    await expect(service.ligarReferenciasAntigas(semNumero)).resolves.toEqual({ templateItens: 0, auditoriaItens: 0 });
    expect(templateRepo.query).not.toHaveBeenCalled();
  });
});
