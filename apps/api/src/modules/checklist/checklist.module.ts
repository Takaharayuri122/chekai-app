import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ChecklistTemplate } from './entities/checklist-template.entity';
import { TemplateItem } from './entities/template-item.entity';
import { ChecklistGrupo } from './entities/checklist-grupo.entity';
import { Auditoria } from '../auditoria/entities/auditoria.entity';
import { ChecklistService } from './checklist.service';
import { ChecklistImportService } from './checklist-import.service';
import { ChecklistIaService } from './checklist-ia.service';
import { ChecklistController } from './checklist.controller';
import { LegislacaoModule } from '../legislacao/legislacao.module';
import { CreditoModule } from '../credito/credito.module';

/**
 * Módulo responsável pela gestão de checklists e templates.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ChecklistTemplate, TemplateItem, ChecklistGrupo, Auditoria]),
    MulterModule.register({
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
    LegislacaoModule,
    CreditoModule,
  ],
  controllers: [ChecklistController],
  providers: [ChecklistService, ChecklistImportService, ChecklistIaService],
  exports: [ChecklistService, ChecklistImportService],
})
export class ChecklistModule {}

