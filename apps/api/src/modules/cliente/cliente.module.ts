import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from './entities/cliente.entity';
import { Unidade } from './entities/unidade.entity';
import { ClienteService } from './cliente.service';
import { ClienteController, UnidadeController } from './cliente.controller';
import { PlanoModule } from '../plano/plano.module';

/**
 * Módulo responsável pela gestão de clientes e unidades.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Cliente, Unidade]),
    forwardRef(() => PlanoModule),
  ],
  controllers: [ClienteController, UnidadeController],
  providers: [ClienteService],
  exports: [ClienteService],
})
export class ClienteModule {}

