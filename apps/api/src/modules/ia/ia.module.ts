import { Module } from '@nestjs/common';
import { IaService } from './ia.service';
import { IaController } from './ia.controller';
import { LegislacaoModule } from '../legislacao/legislacao.module';

/**
 * Módulo responsável pela integração com IA (DeepSeek).
 */
@Module({
  imports: [LegislacaoModule],
  controllers: [IaController],
  providers: [IaService],
  exports: [IaService],
})
export class IaModule {}

