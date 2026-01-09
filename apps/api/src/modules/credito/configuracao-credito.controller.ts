import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ConfiguracaoCreditoService } from './configuracao-credito.service';
import { ConfigurarCreditoDto } from './dto/configurar-credito.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { ConfiguracaoCredito } from './entities/configuracao-credito.entity';

/**
 * Controller para gestão de configurações de créditos de IA.
 * Apenas usuários Master podem acessar.
 */
@ApiTags('Configurações de Créditos')
@Controller('configuracoes-credito')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.MASTER)
@ApiBearerAuth()
export class ConfiguracaoCreditoController {
  constructor(
    private readonly configuracaoCreditoService: ConfiguracaoCreditoService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista todas as configurações de crédito (apenas Master)' })
  @ApiResponse({ status: 200, description: 'Lista de configurações' })
  async listar(): Promise<ConfiguracaoCredito[]> {
    return this.configuracaoCreditoService.listar();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma configuração pelo ID (apenas Master)' })
  @ApiResponse({ status: 200, description: 'Configuração encontrada' })
  @ApiResponse({ status: 404, description: 'Configuração não encontrada' })
  async buscarPorId(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConfiguracaoCredito> {
    return this.configuracaoCreditoService.buscarPorId(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria ou atualiza uma configuração de crédito (apenas Master)' })
  @ApiResponse({ status: 201, description: 'Configuração criada/atualizada com sucesso' })
  async criarOuAtualizar(
    @Body() dto: ConfigurarCreditoDto,
    @CurrentUser() usuario: { perfil: PerfilUsuario },
  ): Promise<ConfiguracaoCredito> {
    return this.configuracaoCreditoService.criarOuAtualizar(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza uma configuração de crédito (apenas Master)' })
  @ApiResponse({ status: 200, description: 'Configuração atualizada com sucesso' })
  @ApiResponse({ status: 404, description: 'Configuração não encontrada' })
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<ConfigurarCreditoDto>,
    @CurrentUser() usuario: { perfil: PerfilUsuario },
  ): Promise<ConfiguracaoCredito> {
    const existente = await this.configuracaoCreditoService.buscarPorId(id);
    const dtoCompleto: ConfigurarCreditoDto = {
      provedor: dto.provedor || existente.provedor,
      modelo: dto.modelo || existente.modelo,
      tokensPorCredito: dto.tokensPorCredito ?? existente.tokensPorCredito,
      ativo: dto.ativo !== undefined ? dto.ativo : existente.ativo,
    };
    return this.configuracaoCreditoService.criarOuAtualizar(dtoCompleto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma configuração de crédito (apenas Master)' })
  @ApiResponse({ status: 200, description: 'Configuração removida com sucesso' })
  @ApiResponse({ status: 404, description: 'Configuração não encontrada' })
  async remover(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { perfil: PerfilUsuario },
  ): Promise<void> {
    const configuracao = await this.configuracaoCreditoService.buscarPorId(id);
    // Marca como inativa em vez de deletar
    await this.configuracaoCreditoService.criarOuAtualizar({
      provedor: configuracao.provedor,
      modelo: configuracao.modelo,
      tokensPorCredito: configuracao.tokensPorCredito,
      ativo: false,
    });
  }
}

