import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ClienteModule } from '../cliente/cliente.module';
import { IaModule } from '../ia/ia.module';
import { RelatorioTecnico } from './entities/relatorio-tecnico.entity';
import { RelatorioTecnicoFoto } from './entities/relatorio-tecnico-foto.entity';
import { RelatorioTecnicoController } from './relatorio-tecnico.controller';
import { RelatorioTecnicoService } from './relatorio-tecnico.service';
import { ComprimirImagemService } from '../auditoria/services/comprimir-imagem.service';
import { ExtrairExifService } from '../auditoria/services/extrair-exif.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { PdfModule } from '../pdf/pdf.module';
import { RelatorioTecnicoPdfPuppeteerService } from './services/relatorio-tecnico-pdf-puppeteer.service';
import { RelatorioTecnicoHtmlService } from './services/relatorio-tecnico-html.service';

@Module({
  imports: [
    PdfModule,
    TypeOrmModule.forFeature([RelatorioTecnico, RelatorioTecnicoFoto]),
    MulterModule.register({
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
    ClienteModule,
    IaModule,
    SupabaseModule,
  ],
  controllers: [RelatorioTecnicoController],
  providers: [
    RelatorioTecnicoService,
    ComprimirImagemService,
    ExtrairExifService,
    RelatorioTecnicoPdfPuppeteerService,
    RelatorioTecnicoHtmlService,
  ],
  exports: [RelatorioTecnicoService],
})
export class RelatorioTecnicoModule {}
