import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssinaturaService } from '../plano/assinatura.service';
import { PerfilUsuario, Usuario } from '../usuario/entities/usuario.entity';
import { ModeloRelatorioTecnico } from './entities/modelo-relatorio-tecnico.entity';
import {
  ModeloSecao,
  mesclarComPadrao,
  modeloPadrao,
  validarModelo,
} from './modelo-secoes';

interface UsuarioModelo {
  id: string;
  perfil: PerfilUsuario;
  gestorId?: string | null;
}

export interface ModeloRelatorioTecnicoResposta {
  secoes: ModeloSecao[];
  podePersonalizar: boolean;
}

/**
 * Modelo do relatório técnico por gestor (RN-REL-009 a RN-REL-011).
 */
@Injectable()
export class ModeloRelatorioTecnicoService {
  constructor(
    @InjectRepository(ModeloRelatorioTecnico)
    private readonly modeloRepository: Repository<ModeloRelatorioTecnico>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    private readonly assinaturaService: AssinaturaService,
  ) {}

  /** AUDITOR segue o modelo do gestor; GESTOR e MASTER são donos do próprio modelo. */
  resolverDono(usuario: UsuarioModelo): string | null {
    if (usuario.perfil === PerfilUsuario.AUDITOR) {
      return usuario.gestorId ?? null;
    }
    return usuario.id;
  }

  /** MASTER sempre pode; demais dependem do plano da assinatura ativa. */
  async podePersonalizar(donoId: string): Promise<boolean> {
    const dono = await this.usuarioRepository.findOne({
      where: { id: donoId },
      select: ['id', 'perfil'],
    });
    if (dono?.perfil === PerfilUsuario.MASTER) {
      return true;
    }
    const assinatura = await this.assinaturaService.buscarAssinaturaAtivaComValidacao(donoId);
    return assinatura?.plano?.permiteModeloRelatorioTecnico === true;
  }

  /** Modelo aplicado hoje: sem dono, sem registro ou sem recurso no plano → padrão. */
  async obterVigente(donoId: string | null): Promise<ModeloSecao[]> {
    if (!donoId) {
      return modeloPadrao();
    }
    const registro = await this.modeloRepository.findOne({ where: { gestorId: donoId } });
    if (!registro || !(await this.podePersonalizar(donoId))) {
      return modeloPadrao();
    }
    return mesclarComPadrao(registro.secoes);
  }

  async obterParaUsuario(usuario: UsuarioModelo): Promise<ModeloRelatorioTecnicoResposta> {
    const donoId = this.resolverDono(usuario);
    const podePersonalizar =
      usuario.perfil !== PerfilUsuario.AUDITOR && donoId !== null
        ? await this.podePersonalizar(donoId)
        : false;
    return { secoes: await this.obterVigente(donoId), podePersonalizar };
  }

  async salvar(
    usuario: UsuarioModelo,
    secoes: ModeloSecao[],
  ): Promise<ModeloRelatorioTecnicoResposta> {
    if (usuario.perfil === PerfilUsuario.AUDITOR) {
      throw new ForbiddenException('Apenas gestores podem personalizar o relatório técnico.');
    }
    if (!(await this.podePersonalizar(usuario.id))) {
      throw new ForbiddenException(
        'Seu plano atual não inclui a personalização do relatório técnico.',
      );
    }
    const erro = validarModelo(secoes);
    if (erro) {
      throw new BadRequestException(erro);
    }
    const mescladas = mesclarComPadrao(secoes);
    const existente = await this.modeloRepository.findOne({ where: { gestorId: usuario.id } });
    const entidade = existente
      ? Object.assign(existente, { secoes: mescladas })
      : this.modeloRepository.create({ gestorId: usuario.id, secoes: mescladas });
    await this.modeloRepository.save(entidade);
    return { secoes: mescladas, podePersonalizar: true };
  }
}
