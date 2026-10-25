import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LegislacaoController } from './legislacao.controller';
import { LegislacaoService } from './legislacao.service';
import { LegislacaoLeituraService } from './legislacao-leitura.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PodeGerenciarLegislacoesGuard } from './guards/pode-gerenciar-legislacoes.guard';

const ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

describe('LegislacaoController (rotas de leitura)', () => {
  let app: INestApplication;
  let base: string;
  const leitura = { iniciar: jest.fn().mockResolvedValue({ id: ID, statusLeitura: 'lendo' }) };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [LegislacaoController],
      providers: [
        { provide: LegislacaoService, useValue: {} },
        { provide: LegislacaoLeituraService, useValue: leitura },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
          ctx.switchToHttp().getRequest().user = { id: 'u1', perfil: 'master' };
          return true;
        },
      })
      .overrideGuard(PodeGerenciarLegislacoesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.listen(0);
    base = `${await app.getUrl()}/legislacoes`.replace('[::1]', 'localhost');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => leitura.iniciar.mockClear());

  function enviarArquivo(conteudo: Buffer, tipo = 'application/pdf') {
    const form = new FormData();
    form.append('arquivo', new Blob([new Uint8Array(conteudo)], { type: tipo }), 'lei.pdf');
    return fetch(`${base}/${ID}/arquivo`, { method: 'POST', body: form });
  }

  it('aceita PDF e inicia a leitura com o buffer', async () => {
    const resposta = await enviarArquivo(Buffer.from('%PDF-1.4 conteúdo'));
    expect(resposta.status).toBe(200);
    expect(leitura.iniciar).toHaveBeenCalledWith(ID, expect.objectContaining({ id: 'u1' }), {
      tipo: 'pdf',
      buffer: expect.any(Buffer),
    });
  });

  it('recusa arquivo que não é PDF', async () => {
    const resposta = await enviarArquivo(Buffer.from('não é pdf'), 'text/plain');
    expect(resposta.status).toBe(400);
    expect((await resposta.json()).message).toBe('Envie um arquivo PDF de até 20 MB.');
    expect(leitura.iniciar).not.toHaveBeenCalled();
  });

  it('recusa PDF acima de 20 MB com 400', async () => {
    const grande = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(20 * 1024 * 1024)]);
    const resposta = await enviarArquivo(grande);
    expect(resposta.status).toBe(400);
    expect((await resposta.json()).message).toBe('Envie um arquivo PDF de até 20 MB.');
  });

  it('texto colado curto dá 400; texto válido inicia a leitura', async () => {
    const curto = await fetch(`${base}/${ID}/texto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: 'curto' }),
    });
    expect(curto.status).toBe(400);
    const texto = 'a'.repeat(600);
    const ok = await fetch(`${base}/${ID}/texto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    });
    expect(ok.status).toBe(200);
    expect(leitura.iniciar).toHaveBeenCalledWith(ID, expect.anything(), { tipo: 'texto', texto });
  });

  it('ler-novamente inicia a leitura pelo link', async () => {
    const resposta = await fetch(`${base}/${ID}/ler-novamente`, { method: 'POST' });
    expect(resposta.status).toBe(200);
    expect(leitura.iniciar).toHaveBeenCalledWith(ID, expect.anything(), { tipo: 'link' });
  });
});
