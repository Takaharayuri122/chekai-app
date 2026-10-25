import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfiguracaoPerguntaImportadaDto, ConfirmarImportacaoDto } from './importar-checklist.dto';

const opcoesValidacao = { whitelist: true, forbidNonWhitelisted: true };

const configuracao = (extra: Record<string, unknown> = {}) => ({
  categoria: 'outro',
  criticidade: 'media',
  tipoResposta: 'padrao',
  peso: 1,
  obrigatorio: true,
  permiteFoto: true,
  permiteObservacao: true,
  opcoes: [
    { valor: 'conforme', fotoObrigatoria: false, observacaoObrigatoria: false },
    { valor: 'nao_aplicavel', pontuacao: null, fotoObrigatoria: false, observacaoObrigatoria: false },
  ],
  ...extra,
});

async function erros(classe: new () => object, dados: unknown) {
  return validate(plainToInstance(classe, dados) as object, opcoesValidacao);
}

describe('ConfiguracaoPerguntaImportadaDto', () => {
  it('aceita opção sem pontuação e opção com pontuação null', async () => {
    expect(await erros(ConfiguracaoPerguntaImportadaDto, configuracao())).toHaveLength(0);
  });

  it('peso precisa ser inteiro de 0 a 100', async () => {
    expect(await erros(ConfiguracaoPerguntaImportadaDto, configuracao({ peso: 1.5 }))).not.toHaveLength(0);
    expect(await erros(ConfiguracaoPerguntaImportadaDto, configuracao({ peso: -1 }))).not.toHaveLength(0);
    expect(await erros(ConfiguracaoPerguntaImportadaDto, configuracao({ peso: 101 }))).not.toHaveLength(0);
    expect(await erros(ConfiguracaoPerguntaImportadaDto, configuracao({ peso: 0 }))).toHaveLength(0);
  });
});

describe('ConfirmarImportacaoDto', () => {
  const pergunta = { pergunta: 'P', configuracao: configuracao() };
  const dto = (grupos: unknown[]) => ({ dados: { nomeTemplate: 'X' }, grupos });

  it('limita a 200 grupos', async () => {
    const grupos = Array.from({ length: 201 }, (_, i) => ({ nome: `G${i}`, perguntas: [pergunta] }));
    expect(await erros(ConfirmarImportacaoDto, dto(grupos))).not.toHaveLength(0);
    expect(await erros(ConfirmarImportacaoDto, dto(grupos.slice(0, 200)))).toHaveLength(0);
  });

  it('limita a 1000 perguntas por grupo', async () => {
    const perguntas = Array.from({ length: 1001 }, () => pergunta);
    expect(await erros(ConfirmarImportacaoDto, dto([{ nome: 'G', perguntas }]))).not.toHaveLength(0);
    expect(await erros(ConfirmarImportacaoDto, dto([{ nome: 'G', perguntas: perguntas.slice(0, 1000) }]))).toHaveLength(0);
  });
});
