import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PerfilUsuario, Usuario } from '../usuario/entities/usuario.entity';
import { AgendaAuditoria, RecorrenciaAgenda, StatusAgenda } from './entities/agenda-auditoria.entity';
import { AtualizarAgendaDto, CriarAgendaDto, ListarAgendaDto } from './dto/agenda.dto';
import { PaginatedResult, createPaginatedResult } from '../../shared/types/pagination.interface';

interface UsuarioAutenticado {
  id: string;
  perfil: PerfilUsuario;
  gestorId?: string | null;
}

/** Calcula a próxima data de uma recorrência (yyyy-mm-dd, em UTC para evitar deslocamento de fuso). */
export function proximaDataRecorrencia(data: string, recorrencia: RecorrenciaAgenda): string | null {
  if (recorrencia === RecorrenciaAgenda.NENHUMA) return null;
  const d = new Date(`${data.slice(0, 10)}T00:00:00Z`);
  if (recorrencia === RecorrenciaAgenda.SEMANAL) d.setUTCDate(d.getUTCDate() + 7);
  else if (recorrencia === RecorrenciaAgenda.QUINZENAL) d.setUTCDate(d.getUTCDate() + 14);
  else {
    const dia = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(dia, ultimo));
  }
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class AgendaService {
  constructor(
    @InjectRepository(AgendaAuditoria)
    private readonly repo: Repository<AgendaAuditoria>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) {}

  private gestorDoTenant(usuario: UsuarioAutenticado): string {
    if (usuario.perfil === PerfilUsuario.AUDITOR) {
      if (!usuario.gestorId) throw new ForbiddenException('Auditor sem gestor vinculado.');
      return usuario.gestorId;
    }
    return usuario.id;
  }

  /** RN-AGD-002/003: isolamento por gestor; auditor vê apenas agendamentos sob sua responsabilidade. */
  private escopo(usuario: UsuarioAutenticado): SelectQueryBuilder<AgendaAuditoria> {
    const qb = this.repo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.unidade', 'unidade')
      .leftJoinAndSelect('unidade.cliente', 'cliente')
      .leftJoinAndSelect('a.template', 'template')
      .leftJoinAndSelect('a.responsavel', 'responsavel')
      .where('a.gestorId = :gestorId', { gestorId: this.gestorDoTenant(usuario) });
    if (usuario.perfil === PerfilUsuario.AUDITOR) {
      qb.andWhere('a.responsavelId = :uid', { uid: usuario.id });
    }
    return qb;
  }

  private async validarReferencias(
    dados: { unidadeId?: string; templateId?: string; responsavelId?: string },
    usuario: UsuarioAutenticado,
  ): Promise<void> {
    const gestorId = this.gestorDoTenant(usuario);
    if (dados.unidadeId) {
      const ok = await this.repo.query(
        `SELECT u.id FROM unidades u JOIN clientes c ON c.id = u.cliente_id WHERE u.id = $1 AND c.gestor_id = $2`,
        [dados.unidadeId, gestorId],
      );
      if (ok.length === 0) throw new BadRequestException('Unidade inválida para este gestor.');
    }
    if (dados.templateId) {
      const ok = await this.repo.query(
        `SELECT id FROM checklist_templates WHERE id = $1 AND gestor_id = $2`,
        [dados.templateId, gestorId],
      );
      if (ok.length === 0) throw new BadRequestException('Checklist inválido para este gestor.');
    }
    if (dados.responsavelId) {
      const resp = await this.usuarioRepo.findOne({ where: { id: dados.responsavelId } });
      if (!resp || (resp.id !== gestorId && resp.gestorId !== gestorId)) {
        throw new BadRequestException('Responsável inválido para este gestor.');
      }
    }
  }

  async criar(dto: CriarAgendaDto, usuario: UsuarioAutenticado): Promise<AgendaAuditoria> {
    if (usuario.perfil === PerfilUsuario.AUDITOR) {
      throw new ForbiddenException('Apenas gestor pode agendar auditorias.');
    }
    await this.validarReferencias(dto, usuario);
    return this.repo.save(
      this.repo.create({
        gestorId: this.gestorDoTenant(usuario),
        criadoPorId: usuario.id,
        unidadeId: dto.unidadeId,
        templateId: dto.templateId,
        responsavelId: dto.responsavelId ?? null,
        dataPrevista: dto.dataPrevista.slice(0, 10),
        recorrencia: dto.recorrencia ?? RecorrenciaAgenda.NENHUMA,
        observacao: dto.observacao ?? null,
      }),
    );
  }

  async listar(filtros: ListarAgendaDto, usuario: UsuarioAutenticado): Promise<PaginatedResult<AgendaAuditoria>> {
    const qb = this.escopo(usuario);
    if (filtros.status) qb.andWhere('a.status = :status', { status: filtros.status });
    if (filtros.responsavelId) qb.andWhere('a.responsavelId = :resp', { resp: filtros.responsavelId });
    if (filtros.de) qb.andWhere('a.dataPrevista >= :de', { de: filtros.de.slice(0, 10) });
    if (filtros.ate) qb.andWhere('a.dataPrevista <= :ate', { ate: filtros.ate.slice(0, 10) });
    const [items, total] = await qb
      .orderBy('a.dataPrevista', 'ASC')
      .skip((filtros.page - 1) * filtros.limit)
      .take(filtros.limit)
      .getManyAndCount();
    return createPaginatedResult(items, total, filtros.page, filtros.limit);
  }

  private async buscar(id: string, usuario: UsuarioAutenticado): Promise<AgendaAuditoria> {
    const item = await this.escopo(usuario).andWhere('a.id = :id', { id }).getOne();
    if (!item) throw new NotFoundException('Agendamento não encontrado.');
    return item;
  }

  async atualizar(id: string, dto: AtualizarAgendaDto, usuario: UsuarioAutenticado): Promise<AgendaAuditoria> {
    if (usuario.perfil === PerfilUsuario.AUDITOR) {
      throw new ForbiddenException('Apenas gestor pode alterar agendamentos.');
    }
    const item = await this.buscar(id, usuario);
    await this.validarReferencias({ responsavelId: dto.responsavelId }, usuario);
    if (dto.status === StatusAgenda.REALIZADA) {
      return this.concluir(id, usuario);
    }
    await this.repo.update(item.id, {
      ...(dto.responsavelId !== undefined && { responsavelId: dto.responsavelId }),
      ...(dto.dataPrevista !== undefined && { dataPrevista: dto.dataPrevista.slice(0, 10) }),
      ...(dto.recorrencia !== undefined && { recorrencia: dto.recorrencia }),
      ...(dto.observacao !== undefined && { observacao: dto.observacao }),
      ...(dto.status !== undefined && { status: dto.status }),
    });
    return this.buscar(id, usuario);
  }

  /** RN-AGD-005: ao concluir um agendamento recorrente, o próximo é criado automaticamente. */
  async concluir(id: string, usuario: UsuarioAutenticado): Promise<AgendaAuditoria> {
    const item = await this.buscar(id, usuario);
    if (item.status !== StatusAgenda.AGENDADA) {
      throw new BadRequestException('Apenas agendamentos pendentes podem ser concluídos.');
    }
    await this.repo.update(item.id, { status: StatusAgenda.REALIZADA, realizadaEm: new Date() });
    const proxima = proximaDataRecorrencia(item.dataPrevista, item.recorrencia);
    if (proxima) {
      await this.repo.save(
        this.repo.create({
          gestorId: item.gestorId,
          criadoPorId: item.criadoPorId,
          unidadeId: item.unidadeId,
          templateId: item.templateId,
          responsavelId: item.responsavelId,
          dataPrevista: proxima,
          recorrencia: item.recorrencia,
          observacao: item.observacao,
        }),
      );
    }
    return this.buscar(id, usuario);
  }

  async remover(id: string, usuario: UsuarioAutenticado): Promise<void> {
    if (usuario.perfil === PerfilUsuario.AUDITOR) {
      throw new ForbiddenException('Apenas gestor pode remover agendamentos.');
    }
    const item = await this.buscar(id, usuario);
    await this.repo.delete(item.id);
  }
}
