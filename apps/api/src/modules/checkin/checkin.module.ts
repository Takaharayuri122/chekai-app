import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from '../cliente/entities/cliente.entity';
import { Unidade } from '../cliente/entities/unidade.entity';
import { Usuario } from '../usuario/entities/usuario.entity';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';
import { Checkin } from './entities/checkin.entity';
import { CheckinAutoCheckoutJob } from './checkin-auto-checkout.job';
import { CheckinRelatorioPdfService } from './checkin-relatorio-pdf.service';

@Module({
  imports: [TypeOrmModule.forFeature([Checkin, Unidade, Cliente, Usuario])],
  controllers: [CheckinController],
  providers: [CheckinService, CheckinAutoCheckoutJob, CheckinRelatorioPdfService],
  exports: [CheckinService],
})
export class CheckinModule {}
