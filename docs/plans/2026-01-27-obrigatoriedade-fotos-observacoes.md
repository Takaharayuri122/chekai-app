# Obrigatoriedade de Fotos e Observações em Checklist - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar configuração granular de obrigatoriedade de fotos e observações por opção de resposta em perguntas de checklist, permitindo que cada resposta (ex: "Conforme", "Não Conforme") tenha suas próprias regras de validação.

**Architecture:** Adicionar campo JSONB `opcoesRespostaConfig` na entidade TemplateItem que mapeia cada opção de resposta com flags de obrigatoriedade (fotoObrigatoria, observacaoObrigatoria). Migração popula configs padrão para perguntas existentes. Service layer normaliza configs automaticamente ao salvar. Frontend valida durante auditoria baseado na resposta selecionada.

**Tech Stack:** NestJS, TypeORM, PostgreSQL (JSONB), React, TypeScript, TailwindCSS/DaisyUI

---

## Task 1: Backend - Migration e Entity

**Files:**
- Create: `apps/api/src/database/migrations/[timestamp]-add-opcoes-resposta-config.ts`
- Modify: `apps/api/src/modules/checklist/entities/template-item.entity.ts`

**Step 1: Criar migration para adicionar coluna opcoes_resposta_config**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOpcoesRespostaConfig[TIMESTAMP] implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Adicionar coluna
    await queryRunner.query(`
      ALTER TABLE template_itens
      ADD COLUMN opcoes_resposta_config JSONB DEFAULT '[]'::jsonb NOT NULL
    `);

    // Popular configs para perguntas existentes com respostas personalizadas
    await queryRunner.query(`
      UPDATE template_itens
      SET opcoes_resposta_config = (
        SELECT jsonb_agg(
          jsonb_build_object(
            'valor', opcao,
            'fotoObrigatoria', false,
            'observacaoObrigatoria', false
          )
        )
        FROM unnest(opcoes_resposta) opcao
      )
      WHERE (usar_respostas_personalizadas = true OR tipo_resposta_customizada = 'select')
        AND opcoes_resposta IS NOT NULL
        AND array_length(opcoes_resposta, 1) > 0
    `);

    // Popular configs para perguntas com respostas padrão
    await queryRunner.query(`
      UPDATE template_itens
      SET opcoes_resposta_config = '[
        {"valor":"conforme","fotoObrigatoria":false,"observacaoObrigatoria":false},
        {"valor":"nao_conforme","fotoObrigatoria":false,"observacaoObrigatoria":false},
        {"valor":"nao_aplicavel","fotoObrigatoria":false,"observacaoObrigatoria":false},
        {"valor":"nao_avaliado","fotoObrigatoria":false,"observacaoObrigatoria":false}
      ]'::jsonb
      WHERE (usar_respostas_personalizadas = false OR usar_respostas_personalizadas IS NULL)
        AND (tipo_resposta_customizada IS NULL OR tipo_resposta_customizada != 'select')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE template_itens
      DROP COLUMN opcoes_resposta_config
    `);
  }
}
```

**Step 2: Adicionar campo na entity TemplateItem**

Em `apps/api/src/modules/checklist/entities/template-item.entity.ts`, adicionar após linha 92:

```typescript
@Column({ type: 'jsonb', default: [] })
opcoesRespostaConfig: Array<{
  valor: string;
  fotoObrigatoria: boolean;
  observacaoObrigatoria: boolean;
}>;
```

**Step 3: Gerar migration**

```bash
cd apps/api
npm run typeorm:generate -- AddOpcoesRespostaConfig
```

Expected: Migration file created in src/database/migrations/

**Step 4: Executar migration**

```bash
npm run typeorm:run
```

Expected: Migration executed successfully, column added and populated

**Step 5: Commit**

```bash
git add apps/api/src/database/migrations/ apps/api/src/modules/checklist/entities/template-item.entity.ts
git commit -m "feat: add opcoes_resposta_config to template_itens

- Add JSONB column for per-option photo/observation requirements
- Populate default configs for existing questions
- Update TemplateItem entity

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Backend - DTO Updates

**Files:**
- Modify: `apps/api/src/modules/checklist/dto/criar-checklist-template.dto.ts`

**Step 1: Adicionar tipos e validação para OpcaoRespostaConfig**

Em `apps/api/src/modules/checklist/dto/criar-checklist-template.dto.ts`, adicionar no início do arquivo:

