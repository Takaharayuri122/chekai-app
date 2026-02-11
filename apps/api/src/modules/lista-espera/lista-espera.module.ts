import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListaEspera } from './entities/lista-espera.entity';
import { ListaEsperaService } from './lista-espera.service';
import { ListaEsperaController } from './lista-espera.controller';
import { EmailModule } from '../email/email.module';

/**
 * Módulo da lista de espera (inscrições beta e listagem para administradores).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ListaEspera]),
    EmailModule,
  ],
  controllers: [ListaEsperaController],
  providers: [ListaEsperaService],
  exports: [ListaEsperaService],
})
export class ListaEsperaModule {}
