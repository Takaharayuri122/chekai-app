import { readFileSync } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { LegislacaoLeituraService, UsuarioAutenticado } from './legislacao-leitura.service';
import { Legislacao, StatusLeitura, TipoLegislacao } from './entities/legislacao.entity';
import { LegislacaoChunk } from './entities/legislacao-chunk.entity';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { RespostaHttp } from './lib/buscar-http';
import { buscarHttp, criarLookupSeguro } from './lib/buscar-http';
import * as http from 'http';
import * as zlib from 'zlib';

const GESTOR: UsuarioAutenticado = { id: 'g1', perfil: PerfilUsuario.GESTOR, gestorId: null };
const MASTER: UsuarioAutenticado = { id: 'm1', perfil: PerfilUsuario.MASTER };

function artigos(qtd: number): string {
  return Array.from(
    { length: qtd },
    (_, i) =>
      `<p>Art. ${i + 1}º Os serviços de alimentação devem manter as instalações limpas e organizadas, ` +
      `com procedimentos registrados e responsável designado para cada etapa da produção ${i + 1}.</p>`,
  ).join('\n');
}

function htmlLegislacao(qtdArtigos = 12): string {
  return `<html><head><meta charset="utf-8"></head><body><div class="texto-dou">
<p>RESOLUÇÃO RDC Nº 216, DE 15 DE SETEMBRO DE 2004</p>
<p>Dispõe sobre Regulamento Técnico de Boas Práticas para Serviços de Alimentação.</p>
${artigos(qtdArtigos)}
</div></body></html>`;
}

function resposta(status: number, corpo = '', headers: Record<string, string> = {}): RespostaHttp {
  return {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: Readable.from([Buffer.from(corpo)]),
    descartar: jest.fn(),
  };
}

