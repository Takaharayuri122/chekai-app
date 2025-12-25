import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChecklistTemplate } from './entities/checklist-template.entity';
import { TemplateItem } from './entities/template-item.entity';
import { ChecklistService } from './checklist.service';
import { ChecklistController } from './checklist.controller';

/**
 * Módulo responsável pela gestão de checklists e templates.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ChecklistTemplate, TemplateItem])],
  controllers: [ChecklistController],
  providers: [ChecklistService],
  exports: [ChecklistService],
})
export class ChecklistModule {}

