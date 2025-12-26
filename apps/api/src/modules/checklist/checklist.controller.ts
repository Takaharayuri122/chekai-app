import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ChecklistService } from './checklist.service';
import { MokiImportService } from './moki-import.service';
import {
  CriarChecklistTemplateDto,
  CriarTemplateItemDto,
  CriarChecklistGrupoDto,
} from './dto/criar-checklist-template.dto';
import { ImportarMokiDto, ImportacaoPreview, ImportacaoResultado } from './dto/importar-moki.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { ChecklistTemplate } from './entities/checklist-template.entity';
import { TemplateItem } from './entities/template-item.entity';
import { ChecklistGrupo } from './entities/checklist-grupo.entity';
import { TipoAtividade } from '../cliente/entities/cliente.entity';
import { PaginatedResult } from '../../shared/types/pagination.interface';

/**
 * Controller para gestão de templates de checklist.
 */
@ApiTags('Checklists')
@Controller('checklists')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChecklistController {
  constructor(
    private readonly checklistService: ChecklistService,
    private readonly mokiImportService: MokiImportService,
  ) {}

  @Post('templates')
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.ANALISTA)
  @ApiOperation({ summary: 'Cria um novo template de checklist' })
  @ApiResponse({ status: 201, description: 'Template criado com sucesso' })
  async criarTemplate(
    @Body() dto: CriarChecklistTemplateDto,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<ChecklistTemplate> {
    return this.checklistService.criarTemplate(dto, usuario);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Lista todos os templates de checklist' })
  @ApiResponse({ status: 200, description: 'Lista de templates' })
  async listarTemplates(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<PaginatedResult<ChecklistTemplate>> {
    return this.checklistService.listarTemplates({ page, limit }, usuario);
  }

  @Get('templates/tipo/:tipo')
  @ApiOperation({ summary: 'Lista templates por tipo de atividade' })
  @ApiResponse({ status: 200, description: 'Lista de templates filtrada' })
  async listarTemplatesPorTipo(
    @Param('tipo') tipo: TipoAtividade,
  ): Promise<ChecklistTemplate[]> {
    return this.checklistService.listarTemplatesPorTipo(tipo);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Busca um template pelo ID' })
  @ApiResponse({ status: 200, description: 'Template encontrado' })
  async buscarTemplatePorId(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<ChecklistTemplate> {
    return this.checklistService.buscarTemplatePorId(id, usuario);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Atualiza um template' })
  @ApiResponse({ status: 200, description: 'Template atualizado' })
  async atualizarTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CriarChecklistTemplateDto>,
  ): Promise<ChecklistTemplate> {
    return this.checklistService.atualizarTemplate(id, dto);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Remove um template' })
  @ApiResponse({ status: 200, description: 'Template removido' })
  async removerTemplate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.checklistService.removerTemplate(id);
  }

  @Post('templates/:templateId/itens')
  @ApiOperation({ summary: 'Adiciona um item ao template' })
  @ApiResponse({ status: 201, description: 'Item adicionado' })
  async adicionarItem(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() dto: CriarTemplateItemDto,
  ): Promise<TemplateItem> {
    return this.checklistService.adicionarItem(templateId, dto);
  }

  @Put('itens/:itemId')
  @ApiOperation({ summary: 'Atualiza um item do template' })
  @ApiResponse({ status: 200, description: 'Item atualizado' })
  async atualizarItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: Partial<CriarTemplateItemDto>,
  ): Promise<TemplateItem> {
    return this.checklistService.atualizarItem(itemId, dto);
  }

  @Delete('itens/:itemId')
  @ApiOperation({ summary: 'Remove um item do template' })
  @ApiResponse({ status: 200, description: 'Item removido' })
  async removerItem(@Param('itemId', ParseUUIDPipe) itemId: string): Promise<void> {
    return this.checklistService.removerItem(itemId);
  }

  @Get('templates/:templateId/grupos')
  @ApiOperation({ summary: 'Lista os grupos de um template' })
  @ApiResponse({ status: 200, description: 'Lista de grupos' })
  async listarGrupos(
    @Param('templateId', ParseUUIDPipe) templateId: string,
  ): Promise<ChecklistGrupo[]> {
    return this.checklistService.listarGrupos(templateId);
  }

  @Post('templates/:templateId/grupos')
  @ApiOperation({ summary: 'Adiciona um grupo ao template' })
  @ApiResponse({ status: 201, description: 'Grupo adicionado' })
  async adicionarGrupo(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() dto: CriarChecklistGrupoDto,
  ): Promise<ChecklistGrupo> {
    return this.checklistService.adicionarGrupo(templateId, dto);
  }

  @Put('grupos/:grupoId')
  @ApiOperation({ summary: 'Atualiza um grupo do template' })
  @ApiResponse({ status: 200, description: 'Grupo atualizado' })
  async atualizarGrupo(
    @Param('grupoId', ParseUUIDPipe) grupoId: string,
    @Body() dto: Partial<CriarChecklistGrupoDto>,
  ): Promise<ChecklistGrupo> {
    return this.checklistService.atualizarGrupo(grupoId, dto);
  }

  @Delete('grupos/:grupoId')
  @ApiOperation({ summary: 'Remove um grupo do template' })
  @ApiResponse({ status: 200, description: 'Grupo removido' })
  async removerGrupo(@Param('grupoId', ParseUUIDPipe) grupoId: string): Promise<void> {
    return this.checklistService.removerGrupo(grupoId);
  }

  @Put('templates/:templateId/grupos/reordenar')
  @ApiOperation({ summary: 'Reordena os grupos de um template' })
  @ApiResponse({ status: 200, description: 'Grupos reordenados' })
  async reordenarGrupos(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() grupoIds: string[],
  ): Promise<void> {
    return this.checklistService.reordenarGrupos(templateId, grupoIds);
  }

  @Post('importar/moki/preview')
  @ApiOperation({ summary: 'Faz preview de um arquivo CSV do Moki' })
  @ApiResponse({ status: 200, description: 'Preview da importação' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async previewImportacaoMoki(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportacaoPreview> {
    if (!file) {
      throw new BadRequestException('Arquivo não enviado');
    }
    if (!file.originalname.endsWith('.csv')) {
      throw new BadRequestException('O arquivo deve ser um CSV');
    }
    const csvContent = file.buffer.toString('utf-8');
    return this.mokiImportService.preview(csvContent);
  }

  @Post('importar/moki')
  @ApiOperation({ summary: 'Importa um arquivo CSV do Moki' })
  @ApiResponse({ status: 201, description: 'Template importado com sucesso' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importarMoki(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportarMokiDto,
  ): Promise<ImportacaoResultado> {
    if (!file) {
      throw new BadRequestException('Arquivo não enviado');
    }
    if (!file.originalname.endsWith('.csv')) {
      throw new BadRequestException('O arquivo deve ser um CSV');
    }
    const csvContent = file.buffer.toString('utf-8');
    return this.mokiImportService.importar(csvContent, dto);
  }
}

