import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Auditoria } from './entities/auditoria.entity';
import { AuditoriaItem } from './entities/auditoria-item.entity';
import { Foto } from './entities/foto.entity';
import { AuditoriaEnvioRelatorio } from './entities/auditoria-envio-relatorio.entity';
import { Unidade } from '../cliente/entities/unidade.entity';
import { AuditoriaService } from './auditoria.service';
import { AuditoriaController } from './auditoria.controller';
import { RelatorioPdfPuppeteerService } from './services/relatorio-pdf-puppeteer.service';
import { ResultadoAuditoriaService } from './services/resultado-auditoria.service';
import { PlanoAcaoTarefa } from '../plano-acao/entities/plano-acao-tarefa.entity';
import { RelatorioHtmlService } from './services/relatorio-html.service';
import { ComprimirImagemService } from './services/comprimir-imagem.service';
import { ExtrairExifService } from './services/extrair-exif.service';
import { ChecklistModule } from '../checklist/checklist.module';
import { PlanoModule } from '../plano/plano.module';
import { IaModule } from '../ia/ia.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { LegislacaoModule } from '../legislacao/legislacao.module';
import { PdfModule } from '../pdf/pdf.module';

/**
 * Módulo responsável pela gestão de auditorias.
 */
@Module({
  imports: [
    PdfModule,
    TypeOrmModule.forFeature([Auditoria, AuditoriaItem, Foto, Unidade, AuditoriaEnvioRelatorio, PlanoAcaoTarefa]),
    MulterModule.register({
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    }),
    ChecklistModule,
    forwardRef(() => PlanoModule),
    IaModule,
    SupabaseModule,
    LegislacaoModule,
  ],
  controllers: [AuditoriaController],
  providers: [
    AuditoriaService,
    RelatorioPdfPuppeteerService,
    RelatorioHtmlService,
    ResultadoAuditoriaService,
    ComprimirImagemService,
    ExtrairExifService,
  ],
  exports: [AuditoriaService, ResultadoAuditoriaService],
})
export class AuditoriaModule {}