describe('LegislacaoLeituraService', () => {
  let service: LegislacaoLeituraService;
  let legislacao: Legislacao;
  let repo: { findOne: jest.Mock; update: jest.Mock };
  let manager: { delete: jest.Mock; insert: jest.Mock; update: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let credito: { identificarGestorId: jest.Mock; validarSaldoDisponivel: jest.Mock; registrarUso: jest.Mock };
  let vinculo: { ligarReferenciasAntigas: jest.Mock };
  let deepseekCreate: jest.Mock;
  let embeddingsCreate: jest.Mock;
  let fetchFn: jest.Mock;

  const dadosIa = {
    tipo: 'rdc',
    numero: '216',
    ano: 2004,
    orgaoEmissor: 'ANVISA',
    ementa: 'Dispõe sobre Regulamento Técnico de Boas Práticas para Serviços de Alimentação.',
    dataPublicacao: '2004-09-16',
    situacao: 'vigente',
  };

  beforeEach(() => {
    legislacao = {
      id: 'l1',
      tipo: TipoLegislacao.OUTRO,
      numero: null,
      ano: null,
      titulo: 'Título do usuário',
      informacoes: 'Notas do usuário',
      linkOficial: 'https://www.in.gov.br/web/dou/rdc-216',
      statusLeitura: StatusLeitura.LENDO,
    } as Legislacao;
    repo = {
      findOne: jest.fn().mockImplementation(() => Promise.resolve({ ...legislacao })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    manager = {
      delete: jest.fn().mockResolvedValue(undefined),
      insert: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = { transaction: jest.fn().mockImplementation((fn) => fn(manager)) };
    credito = {
      identificarGestorId: jest.fn().mockImplementation((u) => u.gestorId ?? u.id),
      validarSaldoDisponivel: jest.fn().mockResolvedValue(undefined),
      registrarUso: jest.fn().mockResolvedValue(undefined),
    };
    vinculo = { ligarReferenciasAntigas: jest.fn().mockResolvedValue({ templateItens: 0, auditoriaItens: 0 }) };
    const config = { get: jest.fn().mockImplementation((_chave: string, padrao?: string) => padrao ?? 'sk-teste') };
    service = new LegislacaoLeituraService(
      repo as never,
      dataSource as never,
      credito as never,
      vinculo as never,
      config as never,
    );
    deepseekCreate = jest.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(dadosIa) } }],
      usage: { prompt_tokens: 1000, completion_tokens: 100 },
    });
    embeddingsCreate = jest.fn().mockImplementation(({ input }: { input: string[] }) =>
      Promise.resolve({
        data: input.map((_, index) => ({ index, embedding: [index, 0.5] })),
        usage: { prompt_tokens: input.length * 10 },
      }),
    );
    (service as unknown as { deepseek: unknown }).deepseek = { chat: { completions: { create: deepseekCreate } } };
    (service as unknown as { openai: unknown }).openai = { embeddings: { create: embeddingsCreate } };
    fetchFn = jest.fn().mockResolvedValue(resposta(200, htmlLegislacao()));
    service.fetchFn = fetchFn;
    service.resolverFn = jest.fn().mockResolvedValue(['200.152.38.10']);
  });

  it('lê o link, grava os dados da IA e substitui os trechos (GESTOR paga)', async () => {
    await service.processar('l1', GESTOR, { tipo: 'link' });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][1].headers['Accept-Language']).toContain('pt-BR');
    expect(deepseekCreate.mock.calls[0][0]).toMatchObject({
      model: 'deepseek-chat',
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });
    expect(manager.delete).toHaveBeenCalledWith(LegislacaoChunk, { legislacaoId: 'l1' });
    const linhas = manager.insert.mock.calls.flatMap((c) => c[1]);
    expect(linhas.length).toBeGreaterThan(0);
    expect(linhas.map((l: { ordem: number }) => l.ordem)).toEqual(linhas.map((_: unknown, i: number) => i));
    expect(linhas[0].embedding).toBe('[0,0.5]');

    const [entidade, id, dados] = manager.update.mock.calls[0];
    expect(entidade).toBe(Legislacao);
    expect(id).toBe('l1');
    expect(dados).toMatchObject({
      tipo: 'rdc',
      numero: '216',
      ano: 2004,
      orgaoEmissor: 'ANVISA',
      situacao: 'vigente',
      dataPublicacao: '2004-09-16',
      statusLeitura: StatusLeitura.CONCLUIDA,
      origemTexto: 'link',
      erroLeitura: null,
    });
    expect(dados.lidoEm).toBeInstanceOf(Date);
    expect(dados).not.toHaveProperty('titulo');
    expect(dados).not.toHaveProperty('informacoes');

    expect(credito.validarSaldoDisponivel).toHaveBeenCalledWith('g1');
    expect(credito.registrarUso).toHaveBeenCalledTimes(2);
    expect(credito.registrarUso.mock.calls.map((c) => c[0].metodoChamado)).toEqual([
      'lerLegislacao',
      'gerarEmbeddingsLegislacao',
    ]);
    expect(credito.registrarUso.mock.calls[1][0]).toMatchObject({
      modelo: 'text-embedding-3-small',
      tokensInput: linhas.length * 10,
    });
    expect(vinculo.ligarReferenciasAntigas).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'l1', tipo: 'rdc', numero: '216', ano: 2004 }),
    );
  });

  it('MASTER não paga nem valida saldo', async () => {
    await service.processar('l1', MASTER, { tipo: 'link' });
    expect(credito.validarSaldoDisponivel).not.toHaveBeenCalled();
    expect(credito.registrarUso).not.toHaveBeenCalled();
    expect(manager.update.mock.calls[0][2].statusLeitura).toBe(StatusLeitura.CONCLUIDA);
  });

  it('gera embeddings em lotes de no máximo 100', async () => {
    const texto = Array.from({ length: 250 }, (_, i) => `Art. ${i + 1}º ${'Texto do artigo com conteúdo. '.repeat(50)}`).join('\n\n');
    await service.processar('l1', MASTER, { tipo: 'texto', texto });
    const tamanhos = embeddingsCreate.mock.calls.map((c) => c[0].input.length);
    expect(tamanhos.length).toBeGreaterThan(1);
    expect(Math.max(...tamanhos)).toBeLessThanOrEqual(100);
    const linhas = manager.insert.mock.calls.flatMap((c) => c[1]);
    expect(linhas).toHaveLength(tamanhos.reduce((a: number, b: number) => a + b, 0));
  });

  it('página de firewall (texto curto) falha sem mexer nos trechos e dados', async () => {
    const firewall = readFileSync(join(__dirname, 'lib', '__fixtures__', 'firewall.html'), 'utf8');
    fetchFn.mockResolvedValue(resposta(200, firewall));
    await service.processar('l1', GESTOR, { tipo: 'link' });
    expect(repo.update).toHaveBeenCalledWith('l1', {
      statusLeitura: StatusLeitura.FALHOU,
      erroLeitura: 'Não foi possível ler o texto deste link. Anexe o PDF ou cole o texto da legislação.',
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(deepseekCreate).not.toHaveBeenCalled();
  });

  it('redirect para IP interno falha sem requisitar esse host', async () => {
    fetchFn.mockResolvedValueOnce(resposta(302, '', { location: 'http://169.254.169.254/latest/meta-data' }));
    await service.processar('l1', GESTOR, { tipo: 'link' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls.some((c) => String(c[0]).includes('169.254.169.254'))).toBe(false);
    expect(repo.update.mock.calls[0][1].statusLeitura).toBe(StatusLeitura.FALHOU);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('segue redirect para outro endereço público', async () => {
    fetchFn
      .mockResolvedValueOnce(resposta(301, '', { location: '/nova-url' }))
      .mockResolvedValueOnce(resposta(200, htmlLegislacao()));
    await service.processar('l1', MASTER, { tipo: 'link' });
    expect(fetchFn.mock.calls[1][0]).toBe('https://www.in.gov.br/nova-url');
    expect(manager.update.mock.calls[0][2].statusLeitura).toBe(StatusLeitura.CONCLUIDA);
  });

  it('HTTP diferente de 2xx falha com o código', async () => {
    fetchFn.mockResolvedValue(resposta(403, 'proibido'));
    await service.processar('l1', GESTOR, { tipo: 'link' });
    expect(repo.update.mock.calls[0][1].erroLeitura).toBe(
      'Não foi possível abrir este link (código 403). Anexe o PDF ou cole o texto da legislação.',
    );
  });

  it('corpo acima de 20 MB falha', async () => {
    const grande: RespostaHttp = {
      status: 200,
      headers: { 'content-type': 'text/html' },
      body: Readable.from([Buffer.alloc(15 * 1024 * 1024), Buffer.alloc(6 * 1024 * 1024)]),
      descartar: jest.fn(),
    };
    fetchFn.mockResolvedValue(grande);
    await expect(service.buscarConteudo('https://www.in.gov.br/x')).rejects.toThrow('passa de 20 MB');
    expect(grande.descartar).toHaveBeenCalled();
  });

  it('gestor sem saldo falha com a mensagem de créditos', async () => {
    credito.validarSaldoDisponivel.mockRejectedValue(new BadRequestException('Limite de créditos excedido'));
    await service.processar('l1', GESTOR, { tipo: 'link' });
    expect(repo.update).toHaveBeenCalledWith('l1', {
      statusLeitura: StatusLeitura.FALHOU,
      erroLeitura: 'Sem créditos de IA para ler a legislação.',
    });
    expect(deepseekCreate).not.toHaveBeenCalled();
  });

  it('valores inválidos da IA viram null; situação cai no indício da página', async () => {
    deepseekCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ ...dadosIa, ano: 'abc', situacao: 'x', dataPublicacao: '16/09/2004' }) } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    await service.processar('l1', MASTER, { tipo: 'link' });
    const dados = manager.update.mock.calls[0][2];
    expect(dados.ano).toBeNull();
    expect(dados.situacao).toBeNull();
    expect(dados.dataPublicacao).toBeNull();
  });

  it('fonte texto não busca o link e grava origem texto', async () => {
    const texto = htmlLegislacao().replace(/<[^>]+>/g, '\n');
    await service.processar('l1', MASTER, { tipo: 'texto', texto });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(manager.update.mock.calls[0][2].origemTexto).toBe('texto');
  });

  it('erro inesperado grava falhou com mensagem genérica e não lança', async () => {
    manager.delete.mockRejectedValue(new Error('banco'));
    await expect(service.processar('l1', MASTER, { tipo: 'link' })).resolves.toBeUndefined();
    expect(repo.update.mock.calls[0][1]).toEqual({
      statusLeitura: StatusLeitura.FALHOU,
      erroLeitura: 'Não foi possível ler esta legislação. Tente de novo.',
    });
  });

  it.each([
    ['DeepSeek', () => deepseekCreate.mockRejectedValue(new Error('timeout'))],
    ['OpenAI', () => embeddingsCreate.mockRejectedValue(new Error('timeout'))],
  ])('erro/timeout da IA (%s) grava a mensagem de tentar mais tarde', async (_nome, falhar) => {
    falhar();
    await service.processar('l1', MASTER, { tipo: 'link' });
    expect(repo.update.mock.calls[0][1]).toEqual({
      statusLeitura: StatusLeitura.FALHOU,
      erroLeitura: 'A leitura não pôde ser concluída agora. Tente de novo em alguns minutos.',
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('clientes de IA da leitura têm timeout de 60 s e 1 nova tentativa', () => {
    const config = { get: jest.fn().mockImplementation((_c: string, p?: string) => p ?? 'sk-teste') };
    const novo = new LegislacaoLeituraService({} as never, {} as never, {} as never, {} as never, config as never);
    const clientes = novo as unknown as { openai: { timeout: number; maxRetries: number }; deepseek: { timeout: number; maxRetries: number } };
    for (const cliente of [clientes.openai, clientes.deepseek]) {
      expect(cliente.timeout).toBe(60_000);
      expect(cliente.maxRetries).toBe(1);
    }
  });

  it('releitura mantém os dados anteriores quando a IA devolve nulo ou inválido', async () => {
    Object.assign(legislacao, {
      tipo: TipoLegislacao.RDC,
      numero: '216',
      ano: 2004,
      orgaoEmissor: 'ANVISA',
      ementa: 'Ementa anterior',
      dataPublicacao: '2004-09-16',
      situacao: 'vigente',
    });
    deepseekCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ tipo: 'x', numero: null, ano: 'abc', ementa: '', situacao: 'revogada' }) } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    await service.processar('l1', MASTER, { tipo: 'link' });
    expect(manager.update.mock.calls[0][2]).toMatchObject({
      tipo: 'rdc',
      numero: '216',
      ano: 2004,
      orgaoEmissor: 'ANVISA',
      ementa: 'Ementa anterior',
      dataPublicacao: '2004-09-16',
      situacao: 'revogada',
    });
  });

  it('tipo "outro" da IA não sobrescreve um tipo útil anterior', async () => {
    legislacao.tipo = TipoLegislacao.PORTARIA;
    deepseekCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ ...dadosIa, tipo: 'outro' }) } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    await service.processar('l1', MASTER, { tipo: 'link' });
    expect(manager.update.mock.calls[0][2].tipo).toBe('portaria');
  });

  it('texto colado curto após trim tem mensagem própria', async () => {
    await service.processar('l1', MASTER, { tipo: 'texto', texto: `   ${'a'.repeat(100)}   ` });
    expect(repo.update.mock.calls[0][1].erroLeitura).toBe(
      'O texto colado é curto demais. Cole o texto completo da legislação.',
    );
  });

  it('PDF sem texto extraível tem a mensagem de PDF ilegível', async () => {
    await service.processar('l1', MASTER, { tipo: 'pdf', buffer: Buffer.from('%PDF-1.4 inválido') });
    expect(repo.update.mock.calls[0][1].erroLeitura).toBe(
      'Não foi possível ler o texto deste PDF. Cole o texto da legislação.',
    );
  });

  it('corpo gzip que nunca termina: o timeout encerra a leitura com falhou', async () => {
    const servidor = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' });
      const gzip = zlib.createGzip();
      gzip.pipe(res);
      gzip.write('x'.repeat(1000));
      gzip.flush();
      // nunca termina
    });
    await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', () => ok()));
    const porta = (servidor.address() as { port: number }).port;
    try {
      service.timeoutMs = 300;
      // Host público fictício (validado pelo resolver mockado); a conexão vai ao servidor local.
      service.fetchFn = (_url, init) => buscarHttp(`http://127.0.0.1:${porta}/`, init);
      const inicio = Date.now();
      await service.processar('l1', MASTER, { tipo: 'link' });
      expect(Date.now() - inicio).toBeLessThan(3000);
      expect(repo.update).toHaveBeenCalledWith('l1', {
        statusLeitura: StatusLeitura.FALHOU,
        erroLeitura: 'O site demorou demais para responder. Anexe o PDF ou cole o texto da legislação.',
      });
    } finally {
      servidor.closeAllConnections();
      servidor.close();
    }
  });

  describe('iniciar', () => {
    it('marca lendo e devolve a entidade', async () => {
      legislacao.statusLeitura = StatusLeitura.CONCLUIDA;
      const processar = jest.spyOn(service, 'processar').mockResolvedValue(undefined);
      const resultado = await service.iniciar('l1', GESTOR, { tipo: 'link' });
      expect(resultado.statusLeitura).toBe(StatusLeitura.LENDO);
      expect(repo.update.mock.calls[0][1]).toEqual({ statusLeitura: StatusLeitura.LENDO, erroLeitura: null });
      expect(processar).toHaveBeenCalledWith('l1', GESTOR, { tipo: 'link' });
    });

    it('409 se a leitura já está em andamento', async () => {
      await expect(service.iniciar('l1', GESTOR, { tipo: 'texto', texto: 'x' })).rejects.toThrow(ConflictException);
      await expect(service.iniciar('l1', GESTOR, { tipo: 'texto', texto: 'x' })).rejects.toThrow(
        'A leitura desta legislação já está em andamento.',
      );
    });

    it('400 ao ler de novo uma legislação sem link', async () => {
      legislacao.statusLeitura = StatusLeitura.FALHOU;
      legislacao.linkOficial = null as unknown as string;
      await expect(service.iniciar('l1', GESTOR, { tipo: 'link' })).rejects.toThrow(
        'Esta legislação não tem link. Envie o PDF ou cole o texto.',
      );
    });
  });

  it('onModuleInit marca as leituras travadas há mais de 10 min', async () => {
    const antes = Date.now();
    await service.onModuleInit();
    const [filtro, valores] = repo.update.mock.calls[0];
    expect(filtro.statusLeitura).toBe(StatusLeitura.LENDO);
    const limite: Date = filtro.atualizadoEm.value;
    expect(antes - limite.getTime()).toBeGreaterThanOrEqual(10 * 60 * 1000 - 50);
    expect(valores).toEqual({
      statusLeitura: StatusLeitura.FALHOU,
      erroLeitura: 'A leitura foi interrompida. Tente de novo.',
    });
  });
});

describe('criarLookupSeguro', () => {
  it('recusa host que resolve para IP privado e conecta no IP público validado', (done) => {
    const privado = criarLookupSeguro((_h, cb) => cb(null, [{ address: '10.0.0.5', family: 4 }]));
    privado('interno.exemplo', {}, (err) => {
      expect(err?.message).toBe('Este link não é um endereço público permitido.');
      const publico = criarLookupSeguro((_h, cb) => cb(null, [{ address: '200.152.38.10', family: 4 }]));
      publico('www.in.gov.br', {}, (erro, endereco) => {
        expect(erro).toBeNull();
        expect(endereco).toBe('200.152.38.10');
        done();
      });
    });
  });
});
