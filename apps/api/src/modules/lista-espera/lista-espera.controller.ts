import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ListaEsperaService } from './lista-espera.service';
import { InscreverListaEsperaDto } from './dto/inscrever-lista-espera.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { Public } from '../../core/decorators/public.decorator';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { ListaEspera } from './entities/lista-espera.entity';
import { PaginatedResult } from '../../shared/types/pagination.interface';

/**
 * Controller para lista de espera (inscrição pública e listagem apenas para Master).
 */
@ApiTags('Lista de Espera')
@Controller('lista-espera')
@UseGuards(JwtAuthGuard)
export class ListaEsperaController {
  constructor(private readonly listaEsperaService: ListaEsperaService) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Inscreve e-mail e telefone na lista de espera (público)' })
  @ApiResponse({ status: 201, description: 'Inscrição realizada com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 409, description: 'E-mail já inscrito na lista de espera' })
  async inscrever(
    @Body() dto: InscreverListaEsperaDto,
  ): Promise<{ message: string }> {
    return this.listaEsperaService.inscrever(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PerfilUsuario.MASTER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista inscrições da lista de espera (apenas Master)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Página' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limite por página' })
  @ApiResponse({ status: 200, description: 'Lista paginada de inscrições' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  async listar(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ): Promise<PaginatedResult<ListaEspera>> {
    return this.listaEsperaService.listar({ page, limit });
  }
}
