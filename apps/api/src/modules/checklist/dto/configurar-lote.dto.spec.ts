import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfigurarLoteDto } from './configurar-lote.dto';

const opcoesValidacao = { whitelist: true, forbidNonWhitelisted: true };

const corpo = (opcao: Record<string, unknown>) => ({
  alteracoes: {
    tipoResposta: 'personalizada',
    opcoes: [
      { valor: 'Sim', fotoObrigatoria: false, observacaoObrigatoria: false },
      { fotoObrigatoria: false, observacaoObrigatoria: false, ...opcao },
    ],
  },
});

async function erros(dados: unknown) {
  return validate(plainToInstance(ConfigurarLoteDto, dados) as object, opcoesValidacao);
}

describe('ConfigurarLoteDto', () => {
  it('aceita valor e valorOriginal com até 100 caracteres', async () => {
    const texto = 'a'.repeat(100);
    expect(await erros(corpo({ valor: texto, valorOriginal: texto }))).toHaveLength(0);
  });

  it('recusa valor com mais de 100 caracteres (limite da resposta gravada na auditoria)', async () => {
    expect(await erros(corpo({ valor: 'a'.repeat(101) }))).not.toHaveLength(0);
  });

  it('recusa valorOriginal com mais de 100 caracteres', async () => {
    expect(await erros(corpo({ valor: 'Não', valorOriginal: 'a'.repeat(101) }))).not.toHaveLength(0);
  });
});
