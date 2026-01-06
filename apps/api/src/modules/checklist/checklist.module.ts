import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ChecklistTemplate } from './entities/checklist-template.entity';
import { TemplateItem } from './entities/template-item.entity';
import { ChecklistGrupo } from './entities/checklist-grupo.entity';
import { Auditoria } from '../auditoria/entities/auditoria.entity';
import { ChecklistService } from './checklist.service';
import { MokiImportService } from './moki-import.service';
import { ChecklistController } from './checklist.controller';

/**
 * Módulo responsável pela gestão de checklists e templates.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ChecklistTemplate, TemplateItem, ChecklistGrupo, Auditoria]),
    MulterModule.register({
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    }),
  ],
  controllers: [ChecklistController],
  providers: [ChecklistService, MokiImportService],
  exports: [ChecklistService, MokiImportService],
})
export class ChecklistModule {}

