import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auditoria, StatusAuditoria } from '../entities/auditoria.entity';
import { AuditoriaItem } from '../entities/auditoria-item.entity';
import { PlanoAcaoTarefa } from '../../plano-acao/entities/plano-acao-tarefa.entity';
import { PerfilUsuario } from '../../usuario/entities/usuario.entity';
import { TipoRespostaCustomizada } from '../../checklist/entities/template-item.entity';
import {
  FAIXAS_PADRAO,
  FaixaClassificacao,
  classificar,
  ehNaoConformidade,
  ehRotuloNaoAplicavel,
  getPontuacaoMaximaItem,
  isOpcaoSemPontuacao,
  sentidoDaOpcao,
} from '../../checklist/regras';

export interface ResultadoGrupo {
  /** Chave de agrupamento (`grupoId` do item do checklist ou 'sem-grupo') */
  grupoId: string;
  nome: string;
  aproveitamento: number | null;
  pontosPossiveis: number;
  pontosRealizados: number;
  naoAplicaveis: number;
  naoConformidades: number;
  naoRespondidas: number;
}

export interface ResultadoAuditoria {
  aproveitamento: number;
  classificacao: { nome: string; cor: string | null; emoji: string | null };
  faixas: FaixaClassificacao[];
  tendencia: 'subiu' | 'caiu' | 'igual' | null;
  anteriores: { id: string; dataFim: string; aproveitamento: number }[];
  contadores: {
    pontosPossiveis: number;
    pontosRealizados: number;
    naoConformidades: number;
    fotos: number;
    planosAcao: number;
  };
  grupos: ResultadoGrupo[];
}

type UsuarioAutenticado = { id: string; perfil: PerfilUsuario; gestorId?: string | null };

const arredondar = (n: number): number => Math.round(n * 100) / 100;

/**
 * Fonte única do cartão de resultado da auditoria (tela e PDF).
 */
@Injectable()
export class ResultadoAuditoriaService {
  constructor(
    @InjectRepository(Auditoria)
    private readonly auditoriaRepository: Repository<Auditoria>,
    @InjectRepository(PlanoAcaoTarefa)
    private readonly planoTarefaRepository: Repository<PlanoAcaoTarefa>,
  ) {}

  async calcular(auditoria: Auditoria, usuario?: UsuarioAutenticado): Promise<ResultadoAuditoria> {
    const itens = auditoria.itens ?? [];
    const grupos = this.calcularGrupos(itens);
    const pontosPossiveis = grupos.reduce((acc, g) => acc + g.pontosPossiveis, 0);
    const pontosRealizados = grupos.reduce((acc, g) => acc + g.pontosRealizados, 0);

    const finalizada = auditoria.status === StatusAuditoria.FINALIZADA;
    const aproveitamento = finalizada
      ? Number(auditoria.pontuacaoTotal) || 0
      : pontosPossiveis > 0
        ? arredondar((pontosRealizados / pontosPossiveis) * 100)
        : 0;

    const faixasDoChecklist = auditoria.template?.faixasClassificacao;
    const faixas: FaixaClassificacao[] =
      faixasDoChecklist && faixasDoChecklist.length > 0
        ? faixasDoChecklist
        : FAIXAS_PADRAO.map((f) => ({ ...f }));
    const { nome, cor, emoji } = classificar(aproveitamento, faixas);

    const anteriores = await this.buscarAnteriores(auditoria, usuario);
    const tendencia = this.calcularTendencia(aproveitamento, anteriores[0]?.aproveitamento);

    const planosAcao = await this.planoTarefaRepository.count({ where: { auditoriaId: auditoria.id } });

    return {
      aproveitamento,
      classificacao: { nome, cor, emoji },
      faixas,
      tendencia,
      anteriores,
      contadores: {
        pontosPossiveis,
        pontosRealizados,
        naoConformidades: grupos.reduce((acc, g) => acc + g.naoConformidades, 0),
        fotos: itens.reduce((acc, item) => acc + (item.fotos?.length ?? 0), 0),
        planosAcao,
      },
      grupos,
    };
  }

