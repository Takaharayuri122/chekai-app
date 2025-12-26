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
  // Parse da connection string do Supabase
  const url = new URL(databaseUrl);
  return {
    type: 'postgres' as const,
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    username: url.username,
    password: url.password,
    database: url.pathname.substring(1), // Remove a barra inicial
    synchronize: false,
    ssl: {
      rejectUnauthorized: false,
    },
  };
}

const dataSource = new DataSource(createDataSourceConfig());

async function runSeeds(): Promise<void> {
  await dataSource.initialize();
  console.log('📦 Conectado ao banco de dados');

  // Seed de legislações RDC 216
  const rdc216Chunks = [
    {
      artigo: 'Art. 4.1.1',
      conteudo:
        'A edificação e as instalações devem ser projetadas de forma a possibilitar um fluxo ordenado e sem cruzamentos em todas as etapas da preparação de alimentos e a facilitar as operações de manutenção, limpeza e, quando for o caso, desinfecção.',
    },
    {
      artigo: 'Art. 4.1.3',
      conteudo:
        'O piso, as paredes e o teto devem possuir revestimento liso, impermeável e lavável. Devem ser mantidos íntegros, conservados, livres de rachaduras, trincas, goteiras, vazamentos, infiltrações, bolores, descascamentos, dentre outros e não devem transmitir contaminantes aos alimentos.',
    },
    {
      artigo: 'Art. 4.1.5',
      conteudo:
        'As portas e as janelas devem ser mantidas ajustadas aos batentes. As portas da área de preparação e armazenamento de alimentos devem ser dotadas de fechamento automático.',
    },
    {
      artigo: 'Art. 4.1.7',
      conteudo:
        'As instalações devem ser abastecidas de água corrente e dispor de conexões com rede de esgoto ou fossa séptica.',
    },
    {
      artigo: 'Art. 4.1.10',
      conteudo:
        'As áreas internas e externas do estabelecimento devem estar livres de objetos em desuso ou estranhos ao ambiente, não sendo permitida a presença de animais.',
    },
    {
      artigo: 'Art. 4.2.1',
      conteudo:
        'As instalações, os equipamentos, os móveis e os utensílios devem ser mantidos em condições higiênico-sanitárias apropriadas.',
    },
    {
      artigo: 'Art. 4.3.1',
      conteudo:
        'Os equipamentos, móveis e utensílios que entram em contato com alimentos devem ser de materiais que não transmitam substâncias tóxicas, odores, nem sabores aos mesmos.',
    },
    {
      artigo: 'Art. 4.6.1',
      conteudo:
        'O controle da higiene dos manipuladores deve ser registrado e as ações corretivas adotadas, registradas.',
    },
    {
      artigo: 'Art. 4.6.2',
      conteudo:
        'Os manipuladores que apresentarem lesões e ou sintomas de enfermidades que possam comprometer a qualidade higiênico-sanitária dos alimentos devem ser afastados da atividade de preparação de alimentos enquanto persistirem essas condições de saúde.',
    },
    {
      artigo: 'Art. 4.6.4',
      conteudo:
        'Os manipuladores devem usar cabelos presos e protegidos por redes, toucas ou outro acessório apropriado para esse fim, não sendo permitido o uso de barba.',
    },
    {
      artigo: 'Art. 4.6.5',
      conteudo:
        'As unhas devem estar curtas e sem esmalte ou base. Durante a manipulação, devem ser retirados todos os objetos de adorno pessoal e a maquiagem.',
    },
    {
      artigo: 'Art. 4.8.1',
      conteudo:
        'As matérias-primas, os ingredientes e as embalagens devem ser armazenados em local limpo e organizado, de forma a garantir proteção contra contaminantes.',
    },
    {
      artigo: 'Art. 4.8.5',
      conteudo:
        'Os alimentos devem ser armazenados sobre paletes, estrados e ou prateleiras, respeitando-se o espaçamento mínimo necessário para garantir adequada ventilação e limpeza.',
    },
    {
      artigo: 'Art. 4.8.9',
      conteudo:
        'Os alimentos preparados mantidos na área de armazenamento ou aguardando o transporte devem estar identificados e protegidos contra contaminantes.',
    },
  ];

  // Verifica se já existe a legislação
  const existingLegislacao = await dataSource.query(
    `SELECT id FROM legislacoes WHERE numero = '216' AND ano = 2004 LIMIT 1`
  );

  if (existingLegislacao.length === 0) {
    console.log('📜 Criando RDC 216/2004...');

    const result = await dataSource.query(
      `INSERT INTO legislacoes (id, tipo, numero, ano, titulo, ementa, orgao_emissor, ativo, criado_em, atualizado_em)
       VALUES (gen_random_uuid(), 'rdc', '216', 2004, 'Boas Práticas para Serviços de Alimentação', 
               'Dispõe sobre Regulamento Técnico de Boas Práticas para Serviços de Alimentação.',
               'ANVISA', true, NOW(), NOW())
       RETURNING id`
    );

    const legislacaoId = result[0].id;

    console.log('📝 Inserindo chunks da RDC 216...');
    console.log('⚠️  Os embeddings precisam ser gerados via API (OpenAI)');

    for (let i = 0; i < rdc216Chunks.length; i++) {
      const chunk = rdc216Chunks[i];
      await dataSource.query(
        `INSERT INTO legislacao_chunks (id, legislacao_id, conteudo, artigo, ordem, token_count, criado_em)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
        [
          legislacaoId,
          chunk.conteudo,
          chunk.artigo,
          i,
          Math.ceil(chunk.conteudo.length / 4),
        ]
      );
    }

    console.log(`✅ ${rdc216Chunks.length} chunks inseridos para RDC 216`);
  } else {
    console.log('ℹ️  RDC 216/2004 já existe no banco');
  }

  // Seed de um template de checklist básico
  const existingTemplate = await dataSource.query(
    `SELECT id FROM checklist_templates WHERE nome = 'Checklist RDC 216 - Serviços de Alimentação' LIMIT 1`
  );

  if (existingTemplate.length === 0) {
    console.log('📋 Criando template de checklist RDC 216...');

    const templateResult = await dataSource.query(
      `INSERT INTO checklist_templates (id, nome, descricao, tipo_atividade, versao, ativo, criado_em, atualizado_em)
       VALUES (gen_random_uuid(), 'Checklist RDC 216 - Serviços de Alimentação',
               'Checklist baseado na RDC 216/2004 da ANVISA para serviços de alimentação',
               'restaurante', '1.0', true, NOW(), NOW())
       RETURNING id`
    );

    const templateId = templateResult[0].id;

    const itensTemplate = [
      { pergunta: 'As instalações estão limpas e organizadas?', categoria: 'estrutura', legislacao: 'RDC 216/2004', artigo: 'Art. 4.1.1' },
      { pergunta: 'Piso, paredes e teto estão íntegros e conservados?', categoria: 'estrutura', legislacao: 'RDC 216/2004', artigo: 'Art. 4.1.3' },
      { pergunta: 'Portas e janelas estão ajustadas aos batentes?', categoria: 'estrutura', legislacao: 'RDC 216/2004', artigo: 'Art. 4.1.5' },
      { pergunta: 'Há abastecimento de água corrente?', categoria: 'estrutura', legislacao: 'RDC 216/2004', artigo: 'Art. 4.1.7' },
      { pergunta: 'Área livre de objetos em desuso e animais?', categoria: 'higiene', legislacao: 'RDC 216/2004', artigo: 'Art. 4.1.10' },
      { pergunta: 'Equipamentos e utensílios em condições higiênicas?', categoria: 'equipamentos', legislacao: 'RDC 216/2004', artigo: 'Art. 4.2.1' },
      { pergunta: 'Materiais em contato com alimentos são apropriados?', categoria: 'equipamentos', legislacao: 'RDC 216/2004', artigo: 'Art. 4.3.1' },
      { pergunta: 'Controle de higiene dos manipuladores registrado?', categoria: 'manipuladores', legislacao: 'RDC 216/2004', artigo: 'Art. 4.6.1' },
      { pergunta: 'Manipuladores doentes afastados?', categoria: 'manipuladores', legislacao: 'RDC 216/2004', artigo: 'Art. 4.6.2' },
      { pergunta: 'Manipuladores usando touca e cabelos presos?', categoria: 'manipuladores', legislacao: 'RDC 216/2004', artigo: 'Art. 4.6.4' },
      { pergunta: 'Unhas curtas, sem esmalte, sem adornos?', categoria: 'manipuladores', legislacao: 'RDC 216/2004', artigo: 'Art. 4.6.5' },
      { pergunta: 'Armazenamento em local limpo e organizado?', categoria: 'armazenamento', legislacao: 'RDC 216/2004', artigo: 'Art. 4.8.1' },
      { pergunta: 'Alimentos armazenados sobre estrados/prateleiras?', categoria: 'armazenamento', legislacao: 'RDC 216/2004', artigo: 'Art. 4.8.5' },
      { pergunta: 'Alimentos preparados identificados e protegidos?', categoria: 'armazenamento', legislacao: 'RDC 216/2004', artigo: 'Art. 4.8.9' },
    ];

    for (let i = 0; i < itensTemplate.length; i++) {
      const item = itensTemplate[i];
      await dataSource.query(
        `INSERT INTO template_itens (id, template_id, pergunta, categoria, criticidade, peso, ordem, legislacao_referencia, artigo, obrigatorio, ativo, criado_em, atualizado_em)
         VALUES (gen_random_uuid(), $1, $2, $3, 'media', 1, $4, $5, $6, true, true, NOW(), NOW())`,
        [templateId, item.pergunta, item.categoria, i, item.legislacao, item.artigo]
      );
    }

    console.log(`✅ ${itensTemplate.length} itens inseridos no template`);
  } else {
    console.log('ℹ️  Template RDC 216 já existe');
  }

  await dataSource.destroy();
  console.log('🎉 Seeds finalizados com sucesso!');
}

runSeeds().catch((error) => {
  console.error('❌ Erro ao executar seeds:', error);
  process.exit(1);
});