```typescript
import { Type } from 'class-transformer';
import { ValidateNested, IsString, IsBoolean } from 'class-validator';

export class OpcaoRespostaConfigDto {
  @IsString()
  valor: string;

  @IsBoolean()
  fotoObrigatoria: boolean;

  @IsBoolean()
  observacaoObrigatoria: boolean;
}
```

**Step 2: Adicionar campo opcional em CriarTemplateItemDto**

Na classe `CriarTemplateItemDto`, adicionar:

```typescript
@IsOptional()
@ValidateNested({ each: true })
@Type(() => OpcaoRespostaConfigDto)
opcoesRespostaConfig?: OpcaoRespostaConfigDto[];
```

**Step 3: Verificar importações**

Garantir que os imports estejam corretos no topo do arquivo:

```typescript
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsBoolean,
  IsArray,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
```

**Step 4: Commit**

```bash
git add apps/api/src/modules/checklist/dto/criar-checklist-template.dto.ts
git commit -m "feat: add opcoesRespostaConfig to DTOs with validation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Backend - Service Layer Normalization

**Files:**
- Modify: `apps/api/src/modules/checklist/checklist.service.ts`

**Step 1: Adicionar método de normalização privado**

Em `apps/api/src/modules/checklist/checklist.service.ts`, adicionar após os métodos existentes:

```typescript
/**
 * Normaliza opcoesRespostaConfig para garantir sincronia com opcoesResposta.
 * Garante que cada opção tenha uma configuração correspondente.
 */
private normalizarOpcoesConfig(item: Partial<TemplateItem>): void {
  // Respostas padrão
  const RESPOSTAS_PADRAO = [
    'conforme',
    'nao_conforme',
    'nao_aplicavel',
    'nao_avaliado',
  ];

  const usaRespostasPersonalizadas =
    item.usarRespostasPersonalizadas ||
    item.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT;

  if (usaRespostasPersonalizadas && item.opcoesResposta) {
    // Para respostas personalizadas, sincronizar com opcoesResposta
    const configExistente = item.opcoesRespostaConfig || [];
    item.opcoesRespostaConfig = item.opcoesResposta.map((opcao) => {
      const config = configExistente.find((c) => c.valor === opcao);
      return (
        config || {
          valor: opcao,
          fotoObrigatoria: false,
          observacaoObrigatoria: false,
        }
      );
    });
  } else {
    // Para respostas padrão
    const configExistente = item.opcoesRespostaConfig || [];
    item.opcoesRespostaConfig = RESPOSTAS_PADRAO.map((valor) => {
      const config = configExistente.find((c) => c.valor === valor);
      return (
        config || {
          valor,
          fotoObrigatoria: false,
          observacaoObrigatoria: false,
        }
      );
    });
  }
}
```

**Step 2: Chamar normalização antes de criar item**

No método `adicionarItem`, adicionar antes de salvar:

```typescript
async adicionarItem(
  templateId: string,
  dto: CriarTemplateItemDto,
): Promise<TemplateItem> {
  const template = await this.buscarTemplatePorId(templateId);

  const item = this.templateItemRepository.create({
    ...dto,
    template,
  });

  // Normalizar configs antes de salvar
  this.normalizarOpcoesConfig(item);

  await this.templateItemRepository.save(item);
  return item;
}
```

**Step 3: Chamar normalização antes de atualizar item**

No método `atualizarItem`, adicionar antes de salvar:

```typescript
async atualizarItem(
  itemId: string,
  dto: Partial<CriarTemplateItemDto>,
): Promise<TemplateItem> {
  const item = await this.templateItemRepository.findOne({
    where: { id: itemId },
  });

  if (!item) {
    throw new NotFoundException('Item não encontrado');
  }

  Object.assign(item, dto);

  // Normalizar configs antes de salvar
  this.normalizarOpcoesConfig(item);

  await this.templateItemRepository.save(item);
  return item;
}
```

**Step 4: Adicionar import se necessário**

Verificar se `TipoRespostaCustomizada` está importado:

```typescript
import { TipoRespostaCustomizada } from './entities/template-item.entity';
```

**Step 5: Commit**

```bash
git add apps/api/src/modules/checklist/checklist.service.ts
git commit -m "feat: add normalizarOpcoesConfig to sync configs with options

- Auto-sync opcoesRespostaConfig when saving items
- Ensures each option has a corresponding config
- Prevents desync between options and configs

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Frontend - TypeScript Types

**Files:**
- Modify: `apps/web/src/lib/api.ts`

**Step 1: Adicionar interface OpcaoRespostaConfig**

