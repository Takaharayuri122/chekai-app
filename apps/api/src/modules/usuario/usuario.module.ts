import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './entities/usuario.entity';
import { UsuarioService } from './usuario.service';
import { UsuarioController } from './usuario.controller';
import { PlanoModule } from '../plano/plano.module';
import { Auditoria } from '../auditoria/entities/auditoria.entity';
import { Cliente } from '../cliente/entities/cliente.entity';

/**
 * Módulo responsável pela gestão de usuários.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Auditoria, Cliente]),
    forwardRef(() => PlanoModule),
  ],
  controllers: [UsuarioController],
  providers: [UsuarioService],
  exports: [UsuarioService],
})
export class UsuarioModule {}

