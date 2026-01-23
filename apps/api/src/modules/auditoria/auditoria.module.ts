import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Auditoria } from './entities/auditoria.entity';
import { AuditoriaItem } from './entities/auditoria-item.entity';
import { Foto } from './entities/foto.entity';
import { AuditoriaService } from './auditoria.service';
import { AuditoriaController } from './auditoria.controller';
import { RelatorioPdfPuppeteerService } from './services/relatorio-pdf-puppeteer.service';
import { RelatorioHtmlService } from './services/relatorio-html.service';
import { ChecklistModule } from '../checklist/checklist.module';
import { PlanoModule } from '../plano/plano.module';
import { IaModule } from '../ia/ia.module';
import { SupabaseModule } from '../supabase/supabase.module';

/**
 * Módulo responsável pela gestão de auditorias.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Auditoria, AuditoriaItem, Foto]),
    MulterModule.register({
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    }),
    ChecklistModule,
    forwardRef(() => PlanoModule),
    IaModule,
    SupabaseModule,
  ],
  controllers: [AuditoriaController],
  providers: [AuditoriaService, RelatorioPdfPuppeteerService, RelatorioHtmlService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}