Em `apps/web/src/lib/api.ts`, adicionar após a linha 522 (após TipoRespostaCustomizada):

```typescript
export interface OpcaoRespostaConfig {
  valor: string;
  fotoObrigatoria: boolean;
  observacaoObrigatoria: boolean;
}
```

**Step 2: Adicionar campo na interface TemplateItem**

Na interface `TemplateItem` (linha 480), adicionar após `opcoesResposta`:

```typescript
opcoesRespostaConfig?: OpcaoRespostaConfig[];
```

**Step 3: Adicionar campo na interface CriarTemplateItemRequest**

Na interface `CriarTemplateItemRequest` (linha 524), adicionar no final:

```typescript
opcoesRespostaConfig?: OpcaoRespostaConfig[];
```

**Step 4: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat: add OpcaoRespostaConfig types to frontend

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Frontend - Template Editor UI (Respostas Padrão)

**Files:**
- Modify: `apps/web/src/app/templates/[id]/page.tsx`

**Step 1: Inicializar opcoesRespostaConfig no resetItemForm**

Na função `resetItemForm` (linha 437), modificar para incluir configs padrão:

```typescript
const resetItemForm = () => {
  setItemForm({
    pergunta: '',
    categoria: CategoriaItem.OUTRO,
    criticidade: CriticidadeItem.MEDIA,
    peso: 1,
    obrigatorio: true,
    usarRespostasPersonalizadas: false,
    opcoesResposta: [],
    opcoesRespostaConfig: RESPOSTAS_PADRAO.map(resp => ({
      valor: resp.valor,
      fotoObrigatoria: false,
      observacaoObrigatoria: false,
    })),
  });
};
```

**Step 2: Atualizar handleAbrirModalEditarItem**

Na função `handleAbrirModalEditarItem` (linha 463), garantir que configs sejam carregadas ou inicializadas:

```typescript
const handleAbrirModalEditarItem = (item: TemplateItem) => {
  setEditingItem(item);

  // Inicializar configs se não existirem
  let configs = item.opcoesRespostaConfig;
  if (!configs || configs.length === 0) {
    if (item.usarRespostasPersonalizadas || item.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT) {
      configs = (item.opcoesResposta || []).map(opcao => ({
        valor: opcao,
        fotoObrigatoria: false,
        observacaoObrigatoria: false,
      }));
    } else {
      configs = RESPOSTAS_PADRAO.map(resp => ({
        valor: resp.valor,
        fotoObrigatoria: false,
        observacaoObrigatoria: false,
      }));
    }
  }

  setItemForm({
    id: item.id,
    pergunta: item.pergunta,
    categoria: item.categoria,
    criticidade: item.criticidade,
    peso: item.peso,
    obrigatorio: item.obrigatorio,
    legislacaoReferencia: item.legislacaoReferencia,
    artigo: item.artigo,
    textoLegal: item.textoLegal,
    usarRespostasPersonalizadas: item.usarRespostasPersonalizadas,
    tipoRespostaCustomizada: item.tipoRespostaCustomizada,
    opcoesResposta: item.opcoesResposta || [],
    opcoesRespostaConfig: configs,
    grupoId: item.grupoId,
    secao: item.secao,
  });
  setShowItemModal(true);
};
```

**Step 3: Adicionar função para atualizar config individual**

Adicionar nova função após `handleRemoverOpcaoResposta`:

```typescript
const handleAtualizarOpcaoConfig = (valor: string, campo: 'fotoObrigatoria' | 'observacaoObrigatoria', checked: boolean) => {
  setItemForm(prev => {
    const configs = prev.opcoesRespostaConfig || [];
    const novasConfigs = configs.map(config =>
      config.valor === valor
        ? { ...config, [campo]: checked }
        : config
    );
    return { ...prev, opcoesRespostaConfig: novasConfigs };
  });
};
```

**Step 4: Substituir seção de respostas padrão**

Localizar o bloco (linha 1137-1146):

```typescript
{!itemForm.usarRespostasPersonalizadas && (
  <div className="bg-base-200/50 rounded-lg p-4">
    <span className="text-xs text-base-content/60">Respostas padrão:</span>
    <div className="flex flex-wrap gap-2 mt-2">
      {RESPOSTAS_PADRAO.map((resp) => (
        <span key={resp.valor} className="badge badge-ghost">{resp.label}</span>
      ))}
    </div>
  </div>
)}
```

Substituir por:

