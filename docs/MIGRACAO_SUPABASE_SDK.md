# Migração para SDK do Supabase

Este documento descreve a migração para usar o SDK oficial do Supabase ao invés de conexões diretas via TypeORM para algumas operações.

## O que mudou

### Integração do SDK

- ✅ Instalado `@supabase/supabase-js`
- ✅ Criado `SupabaseModule` e `SupabaseService` 
- ✅ Busca vetorial agora usa o SDK do Supabase via RPC

### Arquivos Criados

1. `apps/api/src/modules/supabase/supabase.module.ts` - Módulo global do Supabase
2. `apps/api/src/modules/supabase/supabase.service.ts` - Serviço que fornece o cliente Supabase
3. `scripts/supabase-busca-vetorial-function.sql` - Função stored procedure para busca vetorial

## Configuração

### 1. Obter Credenciais do Supabase

No painel do Supabase, vá em **Settings > API**:

1. **SUPABASE_URL**: Está na seção "Project URL"
   - Formato: `https://[seu-projeto].supabase.co`

2. **SUPABASE_SERVICE_ROLE_KEY**: Está na seção "Project API keys" > "service_role" (secret)
   - ⚠️ **IMPORTANTE**: Esta chave tem privilégios administrativos. Nunca exponha no frontend!
   - Use apenas no backend

### 2. Configurar Variáveis de Ambiente

Adicione ao arquivo `apps/api/.env`:

```env
# Supabase SDK
SUPABASE_URL=https://[SEU_PROJECT].supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui

# Banco de Dados (ainda necessário para TypeORM)
DATABASE_URL=postgresql://postgres:[SEU_PASSWORD]@[SEU_PROJECT].supabase.co:5432/postgres
```

### 3. Criar Função Stored Procedure

Para a busca vetorial funcionar, você precisa criar a função stored procedure no Supabase:

1. Acesse o **SQL Editor** no painel do Supabase
2. Execute o conteúdo do arquivo `scripts/supabase-busca-vetorial-function.sql`

Ou execute diretamente:

```sql
CREATE OR REPLACE FUNCTION buscar_chunks_similares(
  query_embedding vector(1536),
  match_limit int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  conteudo text,
  artigo varchar,
  inciso varchar,
  paragrafo varchar,
  tipo varchar,
  numero varchar,
  ano int,
  titulo varchar,
  similaridade float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.conteudo,
    c.artigo,
    c.inciso,
    c.paragrafo,
    l.tipo::varchar,
    l.numero,
    l.ano,
    l.titulo,
    1 - (c.embedding <=> query_embedding)::float as similaridade
  FROM legislacao_chunks c
  JOIN legislacoes l ON l.id = c.legislacao_id
  WHERE l.ativo = true
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION buscar_chunks_similares(vector, int) TO anon, authenticated, service_role;
```

## Como Usar

### No Código

O `SupabaseService` é injetado automaticamente em qualquer serviço:

```typescript
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class MeuService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async minhaOperacao() {
    const supabase = this.supabaseService.getClient();
    
    // Usar métodos do SDK
    const { data, error } = await supabase
      .from('minha_tabela')
      .select('*')
      .eq('campo', 'valor');
    
    // Ou chamar RPC
    const { data: result } = await supabase.rpc('minha_funcao', {
      parametro: 'valor'
    });
  }
}
```

### Busca Vetorial

A busca vetorial já está implementada no `LegislacaoService`:

```typescript
const chunks = await this.legislacaoService.buscarChunksSimilares(
  'texto de busca',
  5 // limite
);
```

## Vantagens do SDK

- ✅ **API Type-Safe**: Melhor suporte TypeScript
- ✅ **PostgREST Integration**: Usa a API REST do Supabase (mais eficiente)
- ✅ **Row Level Security**: Respeita políticas RLS (quando não usar service_role)
- ✅ **Real-time**: Suporte nativo para subscriptions real-time
- ✅ **Storage**: Integração fácil com Supabase Storage
- ✅ **Auth**: Integração com Supabase Auth (se necessário no futuro)

## Próximos Passos (Opcional)

1. Migrar mais operações para usar o SDK ao invés de TypeORM
2. Implementar Row Level Security (RLS) no Supabase
3. Usar Supabase Storage para uploads de imagens
4. Integrar Supabase Auth para autenticação
5. Implementar real-time para atualizações em tempo real

## Notas

- O TypeORM ainda é usado para algumas operações (CRUD básico)
- A busca vetorial agora usa exclusivamente o SDK do Supabase
- O `DATABASE_URL` ainda é necessário para TypeORM funcionar
- A `SUPABASE_SERVICE_ROLE_KEY` bypassa RLS - use com cuidado!

