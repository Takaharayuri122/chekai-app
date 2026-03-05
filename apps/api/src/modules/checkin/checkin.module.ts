import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from '../cliente/entities/cliente.entity';
import { Unidade } from '../cliente/entities/unidade.entity';
import { Usuario } from '../usuario/entities/usuario.entity';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';
import { Checkin } from './entities/checkin.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Checkin, Unidade, Cliente, Usuario])],
  controllers: [CheckinController],
  providers: [CheckinService],
  exports: [CheckinService],
})
export class CheckinModule {}