```typescript
{!itemForm.usarRespostasPersonalizadas && !itemForm.tipoRespostaCustomizada && (
  <div className="bg-base-200/50 rounded-lg p-4">
    <span className="text-xs text-base-content/60 font-medium">Configuração de Obrigatoriedade:</span>
    <div className="space-y-2 mt-3">
      {RESPOSTAS_PADRAO.map((resp) => {
        const config = itemForm.opcoesRespostaConfig?.find(c => c.valor === resp.valor);
        return (
          <div key={resp.valor} className="flex items-center justify-between bg-base-100 rounded p-3">
            <span className="badge badge-ghost">{resp.label}</span>
            <div className="flex gap-4">
              <label className="label cursor-pointer gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={config?.fotoObrigatoria || false}
                  onChange={(e) => handleAtualizarOpcaoConfig(resp.valor, 'fotoObrigatoria', e.target.checked)}
                />
                <span className="label-text text-xs">Foto obrigatória</span>
              </label>
              <label className="label cursor-pointer gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={config?.observacaoObrigatoria || false}
                  onChange={(e) => handleAtualizarOpcaoConfig(resp.valor, 'observacaoObrigatoria', e.target.checked)}
                />
                <span className="label-text text-xs">Observação obrigatória</span>
              </label>
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}
```

**Step 5: Testar no navegador**

1. Abrir página de template existente
2. Editar uma pergunta com respostas padrão
3. Verificar se checkboxes aparecem para cada opção
4. Marcar/desmarcar checkboxes
5. Salvar e verificar se foi salvo corretamente

Expected: UI renderiza checkboxes, state atualiza ao clicar, salvamento preserva configs

**Step 6: Commit**

```bash
git add apps/web/src/app/templates/[id]/page.tsx
git commit -m "feat: add UI for configuring photo/observation requirements (standard options)

- Add checkboxes for each standard response option
- Initialize configs on form reset and edit
- Update configs when toggling checkboxes

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Frontend - Template Editor UI (Respostas Personalizadas)

**Files:**
- Modify: `apps/web/src/app/templates/[id]/page.tsx`

**Step 1: Atualizar handleAdicionarOpcaoResposta para adicionar config**

Modificar função `handleAdicionarOpcaoResposta` (aproximadamente linha 552):

```typescript
const handleAdicionarOpcaoResposta = () => {
  if (novaOpcaoResposta.trim()) {
    setItemForm({
      ...itemForm,
      opcoesResposta: [...(itemForm.opcoesResposta || []), novaOpcaoResposta.trim()],
      opcoesRespostaConfig: [
        ...(itemForm.opcoesRespostaConfig || []),
        {
          valor: novaOpcaoResposta.trim(),
          fotoObrigatoria: false,
          observacaoObrigatoria: false,
        }
      ],
    });
    setNovaOpcaoResposta('');
  }
};
```

**Step 2: Atualizar handleRemoverOpcaoResposta para remover config**

Modificar função `handleRemoverOpcaoResposta` (aproximadamente linha 560):

```typescript
const handleRemoverOpcaoResposta = (opcao: string) => {
  setItemForm({
    ...itemForm,
    opcoesResposta: itemForm.opcoesResposta?.filter((o) => o !== opcao),
    opcoesRespostaConfig: itemForm.opcoesRespostaConfig?.filter((c) => c.valor !== opcao),
  });
};
```

**Step 3: Atualizar handleAdicionarSugestao para adicionar config**

Modificar função `handleAdicionarSugestao` (aproximadamente linha 568):

```typescript
const handleAdicionarSugestao = (sugestao: string) => {
  setItemForm({
    ...itemForm,
    opcoesResposta: [...(itemForm.opcoesResposta || []), sugestao],
    opcoesRespostaConfig: [
      ...(itemForm.opcoesRespostaConfig || []),
      {
        valor: sugestao,
        fotoObrigatoria: false,
        observacaoObrigatoria: false,
      }
    ],
  });
};
```

**Step 4: Modificar renderização de opções personalizadas**

Localizar seção (linha 1096-1135) e substituir badges de opções por:

```typescript
{itemForm.opcoesResposta && itemForm.opcoesResposta.length > 0 && (
  <div className="space-y-2">
    {itemForm.opcoesResposta.map((opcao, idx) => {
      const config = itemForm.opcoesRespostaConfig?.find(c => c.valor === opcao);
      return (
        <div key={idx} className="bg-base-100 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="badge badge-lg border-2 border-primary">{opcao}</div>
            <button
              onClick={() => handleRemoverOpcaoResposta(opcao)}
              className="btn btn-ghost btn-xs btn-circle"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex gap-4 pl-2">
            <label className="label cursor-pointer gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={config?.fotoObrigatoria || false}
                onChange={(e) => handleAtualizarOpcaoConfig(opcao, 'fotoObrigatoria', e.target.checked)}
              />
              <span className="label-text text-xs">Foto obrigatória</span>
            </label>
            <label className="label cursor-pointer gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={config?.observacaoObrigatoria || false}
                onChange={(e) => handleAtualizarOpcaoConfig(opcao, 'observacaoObrigatoria', e.target.checked)}
              />
              <span className="label-text text-xs">Observação obrigatória</span>
            </label>
          </div>
        </div>
      );
    })}
  </div>
)}
```

**Step 5: Testar no navegador**

1. Criar/editar pergunta com respostas personalizadas
2. Adicionar opções personalizadas
3. Verificar se checkboxes aparecem para cada opção
4. Marcar/desmarcar checkboxes
5. Remover uma opção e verificar se config também é removida
6. Salvar e recarregar para confirmar persistência

Expected: Opções personalizadas mostram checkboxes, adicionar/remover sincroniza configs

**Step 6: Commit**

```bash
git add apps/web/src/app/templates/[id]/page.tsx
git commit -m "feat: add UI for configuring photo/observation requirements (custom options)

