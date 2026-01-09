import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsoCredito } from './entities/uso-credito.entity';
import { ConfiguracaoCredito } from './entities/configuracao-credito.entity';
import { CreditoService } from './credito.service';
import { ConfiguracaoCreditoService } from './configuracao-credito.service';
import { ConfiguracaoCreditoController } from './configuracao-credito.controller';
import { AuditoriaTokensService } from './auditoria-tokens.service';
import { AuditoriaTokensController } from './auditoria-tokens.controller';
import { PlanoModule } from '../plano/plano.module';
import { Usuario } from '../usuario/entities/usuario.entity';

/**
 * Módulo responsável pela gestão de créditos de IA.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UsoCredito, ConfiguracaoCredito, Usuario]),
    forwardRef(() => PlanoModule),
  ],
  controllers: [ConfiguracaoCreditoController, AuditoriaTokensController],
  providers: [CreditoService, ConfiguracaoCreditoService, AuditoriaTokensService],
  exports: [CreditoService, ConfiguracaoCreditoService],
})
export class CreditoModule {}

