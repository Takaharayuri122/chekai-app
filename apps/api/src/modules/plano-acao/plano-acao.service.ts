import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AuditoriaItem } from '../auditoria/entities/auditoria-item.entity';
import { ehNaoConformidade } from '../checklist/regras';
import { nomesLegislacoesDoItem } from '../legislacao/lib/legislacoes-do-item';
import { PerfilUsuario, Usuario } from '../usuario/entities/usuario.entity';
import { PlanoAcaoTarefa, StatusTarefaPlanoAcao } from './entities/plano-acao-tarefa.entity';
import {
  AtualizarTarefaPlanoAcaoDto,
  CriarTarefaPlanoAcaoDto,
  ListarTarefasPlanoAcaoDto,
} from './dto/plano-acao.dto';
import { PaginatedResult, createPaginatedResult } from '../../shared/types/pagination.interface';

interface UsuarioAutenticado {
  id: string;
  perfil: PerfilUsuario;
  gestorId?: string | null;
}

export interface ResumoPlanoAcao {
  atrasadas: number;
  proximos7Dias: number;
  futuras: number;
  concluidas: number;
}

const STATUS_ABERTOS = [StatusTarefaPlanoAcao.PENDENTE, StatusTarefaPlanoAcao.EM_ANDAMENTO];

@Injectable()
export class PlanoAcaoService {
  constructor(
    @InjectRepository(PlanoAcaoTarefa)
    private readonly repo: Repository<PlanoAcaoTarefa>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(AuditoriaItem)
    private readonly itemRepo: Repository<AuditoriaItem>,
  ) {}

  private gestorDoTenant(usuario: UsuarioAutenticado): string {
    if (usuario.perfil === PerfilUsuario.AUDITOR) {
      if (!usuario.gestorId) {
        throw new ForbiddenException('Auditor sem gestor vinculado.');
      }
      return usuario.gestorId;
    }
    return usuario.id;
  }

  /** RN-PAC-002/003: isolamento por gestor; auditor vê apenas tarefas próprias ou sob sua responsabilidade. */
  private escopo(usuario: UsuarioAutenticado): SelectQueryBuilder<PlanoAcaoTarefa> {
    const qb = this.repo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.responsavel', 'responsavel')
      .leftJoinAndSelect('t.auditoria', 'auditoria')
      .leftJoinAndSelect('auditoria.unidade', 'unidade')
      .where('t.gestorId = :gestorId', { gestorId: this.gestorDoTenant(usuario) });
    if (usuario.perfil === PerfilUsuario.AUDITOR) {
      qb.andWhere('(t.responsavelId = :uid OR t.criadoPorId = :uid)', { uid: usuario.id });
    }
    return qb;
  }

  private async validarResponsavel(responsavelId: string, usuario: UsuarioAutenticado): Promise<void> {
    const gestorId = this.gestorDoTenant(usuario);
    const resp = await this.usuarioRepo.findOne({ where: { id: responsavelId } });
    if (!resp || (resp.id !== gestorId && resp.gestorId !== gestorId)) {
      throw new BadRequestException('Responsável inválido para este gestor.');
    }
  }

  private async validarAuditoria(auditoriaId: string, usuario: UsuarioAutenticado): Promise<void> {
    const gestorId = this.gestorDoTenant(usuario);
    const ok: Array<{ id: string }> = await this.repo.query(
      `SELECT a.id FROM auditorias a JOIN usuarios u ON u.id = a.consultor_id
       WHERE a.id = $1 AND (u.id = $2 OR u.gestor_id = $2)`,
      [auditoriaId, gestorId],
    );
    if (ok.length === 0) throw new BadRequestException('Auditoria inválida para este gestor.');
  }

  /** RN-PAC-008: gera uma tarefa por item não conforme, sem duplicar títulos já existentes na auditoria. */
  async gerarDaAuditoria(
    auditoriaId: string,
    usuario: UsuarioAutenticado,
  ): Promise<{ criadas: number }> {
    await this.validarAuditoria(auditoriaId, usuario);
    const todosItens = await this.itemRepo.find({
      where: { auditoriaId },
      relations: ['templateItem', 'legislacoes', 'templateItem.legislacoes'],
    });
    const itens = todosItens.filter((item) => ehNaoConformidade(item.templateItem, item.resposta));
    const existentes = await this.repo.find({ where: { auditoriaId }, select: ['titulo'] });
    const titulosExistentes = new Set(existentes.map((t) => t.titulo));
    const prazo = new Date(Date.now() + 15 * 86_400_000).toISOString().slice(0, 10);
    const novas = itens
      .map((item) => ({
        item,
        titulo: (item.templateItem?.pergunta ?? 'Item não conforme').slice(0, 200),
      }))
      .filter(({ titulo }) => !titulosExistentes.has(titulo))
      .map(({ item, titulo }) =>
        this.repo.create({
          gestorId: this.gestorDoTenant(usuario),
          criadoPorId: usuario.id,
          auditoriaId,
          titulo,
          descricao:
            item.planoAcaoFinal || item.planoAcaoSugerido || item.descricaoNaoConformidade || null,
          prazo,
          referenciaLegal: nomesLegislacoesDoItem(item),
        }),
      );
    if (novas.length > 0) await this.repo.save(novas);
    return { criadas: novas.length };
  }

