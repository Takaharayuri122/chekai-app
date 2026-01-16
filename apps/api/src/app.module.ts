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
import { PlanoModule } from './modules/plano/plano.module';
import { CreditoModule } from './modules/credito/credito.module';
import { CoreModule } from './core/core.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { EmailModule } from './modules/email/email.module';

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
    SupabaseModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        if (!databaseUrl) {
          throw new Error('DATABASE_URL é obrigatória. Configure no arquivo .env');
        }
        // Parse da connection string do Supabase
        // Formato: postgresql://user:password@host:port/database
        const url = new URL(databaseUrl);
        return {
          type: 'postgres',
          host: url.hostname,
          port: parseInt(url.port || '5432'),
          username: url.username,
          password: url.password,
          database: url.pathname.substring(1), // Remove a barra inicial
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: configService.get<string>('NODE_ENV') !== 'production',
          logging: configService.get<string>('NODE_ENV') === 'development',
          ssl: {
            rejectUnauthorized: false,
          },
        };
      },
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
    PlanoModule,
    CreditoModule,
  ],
})
export class AppModule {}

