import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Legislacao } from './entities/legislacao.entity';
import { LegislacaoChunk } from './entities/legislacao-chunk.entity';
import { LegislacaoService } from './legislacao.service';
import { LegislacaoController } from './legislacao.controller';
import { LegislacaoLeituraService } from './legislacao-leitura.service';
import { LegislacaoVinculoService } from './legislacao-vinculo.service';
import { CreditoModule } from '../credito/credito.module';
import { TemplateItem } from '../checklist/entities/template-item.entity';
import { AuditoriaItem } from '../auditoria/entities/auditoria-item.entity';

/**
 * Módulo responsável pela gestão de legislações e RAG.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Legislacao, LegislacaoChunk, TemplateItem, AuditoriaItem]),
    CreditoModule,
  ],
  controllers: [LegislacaoController],
  providers: [LegislacaoService, LegislacaoLeituraService, LegislacaoVinculoService],
  exports: [LegislacaoService, LegislacaoVinculoService],
})
export class LegislacaoModule {}
