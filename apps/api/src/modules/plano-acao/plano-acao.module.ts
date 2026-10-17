import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaItem } from '../auditoria/entities/auditoria-item.entity';
import { Usuario } from '../usuario/entities/usuario.entity';
import { PlanoAcaoTarefa } from './entities/plano-acao-tarefa.entity';
import { PlanoAcaoController } from './plano-acao.controller';
import { PlanoAcaoService } from './plano-acao.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlanoAcaoTarefa, Usuario, AuditoriaItem])],
  controllers: [PlanoAcaoController],
  providers: [PlanoAcaoService],
  exports: [PlanoAcaoService],
})
export class PlanoAcaoModule {}