- Add checkboxes for each custom response option
- Sync configs when adding/removing options
- Maintain config state in form

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Frontend - Auditoria Validation Logic

**Files:**
- Modify: `apps/web/src/app/auditoria/[id]/page.tsx`

**Step 1: Adicionar função de buscar config da opção**

Adicionar nova função auxiliar após as funções existentes (aproximadamente linha 350):

```typescript
const getOpcaoConfig = (item: AuditoriaItem, resposta: string) => {
  const configs = item.templateItem.opcoesRespostaConfig;
  if (!configs || configs.length === 0) {
    // Comportamento legado: observação sempre obrigatória, foto opcional
    return {
      fotoObrigatoria: false,
      observacaoObrigatoria: true,
    };
  }

  const config = configs.find(c => c.valor === resposta);
  return config || {
    fotoObrigatoria: false,
    observacaoObrigatoria: false,
  };
};
```

**Step 2: Modificar validação no handleSalvarResposta**

Localizar função `handleSalvarResposta` (linha 489) e modificar a validação de observação:

```typescript
const handleSalvarResposta = async () => {
  if (!itemModal || !itemModal.resposta) {
    toastService.error('Selecione uma resposta');
    return;
  }

  // Buscar configuração da opção selecionada
  const opcaoConfig = getOpcaoConfig(itemModal.item, itemModal.resposta);

  // Validar foto obrigatória
  if (opcaoConfig.fotoObrigatoria && itemModal.fotos.length === 0) {
    toastService.error('Esta resposta requer pelo menos uma foto');
    return;
  }

  // Validar observação obrigatória
  if (opcaoConfig.observacaoObrigatoria && (!itemModal.observacao || itemModal.observacao.trim() === '')) {
    toastService.error('Esta resposta requer uma observação');
    return;
  }

  // Validar imagens não relevantes
  const imagensNaoRelevantes = itemModal.fotos.filter(
    (f) => f.analiseIa && !f.analiseIa.imagemRelevante
  );

  if (imagensNaoRelevantes.length > 0 && (!itemModal.observacao || itemModal.observacao.trim() === '')) {
    toastService.error(
      'Por favor, remova as imagens inadequadas ou adicione uma observação explicando por que a imagem é relevante.'
    );
    return;
  }

  // Resto da função continua igual...
```

**Step 3: Adicionar feedback visual no campo de observação**

Localizar o textarea de observação (linha 1198) e modificar para mostrar obrigatoriedade:

```typescript
const opcaoConfigModal = itemModal ? getOpcaoConfig(itemModal.item, itemModal.resposta || '') : null;
const observacaoObrigatoria = opcaoConfigModal?.observacaoObrigatoria || false;
const imagensNaoRelevantes = itemModal?.fotos.some((f) => f.analiseIa && !f.analiseIa.imagemRelevante) || false;

// ...

<textarea
  placeholder="Adicione observações sobre este item..."
  className={`textarea textarea-bordered ${
    observacaoObrigatoria && (!itemModal.observacao || itemModal.observacao.trim() === '')
      ? 'textarea-error'
      : ''
  }`}
  rows={4}
  value={itemModal.observacao}
  onChange={(e) => setItemModal((prev) => prev ? { ...prev, observacao: e.target.value } : null)}
/>
{observacaoObrigatoria && (!itemModal.observacao || itemModal.observacao.trim() === '') && (
  <label className="label">
    <span className="label-text-alt text-error">Observação obrigatória para esta resposta</span>
  </label>
)}
```

