# Google Analytics - Guia de Configuração

Este documento descreve como configurar e usar o Google Analytics no ChekAI.

## Configuração Inicial

### 1. Obter o ID do Google Analytics

1. Acesse [Google Analytics](https://analytics.google.com/)
2. Crie uma propriedade ou use uma existente
3. Copie o **Measurement ID** (formato: `G-XXXXXXXXXX` para GA4)

### 2. Configurar Variável de Ambiente

Adicione a variável de ambiente no seu arquivo `.env.local`:

```env
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

**Importante**: A variável deve começar com `NEXT_PUBLIC_` para ser acessível no cliente.

### 3. Configurar no Vercel

1. Acesse o dashboard do Vercel
2. Vá em **Settings** → **Environment Variables**
3. Adicione:
   - **Key**: `NEXT_PUBLIC_GA_ID`
   - **Value**: `G-XXXXXXXXXX`
4. Selecione os ambientes (Production, Preview, Development)
5. Salve e faça um novo deploy

## Como Funciona

O Google Analytics é carregado automaticamente através do componente `GoogleAnalytics` no `layout.tsx`. Ele rastreia:

- ✅ Visualizações de página (automático)
- ✅ Eventos customizados (através de funções utilitárias)

## Rastreamento de Eventos

### Eventos Pré-definidos

Use as funções pré-definidas em `src/lib/analytics.ts`:

```typescript
import { analyticsEvents } from '@/lib/analytics';

// Autenticação
analyticsEvents.login('email');
analyticsEvents.logout();
analyticsEvents.register();

// Auditorias
analyticsEvents.createAudit(clientId);
analyticsEvents.viewAudit(auditId);
analyticsEvents.completeAudit(auditId);

// Fotos e IA
analyticsEvents.uploadPhoto(auditId);
analyticsEvents.analyzeWithAI(auditId, true); // true = sucesso

// Clientes
analyticsEvents.createClient();
analyticsEvents.viewClient(clientId);

// Templates
analyticsEvents.createTemplate();
analyticsEvents.useTemplate(templateId);

// Legislações
analyticsEvents.viewLegislation(legislationId);

// Erros
analyticsEvents.error('error_type', 'mensagem de erro');
```

### Eventos Customizados

Para eventos customizados, use a função `trackEvent`:

```typescript
import { trackEvent } from '@/lib/analytics';

trackEvent('evento_personalizado', {
  category: 'categoria',
  label: 'rótulo',
  value: 100,
  custom_param: 'valor customizado',
});
```

### Rastreamento de Visualizações de Página

Para rastrear visualizações customizadas:

```typescript
import { trackPageView } from '@/lib/analytics';

trackPageView('/caminho/customizado', 'Título da Página');
```

## Exemplo de Uso

### Exemplo 1: Rastrear Login

```typescript
// apps/web/src/app/login/page.tsx
import { analyticsEvents } from '@/lib/analytics';

const onSubmit = async (data: LoginFormData) => {
  try {
    const response = await authService.login(data.email, data.senha);
    setAuth(response.accessToken, response.usuario);
    
    // Rastrear login bem-sucedido
    analyticsEvents.login('email');
    
    router.push('/dashboard');
  } catch (error) {
    // Rastrear erro de login
    analyticsEvents.error('login_failed', error.message);
  }
};
```

### Exemplo 2: Rastrear Criação de Auditoria

```typescript
// apps/web/src/app/auditoria/nova/page.tsx
import { analyticsEvents } from '@/lib/analytics';

const handleCreateAudit = async (data: CriarAuditoriaRequest) => {
  try {
    const auditoria = await auditoriaService.criar(data);
    
    // Rastrear criação de auditoria
    analyticsEvents.createAudit(data.clienteId);
    
    router.push(`/auditoria/${auditoria.id}`);
  } catch (error) {
    analyticsEvents.error('create_audit_failed', error.message);
  }
};
```

### Exemplo 3: Rastrear Upload de Foto com IA

```typescript
// apps/web/src/app/auditoria/[id]/page.tsx
import { analyticsEvents } from '@/lib/analytics';

const handleImageSelect = async (file: File) => {
  try {
    // Upload da foto
    const foto = await auditoriaService.uploadFoto(auditId, file);
    
    // Rastrear upload
    analyticsEvents.uploadPhoto(auditId);
    
    // Análise com IA
    try {
      const analise = await auditoriaService.analisarFoto(auditId, foto.id);
      analyticsEvents.analyzeWithAI(auditId, true); // Sucesso
    } catch (iaError) {
      analyticsEvents.analyzeWithAI(auditId, false); // Falha
    }
  } catch (error) {
    analyticsEvents.error('upload_photo_failed', error.message);
  }
};
```

## Verificação

### 1. Verificar no Console do Navegador

Abra o DevTools (F12) → Console e verifique se não há erros relacionados ao GA.

### 2. Verificar no Google Analytics

1. Acesse [Google Analytics](https://analytics.google.com/)
2. Vá em **Reports** → **Realtime**
3. Navegue pelo site e verifique se os eventos aparecem em tempo real

### 3. Usar Google Tag Assistant

Instale a extensão [Google Tag Assistant](https://chrome.google.com/webstore/detail/tag-assistant-legacy-by-g/kejbdjndbnbjgmefkgdddjlbokphdefk) para verificar se o GA está carregando corretamente.

## Eventos Rastreados Automaticamente

O Google Analytics rastreia automaticamente:

- ✅ Visualizações de página
- ✅ Tempo na página
- ✅ Taxa de rejeição
- ✅ Origem do tráfego
- ✅ Dispositivos e navegadores

## Privacidade e LGPD

⚠️ **Importante**: Certifique-se de:

1. Informar os usuários sobre o uso de analytics (Política de Privacidade)
2. Considerar implementar consentimento (cookie banner) se necessário
3. Não rastrear informações pessoais identificáveis (PII)
4. Configurar retenção de dados conforme necessário

## Troubleshooting

### GA não está rastreando

1. Verifique se `NEXT_PUBLIC_GA_ID` está configurado corretamente
2. Verifique se o ID começa com `G-` (GA4)
3. Verifique o console do navegador para erros
4. Use o Google Tag Assistant para diagnosticar

### Eventos não aparecem

1. Verifique se está usando as funções corretas (`analyticsEvents` ou `trackEvent`)
2. Verifique se o evento está sendo chamado (adicione `console.log`)
3. Aguarde alguns minutos - eventos podem demorar para aparecer no GA
4. Verifique em **Realtime** primeiro, depois em **Events**

### Build falha

1. Certifique-se de que `@next/third-parties` está instalado
2. Verifique se não há erros de TypeScript
3. Verifique os logs do build

## Referências

- [Next.js Third-Party Packages](https://nextjs.org/docs/app/building-your-application/optimizing/third-party-libraries)
- [Google Analytics 4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
- [GA4 Event Reference](https://developers.google.com/analytics/devguides/collection/ga4/events)

