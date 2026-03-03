import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { ClienteService } from '../cliente/cliente.service';
import { IaService } from '../ia/ia.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import {
  PaginatedResult,
  createPaginatedResult,
} from '../../shared/types/pagination.interface';
import { CriarRelatorioTecnicoDto } from './dto/criar-relatorio-tecnico.dto';
import { IniciarRelatorioTecnicoDto } from './dto/iniciar-relatorio-tecnico.dto';
import { ListarRelatoriosTecnicosDto } from './dto/listar-relatorios-tecnicos.dto';
import {
  RelatorioTecnico,
  StatusRelatorioTecnico,
} from './entities/relatorio-tecnico.entity';
import { RelatorioTecnicoFoto } from './entities/relatorio-tecnico-foto.entity';

@Injectable()
export class RelatorioTecnicoService {
  constructor(
    @InjectRepository(RelatorioTecnico)
    private readonly relatorioTecnicoRepository: Repository<RelatorioTecnico>,
    @InjectRepository(RelatorioTecnicoFoto)
    private readonly relatorioTecnicoFotoRepository: Repository<RelatorioTecnicoFoto>,
    private readonly clienteService: ClienteService,
    private readonly iaService: IaService,
  ) {}

  async criar(
    dto: CriarRelatorioTecnicoDto,
    usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<RelatorioTecnico> {
    await this.validarVinculoClienteUnidade(dto.clienteId, dto.unidadeId, usuario);
    const entidade = this.relatorioTecnicoRepository.create({
      ...dto,
      consultoraId: usuario.id,
      unidadeId: dto.unidadeId ?? null,
      apoioAnaliticoChekAi: dto.apoioAnaliticoChekAi ?? null,
      assinaturaNomeConsultora: dto.assinaturaNomeConsultora ?? '',
      status: dto.status ?? StatusRelatorioTecnico.RASCUNHO,
    });
    return this.relatorioTecnicoRepository.save(entidade);
  }

  async iniciar(
    dto: IniciarRelatorioTecnicoDto,
    usuario: { id: string; perfil: PerfilUsuario; nome?: string },
  ): Promise<RelatorioTecnico> {
    await this.validarVinculoClienteUnidade(dto.clienteId, dto.unidadeId, usuario);
    const entidade = this.relatorioTecnicoRepository.create({
      clienteId: dto.clienteId,
      unidadeId: dto.unidadeId,
      consultoraId: usuario.id,
      identificacao: '',
      descricaoOcorrenciaHtml: '',
      avaliacaoTecnicaHtml: '',
      acoesExecutadas: [],
      recomendacoesConsultoraHtml: '',
      planoAcaoSugeridoHtml: '',
      apoioAnaliticoChekAi: null,
      assinaturaNomeConsultora: usuario.nome ?? '',
      status: StatusRelatorioTecnico.RASCUNHO,
    });
    return this.relatorioTecnicoRepository.save(entidade);
  }

  async listar(
    filtro: ListarRelatoriosTecnicosDto,
    usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<PaginatedResult<RelatorioTecnico>> {
    const where: Record<string, unknown> = {};
    if (usuario.perfil !== PerfilUsuario.MASTER) {
      where.consultoraId = usuario.id;
    }
    if (filtro.clienteId) {
      where.clienteId = filtro.clienteId;
    }
    if (filtro.status) {
      where.status = filtro.status;
    }
    if (filtro.dataInicio && filtro.dataFim) {
      where.criadoEm = Between(new Date(filtro.dataInicio), new Date(filtro.dataFim));
    }
    const [items, total] = await this.relatorioTecnicoRepository.findAndCount({
      where,
      relations: ['cliente', 'cliente.gestor', 'unidade', 'consultora', 'fotos'],
      order: { criadoEm: 'DESC' },
      skip: (filtro.page - 1) * filtro.limit,
      take: filtro.limit,
    });
    return createPaginatedResult(items, total, filtro.page, filtro.limit);
  }

  async buscarPorId(
    id: string,
    usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<RelatorioTecnico> {
    const relatorio = await this.relatorioTecnicoRepository.findOne({
      where: { id },
      relations: ['cliente', 'cliente.gestor', 'unidade', 'consultora', 'fotos'],
    });
    if (!relatorio) {
      throw new NotFoundException('Relatório técnico não encontrado');
    }
    if (usuario.perfil !== PerfilUsuario.MASTER && relatorio.consultoraId !== usuario.id) {
      throw new ForbiddenException('Acesso negado a este relatório');
    }
    return relatorio;
  }

  async atualizar(
    id: string,
    dto: Partial<CriarRelatorioTecnicoDto>,
    usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<RelatorioTecnico> {
    const relatorio = await this.buscarPorId(id, usuario);
    if (dto.clienteId || dto.unidadeId !== undefined) {
      await this.validarVinculoClienteUnidade(
        dto.clienteId ?? relatorio.clienteId,
        dto.unidadeId ?? relatorio.unidadeId,
        usuario,
      );
    }
    Object.assign(relatorio, {
      ...dto,
      unidadeId: dto.unidadeId === undefined ? relatorio.unidadeId : dto.unidadeId ?? null,
    });
    return this.relatorioTecnicoRepository.save(relatorio);
  }

  async remover(id: string, usuario: { id: string; perfil: PerfilUsuario }): Promise<void> {
    const relatorio = await this.buscarPorId(id, usuario);
    await this.relatorioTecnicoFotoRepository.delete({ relatorioTecnicoId: relatorio.id });
    await this.relatorioTecnicoRepository.delete({ id: relatorio.id });
  }

  async atualizarApoioAnalitico(
    id: string,
    promptComplementar: string | undefined,
    usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<RelatorioTecnico> {
    const relatorio = await this.buscarPorId(id, usuario);
    this.validarCamposObrigatoriosParaApoio(relatorio);
    const apoioAnaliticoChekAi = await this.iaService.gerarApoioAnaliticoRelatorioTecnico(
      {
        identificacao: relatorio.identificacao,
        descricaoOcorrenciaHtml: relatorio.descricaoOcorrenciaHtml,
        avaliacaoTecnicaHtml: relatorio.avaliacaoTecnicaHtml,
        acoesExecutadas: relatorio.acoesExecutadas,
        recomendacoesConsultoraHtml: relatorio.recomendacoesConsultoraHtml,
        planoAcaoSugeridoHtml: relatorio.planoAcaoSugeridoHtml,
        nomeConsultora: relatorio.assinaturaNomeConsultora || relatorio.consultora?.nome || '',
        contextoComplementar: promptComplementar ?? '',
      },
      usuario,
    );
    relatorio.apoioAnaliticoChekAi = apoioAnaliticoChekAi;
    return this.relatorioTecnicoRepository.save(relatorio);
  }

  async atualizarPdfUrl(
    id: string,
    pdfUrl: string,
    usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<void> {
    const relatorio = await this.buscarPorId(id, usuario);
    relatorio.pdfUrl = pdfUrl;
    relatorio.pdfGeradoEm = new Date();
    await this.relatorioTecnicoRepository.save(relatorio);
  }

  async adicionarFoto(
    relatorioId: string,
    dadosFoto: {
      url: string;
      nomeOriginal?: string;
      mimeType?: string;
      tamanhoBytes?: number;
      exif?: Record<string, unknown> | null;
    },
    usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<RelatorioTecnicoFoto> {
    await this.buscarPorId(relatorioId, usuario);
    const foto = this.relatorioTecnicoFotoRepository.create({
      ...dadosFoto,
      nomeOriginal: dadosFoto.nomeOriginal ?? null,
      mimeType: dadosFoto.mimeType ?? null,
      tamanhoBytes: dadosFoto.tamanhoBytes ?? null,
      exif: dadosFoto.exif ?? null,
      relatorioTecnicoId: relatorioId,
    });
    return this.relatorioTecnicoFotoRepository.save(foto);
  }

  async removerFoto(
    relatorioId: string,
    fotoId: string,
    usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<void> {
    await this.buscarPorId(relatorioId, usuario);
    const foto = await this.relatorioTecnicoFotoRepository.findOne({
      where: { id: fotoId, relatorioTecnicoId: relatorioId },
    });
    if (!foto) {
      throw new NotFoundException('Foto não encontrada no relatório técnico');
    }
    await this.relatorioTecnicoFotoRepository.delete({ id: foto.id });
  }

  private async validarVinculoClienteUnidade(
    clienteId: string,
    unidadeId: string | null | undefined,
    usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<void> {
    const cliente = await this.clienteService.buscarClientePorId(clienteId, usuario);
    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }
    if (!unidadeId) {
      return;
    }
    const unidade = await this.clienteService.buscarUnidadePorId(unidadeId, usuario);
    if (unidade.clienteId !== clienteId) {
      throw new ConflictException('A unidade informada não pertence ao cliente selecionado');
    }
  }

  private validarCamposObrigatoriosParaApoio(relatorio: RelatorioTecnico): void {
    const camposObrigatorios: Array<keyof RelatorioTecnico> = [
      'identificacao',
      'descricaoOcorrenciaHtml',
      'avaliacaoTecnicaHtml',
      'recomendacoesConsultoraHtml',
      'planoAcaoSugeridoHtml',
    ];
    for (const campo of camposObrigatorios) {
      const valor = relatorio[campo];
      if (!valor || (typeof valor === 'string' && valor.trim() === '')) {
        throw new ConflictException(
          `Preencha o campo ${campo} antes de gerar o apoio analítico`,
        );
      }
    }
    if (!relatorio.acoesExecutadas || relatorio.acoesExecutadas.length === 0) {
      throw new ConflictException(
        'Adicione ao menos uma ação executada antes de gerar o apoio analítico',
      );
    }
  }
}
