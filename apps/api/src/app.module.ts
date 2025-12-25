import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UsuarioModule } from './modules/usuario/usuario.module';
import { ClienteModule } from './modules/cliente/cliente.module';
import { ChecklistModule } from './modules/checklist/checklist.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { LegislacaoModule } from './modules/legislacao/legislacao.module';
import { IaModule } from './modules/ia/ia.module';
import { CoreModule } from './core/core.module';

/**
 * Módulo principal da aplicação.
 * Configura todos os módulos e conexão com banco de dados.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_DATABASE', 'meta_app'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    CoreModule,
    AuthModule,
    UsuarioModule,
    ClienteModule,
    ChecklistModule,
    AuditoriaModule,
    LegislacaoModule,
    IaModule,
  ],
})
export class AppModule {}

