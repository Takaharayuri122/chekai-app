# Tabs para Fotos e Observações no Modal de Auditoria - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refatorar o modal de auditoria para usar tabs (abas) separando fotos e observações, mostrando a aba de fotos apenas quando alguma opção de resposta exigir foto.

**Architecture:** Adicionar state para controlar a tab ativa. Criar função helper `algmaOpcaoExigeFoto` que verifica se alguma opção do template tem `fotoObrigatoria: true`. Usar componente tabs do DaisyUI com badges indicando obrigatoriedade. Manter layout linear no relatório (sem mudanças).

**Tech Stack:** React, TypeScript, DaisyUI, TailwindCSS

---

## Task 1: Adicionar helper function e state

**Files:**
- Modify: `apps/web/src/app/auditoria/[id]/page.tsx`

**Step 1: Adicionar função helper algmaOpcaoExigeFoto**

Após a função `getOpcaoConfig` (linha 505), adicionar:

```typescript
const algmaOpcaoExigeFoto = (item: AuditoriaItem): boolean => {
  const configs = item.templateItem.opcoesRespostaConfig;
  if (!configs || configs.length === 0) return false;
  return configs.some(c => c.fotoObrigatoria);
};
```

**Step 2: Adicionar state para controlar tab ativa**

Encontrar a seção de states (próximo aos outros useState) e adicionar:

```typescript
const [activeTab, setActiveTab] = useState<'fotos' | 'observacao'>('fotos');
```

**Step 3: Resetar tab ao abrir modal**

Na função que abre o modal de item (onde `setItemModal` é chamado), adicionar lógica para definir tab inicial:

```typescript
// Quando abrir modal, definir tab inicial
useEffect(() => {
  if (itemModal) {
    // Se tem fotos disponíveis, começa em fotos, senão em observação
    if (algmaOpcaoExigeFoto(itemModal.item)) {
      setActiveTab('fotos');
    } else {
      setActiveTab('observacao');
    }
  }
}, [itemModal?.item.id]);
```

**Step 4: Commit**