  async criar(dto: CriarTarefaPlanoAcaoDto, usuario: UsuarioAutenticado): Promise<PlanoAcaoTarefa> {
    if (dto.responsavelId) {
      await this.validarResponsavel(dto.responsavelId, usuario);
    }
    if (dto.auditoriaId) {
      await this.validarAuditoria(dto.auditoriaId, usuario);
    }
    const tarefa = this.repo.create({
      gestorId: this.gestorDoTenant(usuario),
      criadoPorId: usuario.id,
      titulo: dto.titulo,
      descricao: dto.descricao ?? null,
      responsavelId: dto.responsavelId ?? null,
      auditoriaId: dto.auditoriaId ?? null,
      prazo: dto.prazo.slice(0, 10),
    });
    return this.repo.save(tarefa);
  }

  async listar(
    filtros: ListarTarefasPlanoAcaoDto,
    usuario: UsuarioAutenticado,
  ): Promise<PaginatedResult<PlanoAcaoTarefa>> {
    const qb = this.escopo(usuario);
    if (filtros.status) qb.andWhere('t.status = :status', { status: filtros.status });
    if (filtros.responsavelId) {
      qb.andWhere('t.responsavelId = :resp', { resp: filtros.responsavelId });
    }
    const [items, total] = await qb
      .orderBy('t.prazo', 'ASC')
      .skip((filtros.page - 1) * filtros.limit)
      .take(filtros.limit)
      .getManyAndCount();
    return createPaginatedResult(items, total, filtros.page, filtros.limit);
  }

  async resumo(usuario: UsuarioAutenticado): Promise<ResumoPlanoAcao> {
    const tarefas = await this.escopo(usuario).getMany();
    const hoje = new Date().toISOString().slice(0, 10);
    const limite = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const resumo: ResumoPlanoAcao = { atrasadas: 0, proximos7Dias: 0, futuras: 0, concluidas: 0 };
    for (const t of tarefas) {
      if (t.status === StatusTarefaPlanoAcao.CONCLUIDA) resumo.concluidas++;
      else if (!STATUS_ABERTOS.includes(t.status)) continue;
      else if (t.prazo < hoje) resumo.atrasadas++;
      else if (t.prazo <= limite) resumo.proximos7Dias++;
      else resumo.futuras++;
    }
    return resumo;
  }

  private async buscar(id: string, usuario: UsuarioAutenticado): Promise<PlanoAcaoTarefa> {
    const tarefa = await this.escopo(usuario).andWhere('t.id = :id', { id }).getOne();
    if (!tarefa) throw new NotFoundException('Tarefa não encontrada.');
    return tarefa;
  }

  async atualizar(
    id: string,
    dto: AtualizarTarefaPlanoAcaoDto,
    usuario: UsuarioAutenticado,
  ): Promise<PlanoAcaoTarefa> {
    const tarefa = await this.buscar(id, usuario);
    if (dto.responsavelId) await this.validarResponsavel(dto.responsavelId, usuario);
    const patch: Partial<
      Pick<PlanoAcaoTarefa, 'titulo' | 'descricao' | 'responsavelId' | 'prazo' | 'status' | 'concluidaEm'>
    > = {};
    if (dto.titulo !== undefined) patch.titulo = dto.titulo;
    if (dto.descricao !== undefined) patch.descricao = dto.descricao;
    if (dto.responsavelId !== undefined) patch.responsavelId = dto.responsavelId;
    if (dto.prazo !== undefined) patch.prazo = dto.prazo.slice(0, 10);
    if (dto.status !== undefined) {
      patch.status = dto.status;
      patch.concluidaEm = dto.status === StatusTarefaPlanoAcao.CONCLUIDA ? new Date() : null;
    }
    await this.repo.update(tarefa.id, patch);
    return this.buscar(id, usuario);
  }

  async remover(id: string, usuario: UsuarioAutenticado): Promise<void> {
    if (usuario.perfil === PerfilUsuario.AUDITOR) {
      throw new ForbiddenException('Apenas gestor pode remover tarefas.');
    }
    const tarefa = await this.buscar(id, usuario);
    await this.repo.delete(tarefa.id);
  }
}
