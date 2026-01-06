import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plano } from './entities/plano.entity';
import { Assinatura } from './entities/assinatura.entity';
import { PlanoService } from './plano.service';
import { AssinaturaService } from './assinatura.service';
import { ValidacaoLimitesService } from './validacao-limites.service';
import { PlanoController } from './plano.controller';
import { GestorLimitesController } from './gestor-limites.controller';
import { UsuarioModule } from '../usuario/usuario.module';
import { CreditoModule } from '../credito/credito.module';
import { Usuario } from '../usuario/entities/usuario.entity';
import { Auditoria } from '../auditoria/entities/auditoria.entity';
import { Cliente } from '../cliente/entities/cliente.entity';

/**
 * Módulo responsável pela gestão de planos e assinaturas.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Plano, Assinatura, Usuario, Auditoria, Cliente]),
    forwardRef(() => UsuarioModule),
    forwardRef(() => CreditoModule),
  ],
  controllers: [PlanoController, GestorLimitesController],
  providers: [
    PlanoService,
    AssinaturaService,
    ValidacaoLimitesService,
    {
      provide: 'ValidacaoLimitesService',
      useExisting: ValidacaoLimitesService,
    },
  ],
  exports: [PlanoService, AssinaturaService, ValidacaoLimitesService, 'ValidacaoLimitesService'],
})
export class PlanoModule {}

