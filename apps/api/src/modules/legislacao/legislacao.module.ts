import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Legislacao } from './entities/legislacao.entity';
import { LegislacaoChunk } from './entities/legislacao-chunk.entity';
import { LegislacaoService } from './legislacao.service';
import { LegislacaoController } from './legislacao.controller';

/**
 * Módulo responsável pela gestão de legislações e RAG.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Legislacao, LegislacaoChunk])],
  controllers: [LegislacaoController],
  providers: [LegislacaoService],
  exports: [LegislacaoService],
})
export class LegislacaoModule {}

