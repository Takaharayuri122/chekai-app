import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FaixaClassificacaoDto } from './criar-checklist-template.dto';

const faixa = (emoji: string | null) => ({ nome: 'Bom', cor: 'success', emoji, de: 0, ate: 100 });

async function erros(dados: unknown) {
  return validate(plainToInstance(FaixaClassificacaoDto, dados) as object);
}

describe('FaixaClassificacaoDto', () => {
  it('aceita emoji com até 32 caracteres', async () => {
    expect(await erros(faixa('a'.repeat(32)))).toHaveLength(0);
  });

  it('recusa emoji com mais de 32 caracteres', async () => {
    expect(await erros(faixa('a'.repeat(33)))).not.toHaveLength(0);
  });
});
