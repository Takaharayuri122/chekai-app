# Obrigatoriedade de Fotos e Observações

## Visão Geral

Sistema de configuração granular que permite definir obrigatoriedade de fotos e observações por opção de resposta em perguntas de checklist.

## Uso

### Configurando Perguntas

1. Editar template de checklist
2. Adicionar/editar pergunta
3. Para cada opção de resposta:
   - Marcar "Foto obrigatória" se foto for necessária
   - Marcar "Observação obrigatória" se observação for necessária

### Durante Auditoria

- Sistema valida automaticamente baseado na resposta selecionada
- Feedback visual indica campos obrigatórios
- Botão "Salvar" desabilitado até requisitos atendidos

## Interface de Auditoria

### Tabs de Fotos e Observações

Durante a auditoria, fotos e observações são organizadas em abas (tabs) separadas:

- **Tab Fotos**: Aparece apenas se alguma opção de resposta exigir foto
  - Badge "Obrigatório" quando foto é necessária e não foi adicionada
  - Contador mostra quantas fotos foram adicionadas
  - Atalho: Alt+1

- **Tab Observação**: Sempre visível
  - Badge "Obrigatório" quando observação é necessária e está vazia
  - Atalho: Alt+2

### Validação Automática

- Sistema valida automaticamente ao tentar salvar
- Se campo obrigatório estiver vazio, muda automaticamente para a tab correspondente
- Mensagem de erro clara indica o que está faltando

### Relatório

- No relatório (visualização), fotos e observações continuam em layout linear
- Tabs são usadas apenas durante a edição/auditoria

## Arquitetura

### Backend

- Campo JSONB `opcoes_resposta_config` em `template_itens`
- Normalização automática no service layer
- Migration popula configs padrão

### Frontend

- UI com checkboxes por opção de resposta
- Validação em tempo real durante auditoria
- Feedback visual (borders, badges, botão desabilitado)

## Compatibilidade

Perguntas criadas antes desta feature:
- Continuam funcionando (observação obrigatória, foto opcional)
- Ao editar, configs são inicializadas automaticamente

## Implementação

### Arquivos Modificados

**Backend:**
- `apps/api/src/database/migrations/[timestamp]-add-opcoes-resposta-config.ts`
- `apps/api/src/modules/checklist/entities/template-item.entity.ts`
- `apps/api/src/modules/checklist/dto/criar-checklist-template.dto.ts`
- `apps/api/src/modules/checklist/checklist.service.ts`

**Frontend:**
- `apps/web/src/lib/api.ts`
- `apps/web/src/app/templates/[id]/page.tsx`
- `apps/web/src/app/auditoria/[id]/page.tsx`

### Estrutura de Dados

```typescript
interface OpcaoRespostaConfig {
  valor: string;                  // Ex: "conforme", "nao_conforme"
  fotoObrigatoria: boolean;       // Se foto é obrigatória
  observacaoObrigatoria: boolean; // Se observação é obrigatória
}
```

### Fluxo de Dados

1. **Criar/Editar Template:** Usuário configura obrigatoriedades via checkboxes
2. **Salvar:** Service normaliza configs automaticamente
3. **Durante Auditoria:** Sistema busca config da resposta selecionada
4. **Validação:** Bloqueia salvamento se requisitos não atendidos

## Testes Manuais

### Cenário 1: Criar Nova Pergunta
1. Abrir template de checklist
2. Adicionar nova pergunta com respostas padrão
3. Marcar "Foto obrigatória" para "Não Conforme"
4. Salvar pergunta
5. Iniciar auditoria
6. Selecionar "Não Conforme"
7. Verificar que foto é obrigatória (badge vermelho)
8. Tentar salvar sem foto - deve bloquear
9. Adicionar foto - deve permitir salvar

### Cenário 2: Respostas Personalizadas
1. Criar pergunta com respostas personalizadas
2. Adicionar opções: "Conforme", "Parcialmente Conforme", "Não Conforme"
3. Marcar obrigatoriedades diferentes para cada opção
4. Durante auditoria, verificar que validação muda conforme resposta selecionada

### Cenário 3: Perguntas Antigas (Legacy)
1. Abrir pergunta criada antes da feature
2. Editar a pergunta
3. Verificar que configs são inicializadas automaticamente
4. Verificar comportamento durante auditoria

### Cenário 4: Adicionar/Remover Opções
1. Editar pergunta com respostas personalizadas
2. Adicionar nova opção
3. Verificar que checkboxes aparecem
4. Remover opção
5. Verificar que configs são removidas

## Rollback

Se houver problemas, reverter migration:

```bash
cd apps/api
npm run typeorm:revert
```

## Observações Técnicas

- Migration é idempotente (usa IF NOT EXISTS)
- Normalização automática previne dessincronia
- Suporte a legacy garante compatibilidade
- TypeScript garante type safety em todo fluxo
