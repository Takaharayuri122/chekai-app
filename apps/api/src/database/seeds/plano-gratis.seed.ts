import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

/**
 * Cria configuração do DataSource usando connection string do Supabase.
 */
function createDataSourceConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL é obrigatória. Configure no arquivo .env');
  }
  const url = new URL(databaseUrl);
  return {
    type: 'postgres' as const,
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    username: url.username,
    password: url.password,
    database: url.pathname.substring(1),
    synchronize: false,
    ssl: {
      rejectUnauthorized: false,
    },
  };
}

const dataSource = new DataSource(createDataSourceConfig());

async function runPlanoGratisSeed(): Promise<void> {
  await dataSource.initialize();
  console.log('📦 Conectado ao banco de dados');

  // Verifica se já existe o plano grátis
  const existingPlano = await dataSource.query(
    `SELECT id FROM planos WHERE nome = 'Plano Grátis' LIMIT 1`
  );

  let planoId: string;

  if (existingPlano.length === 0) {
    console.log('📋 Criando Plano Grátis...');

    const result = await dataSource.query(
      `INSERT INTO planos (id, nome, descricao, limite_usuarios, limite_auditorias, limite_clientes, limite_creditos, ativo, criado_em, atualizado_em)
       VALUES (gen_random_uuid(), 'Plano Grátis', 
               'Plano gratuito com limites básicos para começar a usar o sistema',
               5, 10, 3, 1000, true, NOW(), NOW())
       RETURNING id`
    );

    planoId = result[0].id;
    console.log('✅ Plano Grátis criado');
  } else {
    planoId = existingPlano[0].id;
    console.log('ℹ️  Plano Grátis já existe');
  }

  // Configurações padrão de créditos
  const configuracoes = [
    {
      provedor: 'openai',
      modelo: 'gpt-4o-mini',
      tokensPorCredito: 1000,
    },
    {
      provedor: 'deepseek',
      modelo: 'deepseek-chat',
      tokensPorCredito: 10000,
    },
  ];

  console.log('💰 Criando configurações de créditos...');

  for (const config of configuracoes) {
    const existing = await dataSource.query(
      `SELECT id FROM configuracoes_credito WHERE provedor = $1 AND modelo = $2 LIMIT 1`,
      [config.provedor, config.modelo]
    );

    if (existing.length === 0) {
      await dataSource.query(
        `INSERT INTO configuracoes_credito (id, provedor, modelo, tokens_por_credito, ativo, criado_em, atualizado_em)
         VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())`,
        [config.provedor, config.modelo, config.tokensPorCredito]
      );
      console.log(`✅ Configuração criada: ${config.provedor}/${config.modelo} (${config.tokensPorCredito} tokens/crédito)`);
    } else {
      console.log(`ℹ️  Configuração já existe: ${config.provedor}/${config.modelo}`);
    }
  }

  await dataSource.destroy();
  console.log('🎉 Seed de plano grátis finalizado!');
}

runPlanoGratisSeed().catch((error) => {
  console.error('❌ Erro ao executar seed:', error);
  process.exit(1);
});

