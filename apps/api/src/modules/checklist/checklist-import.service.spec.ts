import { BadRequestException } from '@nestjs/common';
import { ChecklistImportService } from './checklist-import.service';
import { ConfirmarImportacaoDto } from './dto/importar-checklist.dto';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { StatusTemplate } from './entities/checklist-template.entity';

const configTexto = {
  categoria: 'geral',
  criticidade: 'media',
  tipoResposta: 'texto',
  peso: 1,
  obrigatorio: true,
  permiteFoto: true,
  permiteObservacao: true,
  opcoes: [],
} as any;

function montar() {
  const salvos: any[] = [];
  const manager = {
    create: jest.fn((_e: any, d: any) => ({ ...d })),
    save: jest.fn(async (_e: any, d: any) => {
      const r = { ...d, id: d.id ?? `id-${salvos.length + 1}` };
      salvos.push(r);
      return r;
    }),
  };
  const transaction = jest.fn(async (fn: any) => fn(manager));
  const templateRepository: any = { manager: { transaction } };
  const service = new ChecklistImportService(templateRepository, {} as any, {} as any);
  return { service, manager, transaction, salvos };
}

const usuario = { id: 'u1', perfil: PerfilUsuario.GESTOR };
const dtoBase = (grupos: ConfirmarImportacaoDto['grupos']): ConfirmarImportacaoDto => ({
  dados: { nomeTemplate: 'Meu checklist' },
  grupos,
});

describe('ChecklistImportService.confirmar', () => {
  it('cria template rascunho com gestorId do usuário', async () => {
    const { service, salvos, transaction } = montar();
    const r = await service.confirmar(
      dtoBase([{ nome: 'G1', perguntas: [{ pergunta: 'P1', configuracao: configTexto }] }]),
      usuario,
    );
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(salvos[0]).toMatchObject({ nome: 'Meu checklist', gestorId: 'u1', status: StatusTemplate.RASCUNHO });
    expect(r).toMatchObject({ gruposCriados: 1, itensCriados: 1, nomeTemplate: 'Meu checklist' });
  });

  it('aplica regras forçadas', async () => {
    const { service, salvos } = montar();
    await service.confirmar(
      dtoBase([{ nome: 'G1', perguntas: [{ pergunta: 'P1', configuracao: configTexto }] }]),
      usuario,
    );
    const item = salvos.find((s) => s.pergunta === 'P1');
    expect(item.peso).toBe(0);
    expect(item.opcoesResposta).toBeNull();
  });

  it('pergunta vazia é ignorada com aviso', async () => {
    const { service } = montar();
    const r = await service.confirmar(
      dtoBase([
        {
          nome: 'G1',
          perguntas: [
            { pergunta: '  ', configuracao: configTexto },
            { pergunta: 'P2', configuracao: configTexto },
          ],
        },
      ]),
      usuario,
    );
    expect(r.itensCriados).toBe(1);
    expect(r.avisos).toHaveLength(1);
  });

  it('grupos sem perguntas não são criados', async () => {
    const { service, salvos } = montar();
    const r = await service.confirmar(
      dtoBase([
        { nome: 'Vazio', perguntas: [] },
        { nome: 'G2', perguntas: [{ pergunta: 'P', configuracao: configTexto }] },
      ]),
      usuario,
    );
    expect(r.gruposCriados).toBe(1);
    expect(salvos.some((s) => s.nome === 'Vazio')).toBe(false);
  });

  it('todas as perguntas vazias → BadRequestException dentro da transação', async () => {
    const { service, transaction } = montar();
    await expect(
      service.confirmar(
        dtoBase([{ nome: 'G1', perguntas: [{ pergunta: '  ', configuracao: configTexto }] }, { nome: 'G2', perguntas: [] }]),
        usuario,
      ),
    ).rejects.toThrow(new BadRequestException('Nenhuma pergunta válida para importar'));
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('erro no meio → transação não confirma', async () => {
    const { service, manager } = montar();
    let n = 0;
    manager.save.mockImplementation(async (_e: any, d: any) => {
      if (++n === 3) throw new Error('falha');
      return { ...d, id: `id-${n}` };
    });
    await expect(
      service.confirmar(
        dtoBase([{ nome: 'G1', perguntas: [{ pergunta: 'P1', configuracao: configTexto }] }]),
        usuario,
      ),
    ).rejects.toThrow('falha');
  });
});
