import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsoCredito } from './entities/uso-credito.entity';
import { ConfiguracaoCredito } from './entities/configuracao-credito.entity';
import { CreditoService } from './credito.service';
import { ConfiguracaoCreditoService } from './configuracao-credito.service';
import { PlanoModule } from '../plano/plano.module';

/**
 * Módulo responsável pela gestão de créditos de IA.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UsoCredito, ConfiguracaoCredito]),
    forwardRef(() => PlanoModule),
  ],
  providers: [CreditoService, ConfiguracaoCreditoService],
  exports: [CreditoService, ConfiguracaoCreditoService],
})
export class CreditoModule {}

