import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ClienteModule } from '../cliente/cliente.module';
import { IaModule } from '../ia/ia.module';
import { RelatorioTecnico } from './entities/relatorio-tecnico.entity';
import { RelatorioTecnicoFoto } from './entities/relatorio-tecnico-foto.entity';
import { ModeloRelatorioTecnico } from './entities/modelo-relatorio-tecnico.entity';
import { RelatorioTecnicoController } from './relatorio-tecnico.controller';
import { RelatorioTecnicoService } from './relatorio-tecnico.service';
import { ComprimirImagemService } from '../auditoria/services/comprimir-imagem.service';
import { ExtrairExifService } from '../auditoria/services/extrair-exif.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { PdfModule } from '../pdf/pdf.module';
import { RelatorioTecnicoPdfPuppeteerService } from './services/relatorio-tecnico-pdf-puppeteer.service';
import { RelatorioTecnicoHtmlService } from './services/relatorio-tecnico-html.service';
import { ModeloRelatorioTecnicoService } from './modelo-relatorio-tecnico.service';
import { PlanoModule } from '../plano/plano.module';
import { Usuario } from '../usuario/entities/usuario.entity';

@Module({
  imports: [
    PdfModule,
    TypeOrmModule.forFeature([RelatorioTecnico, RelatorioTecnicoFoto, ModeloRelatorioTecnico, Usuario]),
    MulterModule.register({
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
    ClienteModule,
    IaModule,
    SupabaseModule,
    PlanoModule,
  ],
  controllers: [RelatorioTecnicoController],
  providers: [
    RelatorioTecnicoService,
    ComprimirImagemService,
    ExtrairExifService,
    RelatorioTecnicoPdfPuppeteerService,
    RelatorioTecnicoHtmlService,
    ModeloRelatorioTecnicoService,
  ],
  exports: [RelatorioTecnicoService],
})
export class RelatorioTecnicoModule {}
