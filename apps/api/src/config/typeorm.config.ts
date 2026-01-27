import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Carrega as variáveis de ambiente
config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL é obrigatória. Configure no arquivo .env');
}

// Parse da connection string do Supabase
// Formato: postgresql://user:password@host:port/database
const url = new URL(databaseUrl);

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: url.hostname,
  port: parseInt(url.port || '5432'),
  username: url.username,
  password: url.password,
  database: url.pathname.substring(1), // Remove a barra inicial
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false, // Desabilitar em produção
  logging: process.env.NODE_ENV === 'development',
  ssl: {
    rejectUnauthorized: false,
  },
});
