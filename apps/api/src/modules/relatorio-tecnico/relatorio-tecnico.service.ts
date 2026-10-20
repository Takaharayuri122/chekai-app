import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { ModeloRelatorioTecnicoService } from './modelo-relatorio-tecnico.service';
import {
  ModeloSecao,
  SecaoConfiguravel,
  modeloPadrao,
  secaoAtiva,
  tituloSecao,
} from './modelo-secoes';

/** Campo HTML da entidade preenchido por cada seção de texto configurável. */
const CAMPO_HTML_POR_SECAO: ReadonlyArray<[SecaoConfiguravel, keyof RelatorioTecnico]> = [
  ['descricaoOcorrencia', 'descricaoOcorrenciaHtml'],
  ['avaliacaoTecnica', 'avaliacaoTecnicaHtml'],
  ['recomendacoesConsultora', 'recomendacoesConsultoraHtml'],
  ['planoAcaoSugerido', 'planoAcaoSugeridoHtml'],
];

interface UsuarioAutenticado {
  id: string;
  perfil: PerfilUsuario;
  gestorId?: string | null;
  nome?: string;
}

@Injectable()
export class RelatorioTecnicoService {
  constructor(
    @InjectRepository(RelatorioTecnico)
    private readonly relatorioTecnicoRepository: Repository<RelatorioTecnico>,
    @InjectRepository(RelatorioTecnicoFoto)
    private readonly relatorioTecnicoFotoRepository: Repository<RelatorioTecnicoFoto>,
    private readonly clienteService: ClienteService,
    private readonly iaService: IaService,
    private readonly modeloRelatorioTecnicoService: ModeloRelatorioTecnicoService,
  ) {}

  async criar(
    dto: CriarRelatorioTecnicoDto,
    usuario: UsuarioAutenticado,
  ): Promise<RelatorioTecnico> {
    await this.validarVinculoClienteUnidade(dto.clienteId, dto.unidadeId, usuario);
    const entidade = this.relatorioTecnicoRepository.create({
      ...dto,
      descricaoOcorrenciaHtml: dto.descricaoOcorrenciaHtml ?? '',
      avaliacaoTecnicaHtml: dto.avaliacaoTecnicaHtml ?? '',
      acoesExecutadas: dto.acoesExecutadas ?? [],
      recomendacoesConsultoraHtml: dto.recomendacoesConsultoraHtml ?? '',
      planoAcaoSugeridoHtml: dto.planoAcaoSugeridoHtml ?? '',
      consultoraId: usuario.id,
      unidadeId: dto.unidadeId ?? null,
      apoioAnaliticoChekAi: dto.apoioAnaliticoChekAi ?? null,
      assinaturaNomeConsultora: dto.assinaturaNomeConsultora ?? '',
      responsavel: dto.responsavel ?? '',
      status: dto.status ?? StatusRelatorioTecnico.RASCUNHO,
    });
    return this.relatorioTecnicoRepository.save(entidade);
  }