  private calcularTendencia(atual: number, anterior: number | undefined): 'subiu' | 'caiu' | 'igual' | null {
    if (anterior === undefined) return null;
    const a = arredondar(atual);
    const b = arredondar(anterior);
    if (a > b) return 'subiu';
    if (a < b) return 'caiu';
    return 'igual';
  }

  private async buscarAnteriores(
    auditoria: Auditoria,
    usuario?: UsuarioAutenticado,
  ): Promise<ResultadoAuditoria['anteriores']> {
    const qb = this.auditoriaRepository
      .createQueryBuilder('auditoria')
      .leftJoin('auditoria.consultor', 'consultor')
      .where('auditoria.unidadeId = :unidadeId', { unidadeId: auditoria.unidadeId })
      .andWhere('auditoria.templateId = :templateId', { templateId: auditoria.templateId })
      .andWhere('auditoria.status = :status', { status: StatusAuditoria.FINALIZADA })
      .andWhere('auditoria.id != :id', { id: auditoria.id });
    if (auditoria.status === StatusAuditoria.FINALIZADA && auditoria.dataFim) {
      qb.andWhere('auditoria.dataFim < :dataFim', { dataFim: auditoria.dataFim });
    }
    if (usuario) {
      if (usuario.perfil === PerfilUsuario.MASTER || usuario.perfil === PerfilUsuario.GESTOR) {
        qb.andWhere('(auditoria.consultorId = :userId OR consultor.gestorId = :userId)', { userId: usuario.id });
      } else {
        qb.andWhere('auditoria.consultorId = :userId', { userId: usuario.id });
      }
    }
    const anteriores = await qb.orderBy('auditoria.dataFim', 'DESC').take(3).getMany();
    return anteriores.map((a) => ({
      id: a.id,
      dataFim: new Date(a.dataFim).toISOString(),
      aproveitamento: Number(a.pontuacaoTotal) || 0,
    }));
  }

  private calcularGrupos(itens: AuditoriaItem[]): ResultadoGrupo[] {
    const porGrupo = new Map<string, AuditoriaItem[]>();
    for (const item of itens) {
      const chave = item.templateItem?.grupoId || 'sem-grupo';
      if (!porGrupo.has(chave)) porGrupo.set(chave, []);
      porGrupo.get(chave)!.push(item);
    }
    return Array.from(porGrupo.entries())
      .sort(([, a], [, b]) => (a[0].templateItem?.grupo?.ordem || 0) - (b[0].templateItem?.grupo?.ordem || 0))
      .map(([grupoId, grupoItens]) => {
        const pontuaveis = grupoItens.filter(
          (item) =>
            !isOpcaoSemPontuacao(item.resposta || '') &&
            item.templateItem?.tipoRespostaCustomizada !== TipoRespostaCustomizada.TEXTO,
        );
        const pontosPossiveis = pontuaveis.reduce((acc, i) => acc + getPontuacaoMaximaItem(i.templateItem), 0);
        const pontosRealizados = pontuaveis.reduce((acc, i) => acc + Number(i.pontuacao || 0), 0);
        return {
          grupoId,
          nome: grupoItens[0].templateItem?.grupo?.nome || 'Sem Grupo',
          aproveitamento: pontosPossiveis > 0 ? arredondar((pontosRealizados / pontosPossiveis) * 100) : null,
          pontosPossiveis,
          pontosRealizados,
          naoAplicaveis: grupoItens.filter((i) => this.ehNaoAplicavel(i)).length,
          naoConformidades: grupoItens.filter((i) => ehNaoConformidade(i.templateItem, i.resposta)).length,
          naoRespondidas: grupoItens.filter((i) => !i.resposta || i.resposta === 'nao_avaliado').length,
        };
      });
  }

  private ehNaoAplicavel(item: AuditoriaItem): boolean {
    if (!item.resposta) return false;
    return (
      sentidoDaOpcao(item.templateItem, item.resposta) === 'neutra' &&
      (item.resposta === 'nao_aplicavel' || ehRotuloNaoAplicavel(item.resposta))
    );
  }
}