```bash
git add apps/web/src/app/auditoria/[id]/page.tsx
git commit -m "feat: add helper function and state for tabs

- Add algmaOpcaoExigeFoto to check if any option requires photo
- Add activeTab state to control which tab is visible
- Auto-select initial tab when modal opens

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Criar estrutura de tabs no modal

**Files:**
- Modify: `apps/web/src/app/auditoria/[id]/page.tsx`

**Step 1: Encontrar a seção de fotos no modal**

Localizar onde começa a seção de fotos (linha 1043: `{/* Área de fotos */}`).

**Step 2: Envolver fotos e observação em estrutura de tabs**

Substituir toda a estrutura atual (da linha 1043 até antes do `{/* Ações */}`) por:

```typescript
{/* Tabs para Fotos e Observação */}
<div className="mb-6">
  {/* Tab Headers */}
  <div className="tabs tabs-boxed bg-base-200 mb-4">
    {algmaOpcaoExigeFoto(itemModal.item) && (() => {
      const opcaoConfigModal = getOpcaoConfig(itemModal.item, itemModal.item.resposta || '');
      const fotoObrigatoria = opcaoConfigModal?.fotoObrigatoria || false;

      return (
        <button
          className={`tab gap-2 ${activeTab === 'fotos' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('fotos')}
        >
          <Camera className="w-4 h-4" />
          Fotos
          {fotoObrigatoria && itemModal.fotos.length === 0 && (
            <span className="badge badge-error badge-sm">Obrigatório</span>
          )}
        </button>
      );
    })()}

    {(() => {
      const opcaoConfigModal = getOpcaoConfig(itemModal.item, itemModal.item.resposta || '');
      const observacaoObrigatoria = opcaoConfigModal?.observacaoObrigatoria || false;

      return (
        <button
          className={`tab gap-2 ${activeTab === 'observacao' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('observacao')}
        >
          <MessageSquare className="w-4 h-4" />
          Observação
          {observacaoObrigatoria && (!itemModal.observacao || itemModal.observacao.trim() === '') && (
            <span className="badge badge-error badge-sm">Obrigatório</span>
          )}
        </button>
      );
    })()}
  </div>

  {/* Tab Content */}
  <div className="min-h-[300px]">
    {/* Conteúdo será movido aqui nas próximas etapas */}
  </div>
</div>
```

**Step 3: Verificar compilação**

```bash
cd apps/web
npm run build
```

Expected: Build completes successfully (mesmo que o conteúdo ainda não esteja dentro das tabs)

**Step 4: Commit**

```bash
git add apps/web/src/app/auditoria/[id]/page.tsx
git commit -m "feat: add tabs structure to modal

- Create tabs headers with Camera and MessageSquare icons
- Add badges for required fields
- Set up tab switching logic

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Mover conteúdo de fotos para dentro da tab

**Files:**
- Modify: `apps/web/src/app/auditoria/[id]/page.tsx`

**Step 1: Localizar todo o conteúdo de fotos**

Encontrar o bloco completo de fotos que estava dentro do IIFE:
- Grid de fotos
- Botão adicionar
- Estado vazio

**Step 2: Mover conteúdo para dentro da tab de fotos**

Dentro do `<div className="min-h-[300px]">`, adicionar:

```typescript
{/* Tab Fotos */}
{activeTab === 'fotos' && algmaOpcaoExigeFoto(itemModal.item) && (() => {
  const opcaoConfigModal = getOpcaoConfig(itemModal.item, itemModal.item.resposta || '');
  const fotoObrigatoria = opcaoConfigModal?.fotoObrigatoria || false;

  return (
    <div>
      {/* Grid de fotos */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {itemModal.fotos.map((foto, index) => (
          <div key={index} className="relative aspect-square">
            <img
              src={foto.preview}
              alt={`Foto ${index + 1}`}
              className="w-full h-full object-cover rounded-lg"
            />
            {foto.isAnalyzing && (
              <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              </div>
            )}
            {foto.analiseIa && (
              <div className="absolute bottom-1 left-1 flex gap-1 flex-wrap">
                {!foto.analiseIa.imagemRelevante && (
                  <span className="badge badge-xs badge-error" title="Imagem não relacionada ao item do checklist">
                    <AlertCircle className="w-2 h-2 mr-1" />
                    Não relevante
                  </span>
                )}
                {foto.analiseIa.imagemRelevante && (
                  <span className={`badge badge-xs ${
                    foto.analiseIa.tipoNaoConformidade === 'Nenhuma identificada'
                      ? 'badge-success'
                      : foto.analiseIa.gravidade === 'critica' ? 'badge-error'
                      : foto.analiseIa.gravidade === 'alta' ? 'badge-warning'
                      : 'badge-info'
                  }`}>
                    <Sparkles className="w-2 h-2" />
                  </span>
                )}
              </div>
            )}
            {auditoria.status !== 'finalizada' && (
              <button
                onClick={() => handleRemoveFoto(index)}
                className="absolute top-1 right-1 btn btn-circle btn-xs btn-error"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}

        {/* Botão adicionar mais */}
        {itemModal.fotos.length < MAX_FOTOS_POR_ITEM && auditoria.status !== 'finalizada' && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square border-2 border-dashed border-base-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <ImageIcon className="w-6 h-6 text-base-content/40" />
            <span className="text-xs text-base-content/60">Adicionar</span>
          </button>
        )}
      </div>

      {itemModal.fotos.length === 0 && auditoria.status !== 'finalizada' && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-24 border-2 border-dashed border-base-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <Camera className="w-8 h-8 text-base-content/40" />
          <span className="text-sm text-base-content/60">Clique para adicionar fotos (até {MAX_FOTOS_POR_ITEM})</span>
        </button>
      )}
      {itemModal.fotos.length === 0 && auditoria.status === 'finalizada' && (
        <div className="text-center py-8 text-base-content/60">
          <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Nenhuma foto foi adicionada a este item</p>
        </div>
      )}

      {/* Análises de fotos (se houver) */}
      {itemModal.fotos.some(f => f.analiseIa) && (
        <div className="mt-4 space-y-3">
          {itemModal.fotos.map((foto, index) =>
            foto.analiseIa && (
              <div key={index} className="alert alert-info text-sm">
                <Sparkles className="w-4 h-4" />
                <div className="flex-1">
                  <p className="font-medium">Análise da Foto {index + 1}:</p>
                  <p className="text-xs mt-1">{foto.analiseIa.descricao}</p>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
})()}
```

**Step 3: Testar no navegador**

1. Iniciar aplicação
2. Abrir uma auditoria
3. Clicar em um item
4. Verificar se tab de fotos aparece (se alguma opção exigir)
5. Verificar se consegue adicionar/remover fotos

Expected: Tab de fotos funciona, fotos podem ser adicionadas/removidas

**Step 4: Commit**

```bash
git add apps/web/src/app/auditoria/[id]/page.tsx
git commit -m "feat: move photos content into tabs

- Move entire photos section into fotos tab
- Include grid, upload buttons, and empty state
- Maintain photo analysis display

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Mover conteúdo de observação para dentro da tab

**Files:**
- Modify: `apps/web/src/app/auditoria/[id]/page.tsx`

**Step 1: Localizar conteúdo de observação**

Encontrar o bloco de observação (linha 1244: `{/* Observação */}`)

**Step 2: Mover conteúdo para dentro da tab de observação**

Dentro do `<div className="min-h-[300px]">`, após a tab de fotos, adicionar:

```typescript
{/* Tab Observação */}
{activeTab === 'observacao' && (() => {
  const opcaoConfigModal = getOpcaoConfig(itemModal.item, itemModal.item.resposta || '');
  const observacaoObrigatoria = opcaoConfigModal?.observacaoObrigatoria || false;
  const imagensNaoRelevantes = itemModal?.fotos.some((f) => f.analiseIa && !f.analiseIa.imagemRelevante) || false;

  return (
    <div className="form-control">
      <label className="label">
        <span className="label-text font-medium">
          Observação do Auditor {observacaoObrigatoria && <span className="text-error">*</span>}
        </span>
      </label>
      <textarea
        placeholder="Adicione observações sobre este item..."
        className={`textarea textarea-bordered ${
          observacaoObrigatoria && (!itemModal.observacao || itemModal.observacao.trim() === '')
            ? 'textarea-error'
            : ''
        }`}
        rows={8}
        value={itemModal.observacao}
        onChange={(e) => setItemModal((prev) => prev ? { ...prev, observacao: e.target.value } : null)}
        disabled={auditoria.status === 'finalizada'}
        readOnly={auditoria.status === 'finalizada'}
      />
      {observacaoObrigatoria && (!itemModal.observacao || itemModal.observacao.trim() === '') && (
        <label className="label">
          <span className="label-text-alt text-error">Observação obrigatória para esta resposta</span>
        </label>
      )}
      {imagensNaoRelevantes && (
        <div className="alert alert-warning mt-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>Há fotos marcadas como não relevantes. Adicione uma observação explicando sua relevância.</span>
        </div>
      )}
    </div>
  );
})()}
```

**Step 3: Aumentar rows do textarea**

Note que mudamos `rows={4}` para `rows={8}` para dar mais espaço vertical já que agora está em uma tab separada.

**Step 4: Testar no navegador**

1. Abrir modal de item
2. Clicar na tab "Observação"
3. Verificar se textarea aparece
4. Verificar validações (borda vermelha quando obrigatório)
5. Alternar entre tabs

Expected: Tabs alternam corretamente, observação funciona, validações aparecem

**Step 5: Commit**

```bash
git add apps/web/src/app/auditoria/[id]/page.tsx
git commit -m "feat: move observation content into tabs

- Move textarea and validation to observacao tab
- Increase textarea rows for better UX
- Add warning for irrelevant images

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Ajustar validação e cleanup

**Files:**
- Modify: `apps/web/src/app/auditoria/[id]/page.tsx`

**Step 1: Remover código antigo duplicado**

Procurar e remover os blocos antigos de fotos e observação que agora estão duplicados (fora das tabs). Eles estarão comentados ou não funcionais.

**Step 2: Verificar que validação continua funcionando**

A validação no `handleSaveItemModal` deve continuar funcionando pois usa `itemModal.fotos` e `itemModal.observacao` diretamente, independente das tabs.

**Step 3: Adicionar validação visual ao trocar de tab**

Se usuário tentar salvar com campo obrigatório vazio, pode ser útil mudar automaticamente para a tab com problema:

Modificar a validação em `handleSaveItemModal`:

```typescript
// Validar foto obrigatória
if (opcaoConfig.fotoObrigatoria && itemModal.fotos.length === 0) {
  setActiveTab('fotos'); // Mudar para tab de fotos
  toastService.error('Esta resposta requer pelo menos uma foto');
  return;
}

// Validar observação obrigatória
if (opcaoConfig.observacaoObrigatoria && (!itemModal.observacao || itemModal.observacao.trim() === '')) {
  setActiveTab('observacao'); // Mudar para tab de observação
  toastService.error('Esta resposta requer uma observação');
  return;
}
```

**Step 4: Testar cenários de validação**

1. Configurar uma pergunta com foto obrigatória
2. Selecionar resposta que exige foto
3. Tentar salvar sem foto
4. Verificar se muda para tab de fotos e mostra erro
5. Fazer o mesmo com observação obrigatória

Expected: Validação muda para tab apropriada e mostra erro

**Step 5: Commit**

```bash
git add apps/web/src/app/auditoria/[id]/page.tsx
git commit -m "feat: improve validation UX with auto tab switching

- Remove old duplicated code
- Auto-switch to tab with validation error
- Maintain all existing validation logic

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Ajustes finais de UX e acessibilidade

**Files:**
- Modify: `apps/web/src/app/auditoria/[id]/page.tsx`

**Step 1: Adicionar indicador visual de quantas fotos foram adicionadas**

Na tab header de fotos, adicionar contador:

```typescript
<button
  className={`tab gap-2 ${activeTab === 'fotos' ? 'tab-active' : ''}`}
  onClick={() => setActiveTab('fotos')}
>
  <Camera className="w-4 h-4" />
  Fotos
  {itemModal.fotos.length > 0 && (
    <span className="badge badge-neutral badge-sm">{itemModal.fotos.length}</span>
  )}
  {fotoObrigatoria && itemModal.fotos.length === 0 && (
    <span className="badge badge-error badge-sm">Obrigatório</span>
  )}
</button>
```

**Step 2: Adicionar atalhos de teclado (opcional)**

Para melhor acessibilidade, permitir trocar tabs com teclas:

```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (!itemModal) return;

    // Alt+1 = Fotos, Alt+2 = Observação
    if (e.altKey && e.key === '1' && algmaOpcaoExigeFoto(itemModal.item)) {
      setActiveTab('fotos');
    } else if (e.altKey && e.key === '2') {
      setActiveTab('observacao');
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [itemModal]);
```

**Step 3: Adicionar tooltips nos headers das tabs**

```typescript
<button
  className={`tab gap-2 ${activeTab === 'fotos' ? 'tab-active' : ''}`}
  onClick={() => setActiveTab('fotos')}
  title="Alt+1 para alternar"
>
```

**Step 4: Testar acessibilidade**

1. Testar navegação por teclado
2. Verificar que screen readers funcionam
3. Testar em mobile (tabs devem funcionar bem em touch)

Expected: Tabs funcionam bem com teclado e touch, contadores aparecem

**Step 5: Commit**

```bash
git add apps/web/src/app/auditoria/[id]/page.tsx
git commit -m "feat: add UX improvements to tabs

- Add photo counter badge in tab header
- Add keyboard shortcuts (Alt+1, Alt+2)
- Add tooltips for accessibility
- Improve mobile touch support

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Documentação e testes finais

**Files:**
- Modify: `docs/features/obrigatoriedade-fotos-observacoes.md`

**Step 1: Atualizar documentação da feature**

Adicionar seção sobre as tabs:

```markdown
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
```

**Step 2: Testar todos os cenários**

Executar os testes manuais:

1. **Pergunta sem foto obrigatória em nenhuma opção:**
   - Tab de fotos não deve aparecer
   - Apenas tab de observação visível

2. **Pergunta com foto obrigatória em alguma opção:**
   - Tab de fotos aparece
   - Selecionar opção que exige foto → badge "Obrigatório"
   - Selecionar opção que não exige → badge desaparece

3. **Adicionar fotos:**
   - Contador atualiza no header da tab
   - Grid funciona corretamente
   - Análise de IA aparece

4. **Validação:**
   - Tentar salvar sem foto obrigatória → muda para tab fotos
   - Tentar salvar sem observação obrigatória → muda para tab observação

5. **Atalhos de teclado:**
   - Alt+1 muda para fotos (se disponível)
   - Alt+2 muda para observação

6. **Relatório:**
   - Verificar que relatório continua com layout linear
   - Fotos e observações aparecem normalmente

**Step 3: Verificar build production**

```bash
cd apps/web
npm run build
```

Expected: Build completes without errors or warnings

**Step 4: Commit documentação**

```bash
git add docs/features/obrigatoriedade-fotos-observacoes.md
git commit -m "docs: update feature documentation with tabs info

- Add section about tabs in audit interface
- Document keyboard shortcuts
- Explain validation behavior
- Note that report layout remains unchanged

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Summary

**Total Tasks:** 7
**Estimated Time:** 1-2 hours

**Key Changes:**
- Tabs separadas para fotos e observações
- Tab de fotos só aparece se alguma opção exigir
- Badges indicam campos obrigatórios
- Contador de fotos no header
- Auto-switch para tab com erro de validação
- Atalhos de teclado para acessibilidade
- Relatório não modificado

**Testing Checklist:**
- [ ] Tab de fotos aparece apenas quando necessário
- [ ] Badges "Obrigatório" funcionam corretamente
- [ ] Contador de fotos atualiza
- [ ] Validação muda para tab correta
- [ ] Atalhos de teclado funcionam
- [ ] Funciona em mobile/touch
- [ ] Relatório continua funcionando normal
- [ ] Build production sem erros

**No Changes to Report:**
- Arquivo `apps/web/src/app/auditoria/[id]/relatorio/page.tsx` não é modificado
- Layout linear de fotos e observações mantido no relatório