  async iniciar(
    dto: IniciarRelatorioTecnicoDto,
    usuario: UsuarioAutenticado,
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
      responsavel: '',
      status: StatusRelatorioTecnico.RASCUNHO,
    });
    return this.relatorioTecnicoRepository.save(entidade);
  }

  async listar(
    filtro: ListarRelatoriosTecnicosDto,
    usuario: UsuarioAutenticado,
  ): Promise<PaginatedResult<RelatorioTecnico>> {
    const qb = this.relatorioTecnicoRepository.createQueryBuilder('rt')
      .leftJoinAndSelect('rt.cliente', 'cliente')
      .leftJoinAndSelect('cliente.gestor', 'clienteGestor')
      .leftJoinAndSelect('rt.unidade', 'unidade')
      .leftJoinAndSelect('rt.consultora', 'consultora')
      .leftJoinAndSelect('rt.fotos', 'fotos');
    if (usuario.perfil === PerfilUsuario.MASTER || usuario.perfil === PerfilUsuario.GESTOR) {
      qb.where(
        '(rt.consultoraId = :userId OR consultora.gestorId = :userId)',
        { userId: usuario.id },
      );
    } else {
      qb.where('rt.consultoraId = :userId', { userId: usuario.id });
    }
    if (filtro.clienteId) {
      qb.andWhere('rt.clienteId = :clienteId', { clienteId: filtro.clienteId });
    }
    if (filtro.status) {
      qb.andWhere('rt.status = :status', { status: filtro.status });
    }
    if (filtro.dataInicio && filtro.dataFim) {
      qb.andWhere('rt.criadoEm BETWEEN :dataInicio AND :dataFim', {
        dataInicio: new Date(filtro.dataInicio),
        dataFim: new Date(filtro.dataFim),
      });
    }
    qb.orderBy('rt.criadoEm', 'DESC')
      .skip((filtro.page - 1) * filtro.limit)
      .take(filtro.limit);
    const [items, total] = await qb.getManyAndCount();
    return createPaginatedResult(items, total, filtro.page, filtro.limit);
  }

  async buscarPorId(
    id: string,
    usuario: UsuarioAutenticado,
  ): Promise<RelatorioTecnico> {
    const relatorio = await this.relatorioTecnicoRepository.findOne({
      where: { id },
      relations: ['cliente', 'cliente.gestor', 'unidade', 'consultora', 'fotos'],
    });
    if (!relatorio) {
      throw new NotFoundException('Relatório técnico não encontrado');
    }
    this.validarAcessoRelatorio(relatorio, usuario);
    return relatorio;
  }

  async atualizar(
    id: string,
    dto: Partial<CriarRelatorioTecnicoDto>,
    usuario: UsuarioAutenticado,
  ): Promise<RelatorioTecnico> {
    const relatorio = await this.buscarPorId(id, usuario);
    if (dto.clienteId || dto.unidadeId !== undefined) {
      await this.validarVinculoClienteUnidade(
        dto.clienteId ?? relatorio.clienteId,
        dto.unidadeId ?? relatorio.unidadeId,
        usuario,
      );
    }
    const jaFinalizado = relatorio.status === StatusRelatorioTecnico.FINALIZADO;
    let snapshot: ModeloSecao[] | null = relatorio.modeloSecoes ?? null;
    if (jaFinalizado) {
      // RN-REL-012: relatório finalizado segue o snapshot (legado sem snapshot → padrão)
      const mesclado = this.mesclarRelatorioParaAtualizacao(relatorio, dto);
      this.validarRelatorioMinimoParaConclusao(mesclado, 'finalizacao', snapshot ?? modeloPadrao());
    } else if (dto.status === StatusRelatorioTecnico.FINALIZADO) {
      // RN-REL-012: snapshot gravado somente na transição para finalizado
      const modelo = await this.modeloRelatorioTecnicoService.obterVigente(
        this.resolverDonoModelo(relatorio),
      );
      const mesclado = this.mesclarRelatorioParaAtualizacao(relatorio, dto);
      this.validarRelatorioMinimoParaConclusao(mesclado, 'finalizacao', modelo);
      snapshot = modelo;
    }
    Object.assign(relatorio, {
      modeloSecoes: snapshot,
      ...dto,
      unidadeId: dto.unidadeId === undefined ? relatorio.unidadeId : dto.unidadeId ?? null,
    });
    return this.relatorioTecnicoRepository.save(relatorio);
  }

  async remover(id: string, usuario: UsuarioAutenticado): Promise<void> {
    const relatorio = await this.buscarPorId(id, usuario);
    await this.relatorioTecnicoFotoRepository.delete({ relatorioTecnicoId: relatorio.id });
    await this.relatorioTecnicoRepository.delete({ id: relatorio.id });
  }

  async atualizarApoioAnalitico(
    id: string,
    promptComplementar: string | undefined,
    usuario: UsuarioAutenticado,
  ): Promise<RelatorioTecnico> {
    const relatorio = await this.buscarPorId(id, usuario);
    const modelo = await this.modeloEfetivo(relatorio);
    if (!secaoAtiva(modelo, 'apoioAnalitico')) {
      throw new ConflictException('O apoio analítico não está habilitado no modelo deste relatório.');
    }
    this.validarRelatorioMinimoParaConclusao(relatorio, 'apoio', modelo);
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
    usuario: UsuarioAutenticado,
  ): Promise<void> {
    const relatorio = await this.buscarPorId(id, usuario);
    await this.relatorioTecnicoRepository.update(relatorio.id, {
      pdfUrl,
      pdfGeradoEm: new Date(),
    });
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
    usuario: UsuarioAutenticado,
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
    usuario: UsuarioAutenticado,
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

  /** Modelo aplicado ao relatório: snapshot se finalizado, senão o vigente do dono. */
  async modeloEfetivo(relatorio: RelatorioTecnico): Promise<ModeloSecao[]> {
    if (relatorio.status === StatusRelatorioTecnico.FINALIZADO) {
      return relatorio.modeloSecoes ?? modeloPadrao();
    }
    return this.modeloRelatorioTecnicoService.obterVigente(this.resolverDonoModelo(relatorio));
  }

  /** Relatório com o modelo efetivo como propriedade de resposta (nunca persistida). */
  async buscarComModelo(
    id: string,
    usuario: UsuarioAutenticado,
  ): Promise<RelatorioTecnico & { modeloEfetivo: ModeloSecao[] }> {
    const relatorio = await this.buscarPorId(id, usuario);
    return { ...relatorio, modeloEfetivo: await this.modeloEfetivo(relatorio) };
  }

  /** O dono do modelo é definido pela consultora do relatório, não por quem visualiza. */
  private resolverDonoModelo(relatorio: RelatorioTecnico): string | null {
    const consultora = relatorio.consultora;
    if (!consultora) {
      return null;
    }
    return this.modeloRelatorioTecnicoService.resolverDono(consultora);
  }

  private validarAcessoRelatorio(
    relatorio: RelatorioTecnico,
    usuario: UsuarioAutenticado,
  ): void {
    if (relatorio.consultoraId === usuario.id) {
      return;
    }
    if (usuario.perfil === PerfilUsuario.MASTER || usuario.perfil === PerfilUsuario.GESTOR) {
      const consultora = relatorio.consultora;
      if (consultora && consultora.gestorId === usuario.id) {
        return;
      }
    }
    throw new ForbiddenException('Acesso negado a este relatório');
  }

  private async validarVinculoClienteUnidade(
    clienteId: string,
    unidadeId: string | null | undefined,
    usuario: UsuarioAutenticado,
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

  private mesclarRelatorioParaAtualizacao(
    relatorio: RelatorioTecnico,
    dto: Partial<CriarRelatorioTecnicoDto>,
  ): RelatorioTecnico {
    return {
      ...relatorio,
      ...dto,
      unidadeId:
        dto.unidadeId === undefined ? relatorio.unidadeId : dto.unidadeId ?? null,
    } as RelatorioTecnico;
  }

  private validarRelatorioMinimoParaConclusao(
    relatorio: RelatorioTecnico,
    contexto: 'apoio' | 'finalizacao',
    modelo: ModeloSecao[],
  ): void {
    const sufixo =
      contexto === 'apoio'
        ? 'antes de gerar o apoio analítico'
        : 'antes de finalizar o relatório';
    if (!relatorio.identificacao || relatorio.identificacao.trim() === '') {
      throw new ConflictException(`Preencha a seção "Identificação" ${sufixo}`);
    }
    for (const [secao, campo] of CAMPO_HTML_POR_SECAO) {
      const valor = relatorio[campo];
      if (secaoAtiva(modelo, secao) && (!valor || (typeof valor === 'string' && valor.trim() === ''))) {
        throw new ConflictException(`Preencha a seção "${tituloSecao(modelo, secao)}" ${sufixo}`);
      }
    }
    if (
      secaoAtiva(modelo, 'acoesExecutadas') &&
      (!relatorio.acoesExecutadas || relatorio.acoesExecutadas.length === 0)
    ) {
      throw new ConflictException(
        `Adicione ao menos um item em "${tituloSecao(modelo, 'acoesExecutadas')}" ${sufixo}`,
      );
    }
  }
}