**Step 4: Adicionar badge de foto obrigatória**

Localizar seção de adicionar foto (linha 1186) e adicionar badge:

```typescript
const fotoObrigatoria = opcaoConfigModal?.fotoObrigatoria || false;

// ...

<div className="flex items-center justify-between">
  <label className="text-sm font-medium text-base-content flex items-center gap-2">
    Fotos
    {fotoObrigatoria && itemModal.fotos.length === 0 && (
      <span className="badge badge-error badge-sm">Obrigatório</span>
    )}
  </label>
  <label className="btn btn-sm btn-ghost gap-2 cursor-pointer">
    <Camera className="w-4 h-4" />
    Adicionar Foto
    <input type="file" className="hidden" accept="image/*" onChange={handleAdicionarFoto} />
  </label>
</div>
```

**Step 5: Atualizar condição de desabilitar botão Salvar**

Localizar botão de salvar (linha 1227) e atualizar condição:

```typescript
<button
  className="btn btn-primary w-full"
  onClick={handleSalvarResposta}
  disabled={
    !itemModal.resposta ||
    (opcaoConfigModal?.observacaoObrigatoria && (!itemModal.observacao || itemModal.observacao.trim() === '')) ||
    (opcaoConfigModal?.fotoObrigatoria && itemModal.fotos.length === 0) ||
    (imagensNaoRelevantes && (!itemModal.observacao || itemModal.observacao.trim() === ''))
  }
>
  Salvar Resposta
</button>
```

**Step 6: Testar no navegador**

1. Iniciar uma auditoria
2. Responder item com foto obrigatória configurada
3. Tentar salvar sem foto - deve bloquear
4. Adicionar foto - deve permitir salvar
5. Responder item com observação obrigatória
6. Tentar salvar sem observação - deve bloquear
7. Adicionar observação - deve permitir salvar

Expected: Validações funcionam, feedbacks visuais aparecem, botão desabilita quando apropriado

**Step 7: Commit**

```bash
git add apps/web/src/app/auditoria/[id]/page.tsx
git commit -m "feat: add validation for mandatory photos and observations

- Validate based on selected response option config
- Show visual feedback (error borders, badges)
- Disable save button when requirements not met
- Legacy support for items without configs

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Testing and Documentation

**Files:**
- Create: `docs/features/obrigatoriedade-fotos-observacoes.md`

**Step 1: Criar documentação da feature**

```markdown
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
```

**Step 2: Testar cenários edge cases**

Testar manualmente:

1. **Pergunta antiga (sem configs):**
   - Abrir pergunta criada antes da feature
   - Verificar comportamento legado funciona
   - Editar e salvar - configs devem ser criadas

2. **Adicionar muitas opções personalizadas:**
   - Criar pergunta com 10+ opções
   - Configurar obrigatoriedade em algumas
   - Verificar performance e UI

3. **Alternar tipos de resposta:**
   - Criar pergunta padrão
   - Mudar para SELECT
   - Verificar configs sincronizam

4. **Importação de checklist:**
   - Importar checklist antigo
   - Verificar configs criadas automaticamente

**Step 3: Verificar logs e console**

```bash
# Backend logs
cd apps/api
npm run start:dev

# Verificar se migrations rodaram
# Verificar se normalização está sendo chamada
```

**Step 4: Commit final**

```bash
git add docs/features/obrigatoriedade-fotos-observacoes.md
git commit -m "docs: add documentation for photo/observation requirements feature

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Summary

**Total Tasks:** 8
**Estimated Time:** 2-3 hours

**Key Changes:**
- Backend: Migration, entity, DTOs, service normalization
- Frontend: Template editor UI, auditoria validation
- Documentation: Feature documentation

**Testing Checklist:**
- [ ] Migration executes successfully
- [ ] Configs populated for existing questions
- [ ] Template editor shows checkboxes
- [ ] Adding/removing options syncs configs
- [ ] Auditoria validates based on selected response
- [ ] Visual feedback works (borders, badges, disabled button)
- [ ] Legacy questions continue working
- [ ] Import checklist creates configs

**Rollback Plan:**
If issues arise, rollback migration:
```bash
cd apps/api
npm run typeorm:revert
```
