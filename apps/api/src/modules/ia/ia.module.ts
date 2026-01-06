import { Module } from '@nestjs/common';
import { IaService } from './ia.service';
import { IaController } from './ia.controller';
import { LegislacaoModule } from '../legislacao/legislacao.module';
import { CreditoModule } from '../credito/credito.module';

/**
 * Módulo responsável pela integração com IA (DeepSeek).
 */
@Module({
  imports: [LegislacaoModule, CreditoModule],
  controllers: [IaController],
  providers: [IaService],
  exports: [IaService],
})
export class IaModule {}

