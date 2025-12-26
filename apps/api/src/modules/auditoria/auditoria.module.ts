import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Auditoria } from './entities/auditoria.entity';
import { AuditoriaItem } from './entities/auditoria-item.entity';
import { Foto } from './entities/foto.entity';
import { AuditoriaService } from './auditoria.service';
import { AuditoriaController } from './auditoria.controller';
import { ChecklistModule } from '../checklist/checklist.module';

/**
 * Módulo responsável pela gestão de auditorias.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Auditoria, AuditoriaItem, Foto]),
    MulterModule.register({
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    }),
    ChecklistModule,
  ],
  controllers: [AuditoriaController],
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}

