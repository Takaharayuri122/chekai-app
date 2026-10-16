import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuario/entities/usuario.entity';
import { PlanoAcaoTarefa } from './entities/plano-acao-tarefa.entity';
import { PlanoAcaoController } from './plano-acao.controller';
import { PlanoAcaoService } from './plano-acao.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlanoAcaoTarefa, Usuario])],
  controllers: [PlanoAcaoController],
  providers: [PlanoAcaoService],
})
export class PlanoAcaoModule {}
