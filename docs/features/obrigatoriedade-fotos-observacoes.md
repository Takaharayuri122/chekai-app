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

### Botões separados de Fotos e Observação

Na tela da pergunta, abaixo das respostas, há dois botões lado a lado (RN-AUD-015):

- **Fotos**: mostra quantas fotos já foram registradas e o aviso "Obrigatória" quando a resposta exige foto. Abre uma janela só com as fotos e a análise da IA.
- **Observação**: mostra um sinal quando já há texto e o aviso "Obrigatória" quando a resposta exige observação. Abre uma janela só com a observação.
- Se a pergunta não aceita foto ou observação, o botão correspondente não aparece (ou aparece só para consulta, se já houver registro).

### Validação Automática

- Cada janela só cobra o que é dela: a de fotos não pede observação, e a de observação não pede foto
- Exceção: foto marcada como não relevante leva para a observação, que passa a ser exigida
- Mensagem de erro clara indica o que está faltando

### Relatório

- No relatório (visualização), fotos e observações continuam em layout linear
- Os botões separados são usados apenas durante a edição/auditoria

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
