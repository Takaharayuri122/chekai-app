# chekAI Mobile — Plano 1: Fundação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a infraestrutura base do app mobile: Expo project, tipos compartilhados, banco SQLite com migrations, cliente HTTP, autenticação OTP, navegação protegida e onboarding de permissões.

**Architecture:** Expo SDK 52 (managed workflow) dentro do monorepo Turbo existente. Banco local expo-sqlite com migrations versionadas. Auth via OTP idêntico ao web, com JWT no expo-secure-store. Sync infrastructure com MMKV queue e TanStack Query v5 em modo offline-first.

**Tech Stack:** Expo SDK 52, Expo Router v4, NativeWind v4, expo-sqlite, TanStack Query v5, Zustand, MMKV, expo-secure-store, axios, TypeScript, jest-expo

**Spec:** `docs/superpowers/specs/2026-03-21-chekai-mobile-design.md`

**Planos seguintes:**
- Plano 2: Auditorias (fluxo completo offline)
- Plano 3: Relatórios Técnicos + Check-in/Geofencing + Dashboard

---

## Mapa de Arquivos

```
packages/shared/                          ← NOVO pacote compartilhado
├── package.json
├── tsconfig.json
└── src/
    └── types/
        ├── index.ts
        ├── enums.ts
        ├── usuario.ts
        ├── auditoria.ts
        ├── relatorio-tecnico.ts
        └── cliente.ts

apps/mobile/                              ← NOVO app Expo
├── app.json
├── eas.json
├── package.json
├── tsconfig.json
├── babel.config.js
├── metro.config.js
├── tailwind.config.js
├── app/
│   ├── _layout.tsx                       ← Root layout (fonts, QueryClient, auth guard)
│   ├── +not-found.tsx
│   ├── (auth)/
│   │   ├── _layout.tsx                   ← Layout sem tab bar
│   │   └── login.tsx                     ← Tela OTP (email → código)
│   └── (app)/
│       ├── _layout.tsx                   ← Tab bar + proteção de rota
│       └── index.tsx                     ← Dashboard (stub para Plano 3)
├── src/
│   ├── api/
│   │   └── client.ts                     ← Axios + interceptor de token
│   ├── auth/
│   │   ├── TokenStorage.ts               ← expo-secure-store wrapper
│   │   ├── AuthService.ts                ← solicitarOtp, validarOtp
│   │   └── __tests__/
│   │       ├── TokenStorage.test.ts
│   │       └── AuthService.test.ts
│   ├── db/
│   │   ├── client.ts                     ← Singleton expo-sqlite
│   │   ├── migrations.ts                 ← Runner de migrations versionadas
│   │   ├── schema.ts                     ← SQL das tabelas (v1)
│   │   └── __tests__/
│   │       └── migrations.test.ts
│   ├── sync/
│   │   ├── SyncQueue.ts                  ← MMKV-backed queue de operações
│   │   ├── SyncService.ts                ← Orquestrador pull/push (skeleton)
│   │   ├── pull.ts                       ← Lógica de pull (dados de referência)
│   │   └── __tests__/
│   │       └── SyncQueue.test.ts
│   ├── store/
│   │   └── auth.ts                       ← Zustand store de autenticação
│   └── components/
│       ├── OfflineBanner.tsx             ← Banner global de status offline
│       ├── SyncStatusBadge.tsx           ← Contador de pendências
│       └── onboarding/
│           ├── PermissionOnboarding.tsx  ← Container do fluxo de 4 telas
│           ├── PermissionStep.tsx        ← Tela individual de permissão
│           └── __tests__/
│               └── PermissionOnboarding.test.ts
```

**Arquivo modificado no monorepo:**
- `package.json` (root) — adicionar `apps/mobile` e `packages/shared` aos workspaces (já cobertos pela glob `apps/*` e `packages/*`)
- `turbo.json` — adicionar pipeline para `@meta-app/mobile`

---

## Task 1: packages/shared — Tipos TypeScript compartilhados

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types/enums.ts`
- Create: `packages/shared/src/types/usuario.ts`
- Create: `packages/shared/src/types/auditoria.ts`
- Create: `packages/shared/src/types/relatorio-tecnico.ts`
- Create: `packages/shared/src/types/cliente.ts`
- Create: `packages/shared/src/types/index.ts`

- [ ] **Step 1: Criar estrutura do pacote**

```bash
mkdir -p packages/shared/src/types
```

- [ ] **Step 2: Criar package.json do shared**

```json
// packages/shared/package.json
{
  "name": "@meta-app/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/types/index.ts",
  "types": "./src/types/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 3: Criar tsconfig.json do shared**

```json
// packages/shared/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Criar enums.ts**

```typescript
// packages/shared/src/types/enums.ts
export enum PerfilUsuario {
  MASTER = 'master',
  GESTOR = 'gestor',
  AUDITOR = 'auditor',
}

export enum StatusUsuario {
  NAO_CONFIRMADO = 'nao_confirmado',
  ATIVO = 'ativo',
  INATIVO = 'inativo',
}

export enum StatusAuditoria {
  RASCUNHO = 'rascunho',
  EM_ANDAMENTO = 'em_andamento',
  FINALIZADA = 'finalizada',
  CANCELADA = 'cancelada',
}

export enum RespostaItem {
  CONFORME = 'conforme',
  NAO_CONFORME = 'nao_conforme',
  NAO_APLICAVEL = 'nao_aplicavel',
  NAO_AVALIADO = 'nao_avaliado',
}

export enum StatusRelatorioTecnico {
  RASCUNHO = 'rascunho',
  FINALIZADO = 'finalizado',
}

export enum StatusCheckin {
  ABERTO = 'aberto',
  FECHADO = 'fechado',
}

export enum SyncStatus {
  SYNCED = 'synced',
  PENDING = 'pending',
  CONFLICT = 'conflict',
}
```

- [ ] **Step 5: Criar usuario.ts**

```typescript
// packages/shared/src/types/usuario.ts
import { PerfilUsuario, StatusUsuario } from './enums';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  telefone?: string;
  status: StatusUsuario;
  gestorId?: string;
  tenantId?: string;
  logoUrl?: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface LoginResponse {
  accessToken: string;
  usuario: Usuario;
}
```

- [ ] **Step 6: Criar cliente.ts**

```typescript
// packages/shared/src/types/cliente.ts
export interface Cliente {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  email?: string;
  telefone: string;
  tipoAtividade: string;
  responsavelTecnico?: string;
  ativo: boolean;
  gestorId?: string;
  logoUrl?: string | null;
  unidades: Unidade[];
}

export interface Unidade {
  id: string;
  nome: string;
  endereco: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  latitude?: number;
  longitude?: number;
  raioGeofencing: number;
  responsavel: string;
  telefone?: string;
  email: string;
  whatsapp?: string;
  ativo: boolean;
  clienteId: string;
}
```

- [ ] **Step 7: Criar auditoria.ts**

```typescript
// packages/shared/src/types/auditoria.ts
import { StatusAuditoria, RespostaItem } from './enums';

export interface ResumoExecutivo {
  resumo: string;
  pontosFortes: string[];
  pontosFracos: string[];
  recomendacoesPrioritarias: string[];
  riscoGeral: 'baixo' | 'medio' | 'alto' | 'critico';
  tendencias: string[];
}

export interface Foto {
  id: string;
  url?: string;
  filePath?: string;
  tamanhoBytes?: number;
  analiseIa?: string;
  latitude?: number;
  longitude?: number;
}

export interface AuditoriaItem {
  id: string;
  resposta: RespostaItem;
  observacao?: string;
  descricaoNaoConformidade?: string;
  descricaoIa?: string;
  complementoDescricao?: string;
  planoAcaoSugerido?: string;
  planoAcaoFinal?: string;
  referenciaLegal?: string;
  pontuacao: number;
  fotos: Foto[];
  templateItemId: string;
}

export interface Auditoria {
  id: string;
  status: StatusAuditoria;
  dataInicio?: string;
  dataFim?: string;
  latitudeInicio?: number;
  longitudeInicio?: number;
  latitudeFim?: number;
  longitudeFim?: number;
  observacoesGerais?: string;
  pontuacaoTotal?: number;
  resumoExecutivo?: ResumoExecutivo;
  pdfUrl?: string;
  clienteId: string;
  unidadeId: string;
  templateId: string;
  itens: AuditoriaItem[];
}
```

- [ ] **Step 8: Criar relatorio-tecnico.ts**

```typescript
// packages/shared/src/types/relatorio-tecnico.ts
import { StatusRelatorioTecnico } from './enums';

export interface RelatorioTecnicoFoto {
  id: string;
  url?: string;
  filePath?: string;
  descricao?: string;
}

export interface RelatorioTecnico {
  id: string;
  clienteId: string;
  unidadeId?: string;
  consultoraId: string;
  identificacao: string;
  descricaoOcorrenciaHtml: string;
  avaliacaoTecnicaHtml: string;
  acoesExecutadas: string[];
  recomendacoesConsultoraHtml: string;
  planoAcaoSugeridoHtml: string;
  apoioAnaliticoChekAi?: string;
  status: StatusRelatorioTecnico;
  assinaturaNomeConsultora: string;
  responsavel?: string;
  fotos: RelatorioTecnicoFoto[];
}
```

- [ ] **Step 9: Criar index.ts**

```typescript
// packages/shared/src/types/index.ts
export * from './enums';
export * from './usuario';
export * from './cliente';
export * from './auditoria';
export * from './relatorio-tecnico';
```

- [ ] **Step 10: Verificar tipos com tsc**

```bash
cd packages/shared && npx tsc --noEmit
```
Expected: sem erros.

- [ ] **Step 11: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add shared TypeScript types package"
```

---

## Task 2: Expo project scaffold

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/eas.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/metro.config.js`
- Create: `apps/mobile/tailwind.config.js`
- Modify: `turbo.json`

- [ ] **Step 1: Inicializar projeto Expo**

```bash
cd apps/mobile
npx create-expo-app@latest . --template blank-typescript
```

Se o diretório não estiver vazio, criar manualmente com os arquivos abaixo.

- [ ] **Step 2: package.json do mobile**

```json
// apps/mobile/package.json
{
  "name": "@meta-app/mobile",
  "version": "0.1.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "test": "jest --watchAll=false",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@meta-app/shared": "*",
    "@react-native-community/netinfo": "^11.4.1",
    "@tanstack/react-query": "^5.62.0",
    "axios": "^1.7.9",
    "expo": "~52.0.0",
    "expo-background-fetch": "~12.0.1",
    "expo-file-system": "~18.0.6",
    "expo-font": "~13.0.1",
    "expo-google-fonts": "^0.2.3",
    "expo-image-picker": "~16.0.3",
    "expo-location": "~18.0.4",
    "expo-notifications": "~0.29.9",
    "expo-router": "~4.0.12",
    "expo-secure-store": "~14.0.0",
    "expo-splash-screen": "~0.29.18",
    "expo-sqlite": "~15.1.2",
    "expo-status-bar": "~2.0.0",
    "expo-task-manager": "~12.0.3",
    "lucide-react-native": "^0.460.0",
    "nativewind": "^4.1.23",
    "react-native-svg": "^15.8.0",
    "react": "18.3.1",
    "react-native": "0.76.5",
    "react-native-mmkv": "^3.1.0",
    "react-native-pell-rich-editor": "^1.8.9",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.1.0",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    "@babel/core": "^7.25.2",
    "@testing-library/react-native": "^12.9.0",
    "@types/react": "~18.3.12",
    "jest": "^29.7.0",
    "jest-expo": "~52.0.3",
    "react-test-renderer": "18.3.1",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.3.3"
  },
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterEnv": ["@testing-library/react-native/extend-expect"],
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
    ]
  }
}
```

- [ ] **Step 3: app.json**

```json
// apps/mobile/app.json
{
  "expo": {
    "name": "chekAI",
    "slug": "chekai",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#00B8A9"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.evobit.chekai",
      "infoPlist": {
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Para detectar automaticamente quando você chega em uma unidade cliente e registrar o check-in sem precisar abrir o app.",
        "NSLocationAlwaysUsageDescription": "Para detectar automaticamente quando você chega em uma unidade cliente e registrar o check-in sem precisar abrir o app.",
        "NSLocationWhenInUseUsageDescription": "Para registrar sua localização durante auditorias e check-ins.",
        "NSCameraUsageDescription": "Para registrar evidências fotográficas durante as auditorias.",
        "NSPhotoLibraryUsageDescription": "Para acessar fotos da galeria como evidências nas auditorias.",
        "UIBackgroundModes": ["location", "fetch"]
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#00B8A9"
      },
      "package": "com.evobit.chekai",
      "permissions": [
        "ACCESS_BACKGROUND_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA",
        "READ_MEDIA_IMAGES",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Para detectar automaticamente quando você chega em uma unidade cliente e registrar o check-in sem precisar abrir o app."
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#00B8A9"
        }
      ]
    ],
    "scheme": "chekai",
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 4: tsconfig.json**

```json
// apps/mobile/tsconfig.json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"],
      "@meta-app/shared": ["../../packages/shared/src/types/index.ts"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.d.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 5: babel.config.js**

```javascript
// apps/mobile/babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    ],
    plugins: ['nativewind/babel'],
  };
};
```

- [ ] **Step 6: metro.config.js**

```javascript
// apps/mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: watch packages/ directory
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './src/global.css' });
```

- [ ] **Step 7: tailwind.config.js (mesmo design system do web)**

```javascript
// apps/mobile/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#00B8A9',
        secondary: '#0891b2',
        accent: '#f59e0b',
        neutral: '#1B2A4A',
        'base-100': '#FFFFFF',
        'base-200': '#F4F7FA',
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
      },
      fontFamily: {
        sans: ['Inter_400Regular', 'System'],
        'sans-medium': ['Inter_500Medium', 'System'],
        'sans-semibold': ['Inter_600SemiBold', 'System'],
        display: ['Montserrat_700Bold', 'System'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 8: Criar src/global.css**

```bash
mkdir -p apps/mobile/src
```

```css
/* apps/mobile/src/global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 9: Criar assets placeholder**

```bash
mkdir -p apps/mobile/assets
# Copiar icon.png, splash.png, adaptive-icon.png do projeto web se existirem
# Ou criar placeholders de 1x1px para não bloquear o build
```

- [ ] **Step 10: Instalar dependências**

```bash
cd apps/mobile && npm install
```

Expected: sem erros de peer dependencies críticos.

- [ ] **Step 11: Verificar tipos**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 12: Commit**

```bash
git add apps/mobile/ packages/shared/
git commit -m "feat(mobile): scaffold Expo project with NativeWind and monorepo config"
```

---

## Task 3: Banco SQLite — client + migrations + schema v1

**Files:**
- Create: `apps/mobile/src/db/client.ts`
- Create: `apps/mobile/src/db/schema.ts`
- Create: `apps/mobile/src/db/migrations.ts`
- Create: `apps/mobile/src/db/__tests__/migrations.test.ts`

- [ ] **Step 1: Escrever teste de migrations**

```typescript
// apps/mobile/src/db/__tests__/migrations.test.ts
import { runMigrations, getSchemaVersion } from '../migrations';

// Mock expo-sqlite para testes
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => ({ user_version: 0 })),
    withTransactionSync: jest.fn((fn: () => void) => fn()),
  })),
}));

describe('runMigrations', () => {
  it('deve executar migration v1 em banco vazio', () => {
    const db = require('expo-sqlite').openDatabaseSync('test.db');
    db.getFirstSync.mockReturnValueOnce({ user_version: 0 });

    expect(() => runMigrations(db)).not.toThrow();
  });

  it('deve ser idempotente — re-executar não quebra', () => {
    const db = require('expo-sqlite').openDatabaseSync('test.db');
    db.getFirstSync.mockReturnValue({ user_version: 1 });

    expect(() => runMigrations(db)).not.toThrow();
    // execSync não deve ser chamado se já na versão correta
    expect(db.execSync).not.toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE')
    );
  });
});
```

- [ ] **Step 2: Rodar teste — verificar que falha**

```bash
cd apps/mobile && npx jest src/db/__tests__/migrations.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../migrations'`

- [ ] **Step 3: Criar schema.ts**

```typescript
// apps/mobile/src/db/schema.ts
export const SCHEMA_VERSION = 1;

export const SCHEMA_V1 = `
  -- Usuário logado (apenas 1 registro)
  CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    perfil TEXT NOT NULL,
    status TEXT NOT NULL,
    tenant_id TEXT,
    logo_url TEXT,
    updated_at TEXT NOT NULL
  );

  -- Dados de referência
  CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj TEXT,
    tipo_atividade TEXT,
    logo_url TEXT,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS unidades (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    nome TEXT NOT NULL,
    endereco TEXT,
    cidade TEXT,
    estado TEXT,
    latitude REAL,
    longitude REAL,
    raio_geofencing REAL NOT NULL DEFAULT 100,
    cliente_id TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  );

  CREATE TABLE IF NOT EXISTS checklist_templates (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    nome TEXT NOT NULL,
    descricao TEXT,
    tipo_atividade TEXT,
    versao TEXT NOT NULL DEFAULT '1.0',
    status TEXT NOT NULL DEFAULT 'ativo',
    sync_status TEXT NOT NULL DEFAULT 'synced',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS template_itens (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    template_id TEXT NOT NULL,
    descricao TEXT NOT NULL,
    ordem INTEGER NOT NULL,
    referencia_legal TEXT,
    pontuacao_maxima INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (template_id) REFERENCES checklist_templates(id)
  );

  -- Dados operacionais
  CREATE TABLE IF NOT EXISTS auditorias (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    local_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'rascunho',
    data_inicio TEXT,
    data_fim TEXT,
    latitude_inicio REAL,
    longitude_inicio REAL,
    latitude_fim REAL,
    longitude_fim REAL,
    observacoes_gerais TEXT,
    pontuacao_total REAL,
    resumo_executivo TEXT,
    pdf_url TEXT,
    cliente_id TEXT NOT NULL,
    unidade_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS auditoria_itens (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    auditoria_id TEXT NOT NULL,
    template_item_id TEXT NOT NULL,
    resposta TEXT NOT NULL DEFAULT 'nao_avaliado',
    observacao TEXT,
    descricao_nao_conformidade TEXT,
    descricao_ia TEXT,
    complemento_descricao TEXT,
    plano_acao_sugerido TEXT,
    plano_acao_final TEXT,
    referencia_legal TEXT,
    pontuacao INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (auditoria_id) REFERENCES auditorias(id)
  );

  CREATE TABLE IF NOT EXISTS fotos (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    auditoria_item_id TEXT NOT NULL,
    file_path TEXT,
    url TEXT,
    tamanho_bytes INTEGER,
    analise_ia TEXT,
    latitude REAL,
    longitude REAL,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (auditoria_item_id) REFERENCES auditoria_itens(id)
  );

  CREATE TABLE IF NOT EXISTS relatorios_tecnicos (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    local_id TEXT NOT NULL,
    cliente_id TEXT NOT NULL,
    unidade_id TEXT,
    identificacao TEXT NOT NULL,
    descricao_ocorrencia_html TEXT,
    avaliacao_tecnica_html TEXT,
    acoes_executadas TEXT,
    recomendacoes_html TEXT,
    plano_acao_html TEXT,
    apoio_analitico TEXT,
    status TEXT NOT NULL DEFAULT 'rascunho',
    assinatura_nome TEXT,
    responsavel TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS relatorio_fotos (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    relatorio_id TEXT NOT NULL,
    file_path TEXT,
    url TEXT,
    descricao TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (relatorio_id) REFERENCES relatorios_tecnicos(id)
  );

  CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    local_id TEXT NOT NULL,
    usuario_id TEXT NOT NULL,
    cliente_id TEXT NOT NULL,
    unidade_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberto',
    data_checkin TEXT NOT NULL,
    data_checkout TEXT,
    latitude_checkin REAL NOT NULL,
    longitude_checkin REAL NOT NULL,
    latitude_checkout REAL,
    longitude_checkout REAL,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    updated_at TEXT NOT NULL
  );

  -- Controle de sync
  CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL,
    file_path TEXT,
    retries INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_meta (
    entity TEXT PRIMARY KEY,
    last_synced_at TEXT NOT NULL
  );

  -- Índices para queries frequentes
  CREATE INDEX IF NOT EXISTS idx_auditorias_status ON auditorias(status);
  CREATE INDEX IF NOT EXISTS idx_auditorias_sync ON auditorias(sync_status);
  CREATE INDEX IF NOT EXISTS idx_auditoria_itens_auditoria ON auditoria_itens(auditoria_id);
  CREATE INDEX IF NOT EXISTS idx_fotos_item ON fotos(auditoria_item_id);
  CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity);
  CREATE INDEX IF NOT EXISTS idx_unidades_cliente ON unidades(cliente_id);
`;
```

- [ ] **Step 4: Criar client.ts**

```typescript
// apps/mobile/src/db/client.ts
import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync('chekai.db');
    runMigrations(_db);
  }
  return _db;
}
```

- [ ] **Step 5: Criar migrations.ts**

```typescript
// apps/mobile/src/db/migrations.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_V1, SCHEMA_VERSION } from './schema';

export function getSchemaVersion(db: SQLiteDatabase): number {
  const result = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  return result?.user_version ?? 0;
}

function setSchemaVersion(db: SQLiteDatabase, version: number): void {
  db.execSync(`PRAGMA user_version = ${version}`);
}

export function runMigrations(db: SQLiteDatabase): void {
  const currentVersion = getSchemaVersion(db);

  if (currentVersion >= SCHEMA_VERSION) {
    return; // Já na versão correta
  }

  db.withTransactionSync(() => {
    if (currentVersion < 1) {
      db.execSync(SCHEMA_V1);
      setSchemaVersion(db, 1);
    }
    // Adicionar migrations futuras aqui:
    // if (currentVersion < 2) { db.execSync(SCHEMA_V2); setSchemaVersion(db, 2); }
  });
}
```

- [ ] **Step 6: Rodar testes — verificar que passam**

```bash
cd apps/mobile && npx jest src/db/__tests__/migrations.test.ts --no-coverage
```
Expected: PASS (2 testes)

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/db/
git commit -m "feat(mobile/db): add SQLite client with versioned migrations schema v1"
```

---

## Task 4: API HTTP client (mobile)

**Files:**
- Create: `apps/mobile/src/api/client.ts`

- [ ] **Step 1: Criar client.ts**

```typescript
// apps/mobile/src/api/client.ts
import axios, { AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Adiciona token JWT em todas as requisições
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normaliza respostas da API (formato: { data: { ... } })
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string | string[] }>) => {
    const data = error.response?.data;
    let message = 'Erro inesperado. Tente novamente.';

    if (data?.message) {
      message = Array.isArray(data.message) ? data.message[0] : data.message;
    }

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      message = 'Tempo de conexão expirado.';
    } else if (!error.response) {
      message = 'Sem conexão com o servidor.';
    }

    return Promise.reject(new Error(message));
  }
);

// Helper para desembrulhar o wrapper { data: T }
export async function apiGet<T>(url: string): Promise<T> {
  const response = await apiClient.get<{ data: T }>(url);
  return response.data.data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const response = await apiClient.post<{ data: T }>(url, body);
  return response.data.data;
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  const response = await apiClient.put<{ data: T }>(url, body);
  return response.data.data;
}

export async function apiDelete(url: string): Promise<void> {
  await apiClient.delete(url);
}
```

- [ ] **Step 2: Criar .env.local para desenvolvimento**

```bash
# apps/mobile/.env.local
EXPO_PUBLIC_API_URL=http://localhost:3001/api
```

**IMPORTANTE:** Nunca commitar `.env.local`. Verificar que está no `.gitignore`.

- [ ] **Step 3: Criar apps/mobile/.gitignore**

```
# Expo
.expo/
dist/
web-build/
expo-env.d.ts

# Dependencies
node_modules/

# Build
*.orig.*
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*

# Environment
.env.local
.env.*.local

# Logs
npm-debug.*
yarn-debug.*
yarn-error.*

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/api/
git commit -m "feat(mobile/api): add axios client with token interceptor and response unwrapper"
```

---

## Task 5: Auth — TokenStorage + AuthService

**Files:**
- Create: `apps/mobile/src/auth/TokenStorage.ts`
- Create: `apps/mobile/src/auth/AuthService.ts`
- Create: `apps/mobile/src/auth/__tests__/TokenStorage.test.ts`
- Create: `apps/mobile/src/auth/__tests__/AuthService.test.ts`

- [ ] **Step 1: Escrever testes de TokenStorage**

```typescript
// apps/mobile/src/auth/__tests__/TokenStorage.test.ts
import { TokenStorage } from '../TokenStorage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const SecureStore = require('expo-secure-store');

describe('TokenStorage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve salvar token de acesso', async () => {
    await TokenStorage.setAccessToken('my-token');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'my-token');
  });

  it('deve recuperar token de acesso', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce('my-token');
    const token = await TokenStorage.getAccessToken();
    expect(token).toBe('my-token');
  });

  it('deve retornar null quando token não existe', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce(null);
    const token = await TokenStorage.getAccessToken();
    expect(token).toBeNull();
  });

  it('deve limpar todos os tokens no logout', async () => {
    await TokenStorage.clear();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_user');
  });
});
```

- [ ] **Step 2: Rodar teste — verificar que falha**

```bash
cd apps/mobile && npx jest src/auth/__tests__/TokenStorage.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../TokenStorage'`

- [ ] **Step 3: Implementar TokenStorage.ts**

```typescript
// apps/mobile/src/auth/TokenStorage.ts
import * as SecureStore from 'expo-secure-store';
import type { Usuario } from '@meta-app/shared';

const KEYS = {
  ACCESS_TOKEN: 'auth_token',
  USER: 'auth_user',
} as const;

export const TokenStorage = {
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
  },

  async setAccessToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, token);
  },

  async getUser(): Promise<Usuario | null> {
    const raw = await SecureStore.getItemAsync(KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Usuario;
    } catch {
      return null;
    }
  },

  async setUser(user: Usuario): Promise<void> {
    await SecureStore.setItemAsync(KEYS.USER, JSON.stringify(user));
  },

  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(KEYS.USER),
    ]);
  },
};
```

- [ ] **Step 4: Rodar teste TokenStorage — verificar PASS**

```bash
cd apps/mobile && npx jest src/auth/__tests__/TokenStorage.test.ts --no-coverage
```
Expected: PASS (4 testes)

- [ ] **Step 5: Escrever testes de AuthService**

```typescript
// apps/mobile/src/auth/__tests__/AuthService.test.ts
import { AuthService } from '../AuthService';

jest.mock('../../api/client', () => ({
  apiPost: jest.fn(),
}));

jest.mock('../TokenStorage', () => ({
  TokenStorage: {
    setAccessToken: jest.fn(),
    setUser: jest.fn(),
    clear: jest.fn(),
  },
}));

const { apiPost } = require('../../api/client');
const { TokenStorage } = require('../TokenStorage');

describe('AuthService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve solicitar OTP com email', async () => {
    apiPost.mockResolvedValueOnce({ message: 'OTP enviado' });
    await AuthService.solicitarOtp('test@test.com');
    expect(apiPost).toHaveBeenCalledWith('/auth/solicitar-otp', { email: 'test@test.com' });
  });

  it('deve validar OTP e salvar token', async () => {
    const mockResponse = {
      accessToken: 'jwt-token',
      usuario: { id: '1', nome: 'Test', email: 'test@test.com', perfil: 'auditor' },
    };
    apiPost.mockResolvedValueOnce(mockResponse);

    const result = await AuthService.validarOtp('test@test.com', '123456');

    expect(TokenStorage.setAccessToken).toHaveBeenCalledWith('jwt-token');
    expect(TokenStorage.setUser).toHaveBeenCalledWith(mockResponse.usuario);
    expect(result).toEqual(mockResponse);
  });

  it('deve limpar tokens no logout', async () => {
    await AuthService.logout();
    expect(TokenStorage.clear).toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Implementar AuthService.ts**

```typescript
// apps/mobile/src/auth/AuthService.ts
import { apiPost } from '../api/client';
import { TokenStorage } from './TokenStorage';
import type { LoginResponse } from '@meta-app/shared';

export const AuthService = {
  async solicitarOtp(email: string): Promise<{ message: string }> {
    return apiPost<{ message: string }>('/auth/solicitar-otp', { email });
  },

  async validarOtp(email: string, codigo: string): Promise<LoginResponse> {
    const response = await apiPost<LoginResponse>('/auth/validar-otp', { email, codigo });
    await TokenStorage.setAccessToken(response.accessToken);
    await TokenStorage.setUser(response.usuario);
    return response;
  },

  async logout(): Promise<void> {
    await TokenStorage.clear();
  },
};
```

- [ ] **Step 7: Rodar todos os testes de auth**

```bash
cd apps/mobile && npx jest src/auth/ --no-coverage
```
Expected: PASS (7 testes)

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/auth/
git commit -m "feat(mobile/auth): add TokenStorage (secure-store) and AuthService (OTP)"
```

---

## Task 6: Zustand auth store

**Files:**
- Create: `apps/mobile/src/store/auth.ts`

- [ ] **Step 1: Criar auth store**

```typescript
// apps/mobile/src/store/auth.ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import type { Usuario } from '@meta-app/shared';

const storage = new MMKV({ id: 'auth-store' });

// Adapter Zustand <-> MMKV
const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

interface AuthState {
  user: Usuario | null;
  isAuthenticated: boolean;
  onboardingCompleted: boolean;
  _hasHydrated: boolean;
  setUser: (user: Usuario | null) => void;
  setOnboardingCompleted: () => void;
  setHasHydrated: (value: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      onboardingCompleted: false,
      _hasHydrated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setOnboardingCompleted: () => set({ onboardingCompleted: true }),

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      // onboardingCompleted é device-level (não reseta no logout)
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-state',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        onboardingCompleted: state.onboardingCompleted,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/store/
git commit -m "feat(mobile/store): add Zustand auth store with MMKV persistence"
```

---

## Task 7: Navegação scaffold (Expo Router)

**Files:**
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/+not-found.tsx`
- Create: `apps/mobile/app/(auth)/_layout.tsx`
- Create: `apps/mobile/app/(auth)/login.tsx` (stub — implementado na Task 8)
- Create: `apps/mobile/app/(app)/_layout.tsx`
- Create: `apps/mobile/app/(app)/index.tsx` (Dashboard stub)

- [ ] **Step 1: Root _layout.tsx**

```typescript
// apps/mobile/app/_layout.tsx
import { useEffect } from 'react';
import { SplashScreen, Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import '../src/global.css';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      staleTime: 1000 * 60 * 5, // 5 minutos
      retry: 2,
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Montserrat_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: (auth)/_layout.tsx**

```typescript
// apps/mobile/app/(auth)/_layout.tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 3: (app)/_layout.tsx com proteção de rota**

```typescript
// apps/mobile/app/(app)/_layout.tsx
import { Redirect, Tabs } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../../src/store/auth';
import { Home, ClipboardList, FileText, User } from 'lucide-react-native';

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  // Aguardar hidratação do store antes de redirecionar
  // (evita race condition no primeiro acesso)
  if (!hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-base-200">
        <ActivityIndicator color="#00B8A9" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#00B8A9',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#E5E7EB' },
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="auditorias"
        options={{
          title: 'Auditorias',
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="relatorios"
        options={{
          title: 'Relatórios',
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      {/* Onboarding: ocultar da tab bar e renderizar sem header */}
      <Tabs.Screen
        name="onboarding"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 4: Dashboard stub**

```typescript
// apps/mobile/app/(app)/index.tsx
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  return (
    <SafeAreaView className="flex-1 bg-base-200">
      <View className="flex-1 items-center justify-center">
        <Text className="font-display text-2xl text-neutral">chekAI</Text>
        <Text className="font-sans text-gray-500 mt-2">Dashboard — em breve</Text>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 5: Stub tabs restantes (para não quebrar o router)**

```typescript
// apps/mobile/app/(app)/auditorias.tsx
import { View, Text } from 'react-native';
export default function AuditoriasScreen() {
  return <View className="flex-1 items-center justify-center"><Text>Auditorias — Plano 2</Text></View>;
}
```

```typescript
// apps/mobile/app/(app)/relatorios.tsx
import { View, Text } from 'react-native';
export default function RelatoriosScreen() {
  return <View className="flex-1 items-center justify-center"><Text>Relatórios — Plano 3</Text></View>;
}
```

```typescript
// apps/mobile/app/(app)/perfil.tsx
import { View, Text, Pressable } from 'react-native';
import { useAuthStore } from '../../src/store/auth';
import { AuthService } from '../../src/auth/AuthService';
import { router } from 'expo-router';

export default function PerfilScreen() {
  const { user, logout } = useAuthStore();

  async function handleLogout() {
    await AuthService.logout();
    logout();
    router.replace('/(auth)/login');
  }

  return (
    <View className="flex-1 items-center justify-center gap-4">
      <Text className="font-sans-semibold text-neutral">{user?.nome ?? 'Usuário'}</Text>
      <Pressable onPress={handleLogout} className="bg-error px-6 py-3 rounded-lg">
        <Text className="text-white font-sans-medium">Sair</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 6: +not-found.tsx**

```typescript
// apps/mobile/app/+not-found.tsx
import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Página não encontrada' }} />
      <View className="flex-1 items-center justify-center">
        <Text className="font-display text-xl text-neutral">Tela não encontrada</Text>
        <Link href="/(app)" className="mt-4">
          <Text className="text-primary font-sans-medium">Voltar ao início</Text>
        </Link>
      </View>
    </>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/app/
git commit -m "feat(mobile/nav): add Expo Router scaffold with auth guard and tab navigation"
```

---

## Task 8: Tela de Login (OTP)

**Files:**
- Create: `apps/mobile/app/(auth)/login.tsx`

- [ ] **Step 1: Implementar tela de login com dois passos**

```typescript
// apps/mobile/app/(auth)/login.tsx
import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AuthService } from '../../src/auth/AuthService';
import { useAuthStore } from '../../src/store/auth';

type Step = 'email' | 'codigo';

export default function LoginScreen() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted);

  async function handleSolicitarOtp() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await AuthService.solicitarOtp(email.trim().toLowerCase());
      setStep('codigo');
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro ao enviar código.');
    } finally {
      setLoading(false);
    }
  }

  async function handleValidarOtp() {
    if (codigo.length !== 6) return;
    setLoading(true);
    try {
      const response = await AuthService.validarOtp(email.trim().toLowerCase(), codigo);
      setUser(response.usuario);
      if (onboardingCompleted) {
        router.replace('/(app)');
      } else {
        router.replace('/(app)/onboarding');
      }
    } catch (error) {
      Alert.alert('Código inválido', error instanceof Error ? error.message : 'Código incorreto ou expirado.');
      setCodigo('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-6 justify-center">
          {/* Logo / título */}
          <View className="items-center mb-12">
            <Text className="font-display text-4xl text-primary">chekAI</Text>
            <Text className="font-sans text-gray-500 mt-2">Auditoria Alimentar</Text>
          </View>

          {step === 'email' ? (
            <View className="gap-4">
              <Text className="font-sans-semibold text-neutral text-lg">Entrar</Text>
              <Text className="font-sans text-gray-500">
                Digite seu e-mail para receber o código de acesso.
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3.5 font-sans text-neutral text-base"
                placeholder="seu@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={handleSolicitarOtp}
                returnKeyType="send"
              />
              <Pressable
                onPress={handleSolicitarOtp}
                disabled={!email.trim() || loading}
                className="bg-primary rounded-xl py-4 items-center disabled:opacity-50"
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-sans-semibold text-base">Enviar código</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View className="gap-4">
              <Text className="font-sans-semibold text-neutral text-lg">Código de acesso</Text>
              <Text className="font-sans text-gray-500">
                Enviamos um código de 6 dígitos para{'\n'}
                <Text className="text-neutral font-sans-medium">{email}</Text>
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3.5 font-sans text-neutral text-2xl text-center tracking-widest"
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                value={codigo}
                onChangeText={setCodigo}
                onSubmitEditing={handleValidarOtp}
                returnKeyType="done"
                autoFocus
              />
              <Pressable
                onPress={handleValidarOtp}
                disabled={codigo.length !== 6 || loading}
                className="bg-primary rounded-xl py-4 items-center disabled:opacity-50"
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-sans-semibold text-base">Entrar</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => { setStep('email'); setCodigo(''); }}
                className="items-center py-2"
              >
                <Text className="text-primary font-sans-medium">Usar outro e-mail</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(auth)/login.tsx
git commit -m "feat(mobile/auth): add OTP login screen (email + 6-digit code steps)"
```

---

## Task 9: Sync queue (MMKV)

**Files:**
- Create: `apps/mobile/src/sync/SyncQueue.ts`
- Create: `apps/mobile/src/sync/__tests__/SyncQueue.test.ts`

- [ ] **Step 1: Escrever testes**

```typescript
// apps/mobile/src/sync/__tests__/SyncQueue.test.ts
import { SyncQueue } from '../SyncQueue';

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => {
    const store: Record<string, string> = {};
    return {
      getString: (key: string) => store[key],
      set: (key: string, value: string) => { store[key] = value; },
      delete: (key: string) => { delete store[key]; },
      getAllKeys: () => Object.keys(store),
    };
  }),
}));

describe('SyncQueue', () => {
  let queue: SyncQueue;

  beforeEach(() => {
    queue = new SyncQueue();
  });

  it('deve enfileirar uma operação', () => {
    queue.enqueue({ entity: 'auditoria', operation: 'create', payload: { id: '1' } });
    expect(queue.size()).toBe(1);
  });

  it('deve retornar operações em ordem FIFO', () => {
    queue.enqueue({ entity: 'auditoria', operation: 'create', payload: { id: '1' } });
    queue.enqueue({ entity: 'auditoria_item', operation: 'update', payload: { id: '2' } });

    const items = queue.getAll();
    expect(items[0].entity).toBe('auditoria');
    expect(items[1].entity).toBe('auditoria_item');
  });

  it('deve remover operação da fila', () => {
    queue.enqueue({ entity: 'auditoria', operation: 'create', payload: { id: '1' } });
    const items = queue.getAll();
    queue.remove(items[0].id);
    expect(queue.size()).toBe(0);
  });

  it('deve incrementar retries', () => {
    queue.enqueue({ entity: 'foto', operation: 'create', payload: { id: '1' }, filePath: '/local/foto.jpg' });
    const [item] = queue.getAll();
    queue.incrementRetries(item.id);
    const [updated] = queue.getAll();
    expect(updated.retries).toBe(1);
  });

  it('deve retornar itens com mais de N retries', () => {
    queue.enqueue({ entity: 'foto', operation: 'create', payload: { id: '1' } });
    const [item] = queue.getAll();
    queue.incrementRetries(item.id);
    queue.incrementRetries(item.id);
    queue.incrementRetries(item.id);
    queue.incrementRetries(item.id);
    queue.incrementRetries(item.id);

    const conflicts = queue.getConflicts(5);
    expect(conflicts).toHaveLength(1);
  });
});
```

**Nota:** a linha `const conflicts = queue.getConflicts(maxRetries: 5)` tem erro de sintaxe intencional — corrija para:
```typescript
const conflicts = queue.getConflicts(5);
```

- [ ] **Step 2: Rodar teste — verificar FAIL**

```bash
cd apps/mobile && npx jest src/sync/__tests__/SyncQueue.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../SyncQueue'`

- [ ] **Step 3: Implementar SyncQueue.ts**

```typescript
// apps/mobile/src/sync/SyncQueue.ts
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'sync-queue' });
const QUEUE_KEY = 'queue_items';

export interface SyncQueueItem {
  id: string;
  entity: string;
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  filePath?: string;
  retries: number;
  createdAt: string;
}

export type EnqueueInput = Omit<SyncQueueItem, 'id' | 'retries' | 'createdAt'>;

export class SyncQueue {
  private getItems(): SyncQueueItem[] {
    const raw = storage.getString(QUEUE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as SyncQueueItem[];
    } catch {
      return [];
    }
  }

  private saveItems(items: SyncQueueItem[]): void {
    storage.set(QUEUE_KEY, JSON.stringify(items));
  }

  enqueue(input: EnqueueInput): SyncQueueItem {
    const item: SyncQueueItem = {
      ...input,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      retries: 0,
      createdAt: new Date().toISOString(),
    };
    const items = this.getItems();
    items.push(item);
    this.saveItems(items);
    return item;
  }

  getAll(): SyncQueueItem[] {
    return this.getItems();
  }

  remove(id: string): void {
    const items = this.getItems().filter((i) => i.id !== id);
    this.saveItems(items);
  }

  incrementRetries(id: string): void {
    const items = this.getItems().map((i) =>
      i.id === id ? { ...i, retries: i.retries + 1 } : i
    );
    this.saveItems(items);
  }

  getConflicts(maxRetries: number): SyncQueueItem[] {
    return this.getItems().filter((i) => i.retries >= maxRetries);
  }

  size(): number {
    return this.getItems().length;
  }

  clear(): void {
    storage.delete(QUEUE_KEY);
  }
}

// Singleton exportado
export const syncQueue = new SyncQueue();
```

- [ ] **Step 4: Rodar testes — verificar PASS**

```bash
cd apps/mobile && npx jest src/sync/__tests__/SyncQueue.test.ts --no-coverage
```
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/sync/SyncQueue.ts apps/mobile/src/sync/__tests__/
git commit -m "feat(mobile/sync): add MMKV-backed SyncQueue with retry tracking"
```

---

## Task 10: SyncService skeleton + pull de referência

**Files:**
- Create: `apps/mobile/src/sync/pull.ts`
- Create: `apps/mobile/src/sync/SyncService.ts`

- [ ] **Step 1: Criar pull.ts**

```typescript
// apps/mobile/src/sync/pull.ts
import * as SQLite from 'expo-sqlite';
import { getDatabase } from '../db/client';
import { apiGet } from '../api/client';
import type { Cliente } from '@meta-app/shared';

// Singleton contrato: getDatabase() sempre retorna a mesma instância.
// Passamos `db` explicitamente para evitar divergência entre chamadas.
function getLastSyncedAt(db: SQLite.SQLiteDatabase, entity: string): string {
  const row = db.getFirstSync<{ last_synced_at: string }>(
    'SELECT last_synced_at FROM sync_meta WHERE entity = ?',
    [entity]
  );
  // Padrão: 90 dias atrás para primeira sync
  return row?.last_synced_at ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
}

function setLastSyncedAt(db: SQLite.SQLiteDatabase, entity: string, timestamp: string): void {
  db.runSync(
    `INSERT OR REPLACE INTO sync_meta (entity, last_synced_at) VALUES (?, ?)`,
    [entity, timestamp]
  );
}

export async function pullClientes(): Promise<void> {
  const db = getDatabase();
  const since = getLastSyncedAt(db, 'clientes');
  const clientes = await apiGet<Cliente[]>(`/clientes?updatedSince=${since}`);
  const now = new Date().toISOString();

  db.withTransactionSync(() => {
    for (const c of clientes) {
      db.runSync(
        `INSERT OR REPLACE INTO clientes
         (id, remote_id, razao_social, nome_fantasia, cnpj, tipo_atividade, logo_url, sync_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
        [c.id, c.id, c.razaoSocial, c.nomeFantasia ?? null, c.cnpj, c.tipoAtividade, c.logoUrl ?? null, now]
      );

      for (const u of c.unidades ?? []) {
        db.runSync(
          `INSERT OR REPLACE INTO unidades
           (id, remote_id, nome, endereco, cidade, estado, latitude, longitude, raio_geofencing, cliente_id, sync_status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
          [u.id, u.id, u.nome, u.endereco, u.cidade ?? null, u.estado ?? null,
           u.latitude ?? null, u.longitude ?? null, u.raioGeofencing, c.id, now]
        );
      }
    }
  });

  setLastSyncedAt(db, 'clientes', now);
}

export async function pullTemplates(): Promise<void> {
  const db = getDatabase();
  const since = getLastSyncedAt(db, 'templates');
  const templates = await apiGet<Array<{
    id: string; nome: string; descricao?: string; tipoAtividade: string;
    versao: string; status: string; itens: Array<{
      id: string; descricao: string; ordem: number;
      referenciaLegal?: string; pontuacaoMaxima: number;
    }>;
  }>>(`/checklist/templates?updatedSince=${since}`);

  const now = new Date().toISOString();

  db.withTransactionSync(() => {
    for (const t of templates) {
      db.runSync(
        `INSERT OR REPLACE INTO checklist_templates
         (id, remote_id, nome, descricao, tipo_atividade, versao, status, sync_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
        [t.id, t.id, t.nome, t.descricao ?? null, t.tipoAtividade, t.versao, t.status, now]
      );

      for (const item of t.itens ?? []) {
        db.runSync(
          `INSERT OR REPLACE INTO template_itens
           (id, remote_id, template_id, descricao, ordem, referencia_legal, pontuacao_maxima, sync_status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
          [item.id, item.id, t.id, item.descricao, item.ordem,
           item.referenciaLegal ?? null, item.pontuacaoMaxima, now]
        );
      }
    }
  });

  setLastSyncedAt(db, 'templates', now);
}

export async function pullAll(): Promise<void> {
  await pullClientes();
  await pullTemplates();
  // pullAuditorias e pullRelatorios serão adicionados nos Planos 2 e 3
}
```

- [ ] **Step 2: Criar SyncService.ts**

```typescript
// apps/mobile/src/sync/SyncService.ts
import NetInfo from '@react-native-community/netinfo';
import { pullAll } from './pull';

let _syncInProgress = false;

export const SyncService = {
  async sync(): Promise<void> {
    if (_syncInProgress) return;

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return;

    _syncInProgress = true;
    try {
      await pullAll();
      // push será adicionado no Plano 2
    } catch (error) {
      console.error('[SyncService] Erro no sync:', error);
    } finally {
      _syncInProgress = false;
    }
  },

  isOnline(): Promise<boolean> {
    return NetInfo.fetch().then((s) => !!s.isConnected);
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/sync/
git commit -m "feat(mobile/sync): add SyncService skeleton and pull for clientes/templates"
```

---

## Task 11: OfflineBanner component

**Files:**
- Create: `apps/mobile/src/components/OfflineBanner.tsx`

- [ ] **Step 1: Criar OfflineBanner**

```typescript
// apps/mobile/src/components/OfflineBanner.tsx
import { useEffect, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import { syncQueue } from '../sync/SyncQueue';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const opacity = new Animated.Value(0);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !state.isConnected;
      setIsOffline(offline);
      if (offline) {
        setPendingCount(syncQueue.size());
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      } else {
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      }
    });
    return unsubscribe;
  }, []);

  if (!isOffline) return null;

  return (
    <Animated.View style={{ opacity }}>
      <View className="bg-neutral px-4 py-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <WifiOff size={14} color="white" />
          <Text className="text-white font-sans text-sm">Modo offline</Text>
        </View>
        {pendingCount > 0 && (
          <View className="flex-row items-center gap-1">
            <RefreshCw size={12} color="#9CA3AF" />
            <Text className="text-gray-400 font-sans text-xs">{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}
```

- [ ] **Step 2: Adicionar OfflineBanner ao (app)/_layout.tsx**

Editar `apps/mobile/app/(app)/_layout.tsx` para envolver o Tabs com SafeAreaView e o banner:

```typescript
// Adicionar imports:
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OfflineBanner } from '../../src/components/OfflineBanner';

// Envolver o retorno:
return (
  <SafeAreaView className="flex-1 bg-white" edges={['top']}>
    <OfflineBanner />
    <Tabs ...>
      ...
    </Tabs>
  </SafeAreaView>
);
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/OfflineBanner.tsx apps/mobile/app/(app)/_layout.tsx
git commit -m "feat(mobile/ui): add OfflineBanner with pending sync count"
```

---

## Task 12: Onboarding de permissões

**Files:**
- Create: `apps/mobile/src/components/onboarding/PermissionStep.tsx`
- Create: `apps/mobile/src/components/onboarding/PermissionOnboarding.tsx`
- Create: `apps/mobile/app/(app)/onboarding.tsx`
- Create: `apps/mobile/src/components/onboarding/__tests__/PermissionOnboarding.test.tsx`

- [ ] **Step 1: Escrever teste**

```typescript
// apps/mobile/src/components/onboarding/__tests__/PermissionOnboarding.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { PermissionOnboarding } from '../PermissionOnboarding';

jest.mock('expo-location', () => ({ requestBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }) }));
jest.mock('expo-image-picker', () => ({ requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }) }));
jest.mock('expo-notifications', () => ({ requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }) }));

describe('PermissionOnboarding', () => {
  it('deve exibir primeiro passo de localização', () => {
    const { getByText } = render(<PermissionOnboarding onComplete={jest.fn()} />);
    expect(getByText(/localização/i)).toBeTruthy();
  });

  it('deve avançar para próximo passo ao permitir', async () => {
    const { getByText } = render(<PermissionOnboarding onComplete={jest.fn()} />);
    fireEvent.press(getByText('Permitir'));
    // Aguarda avanço assíncrono
    await new Promise(r => setTimeout(r, 0));
    expect(getByText(/câmera/i)).toBeTruthy();
  });

  it('deve chamar onComplete ao finalizar', async () => {
    const onComplete = jest.fn();
    const { getByText } = render(<PermissionOnboarding onComplete={onComplete} />);

    // Simula 3 telas de permissão + tela final
    for (let i = 0; i < 3; i++) {
      fireEvent.press(getByText('Permitir'));
      await new Promise(r => setTimeout(r, 0));
    }
    fireEvent.press(getByText('Começar'));
    expect(onComplete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar teste — verificar FAIL**

```bash
cd apps/mobile && npx jest src/components/onboarding/__tests__/ --no-coverage
```
Expected: FAIL

- [ ] **Step 3: Implementar PermissionStep.tsx**

```typescript
// apps/mobile/src/components/onboarding/PermissionStep.tsx
import { View, Text, Pressable } from 'react-native';
import { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  description: string;
  benefit: string;
  onAllow: () => void;
  onSkip?: () => void;
  allowLabel?: string;
}

export function PermissionStep({ icon, title, description, benefit, onAllow, onSkip, allowLabel = 'Permitir' }: Props) {
  return (
    <View className="flex-1 px-8 justify-center gap-6">
      <View className="items-center">{icon}</View>
      <View className="gap-2">
        <Text className="font-display text-2xl text-neutral text-center">{title}</Text>
        <Text className="font-sans text-gray-500 text-center leading-6">{description}</Text>
        <View className="bg-primary/10 rounded-xl p-4 mt-2">
          <Text className="font-sans-medium text-primary text-center text-sm">{benefit}</Text>
        </View>
      </View>
      <View className="gap-3 mt-4">
        <Pressable onPress={onAllow} className="bg-primary rounded-xl py-4 items-center">
          <Text className="text-white font-sans-semibold text-base">{allowLabel}</Text>
        </Pressable>
        {onSkip && (
          <Pressable onPress={onSkip} className="items-center py-2">
            <Text className="text-gray-400 font-sans text-sm">Agora não</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Implementar PermissionOnboarding.tsx**

```typescript
// apps/mobile/src/components/onboarding/PermissionOnboarding.tsx
import { useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { MapPin, Camera, Bell, CheckCircle } from 'lucide-react-native';
import { PermissionStep } from './PermissionStep';

type StepId = 'location' | 'camera' | 'notifications' | 'done';

const STEPS: StepId[] = ['location', 'camera', 'notifications', 'done'];

interface Props {
  onComplete: () => void;
}

export function PermissionOnboarding({ onComplete }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [granted, setGranted] = useState<Record<string, boolean>>({});

  const currentStep = STEPS[stepIndex];
  const advance = () => setStepIndex((i) => i + 1);

  async function handleLocation() {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    setGranted((g) => ({ ...g, location: status === 'granted' }));
    advance();
  }

  async function handleCamera() {
    // Solicitar câmera E galeria separadamente (ambos necessários)
    const [cameraResult, libraryResult] = await Promise.all([
      ImagePicker.requestCameraPermissionsAsync(),
      ImagePicker.requestMediaLibraryPermissionsAsync(),
    ]);
    const granted = cameraResult.status === 'granted' || libraryResult.status === 'granted';
    setGranted((g) => ({ ...g, camera: granted }));
    advance();
  }

  async function handleNotifications() {
    const { status } = await Notifications.requestPermissionsAsync();
    setGranted((g) => ({ ...g, notifications: status === 'granted' }));
    advance();
  }

  const allDenied = !granted.location && !granted.camera && !granted.notifications;

  if (currentStep === 'location') {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
          <View className="h-1 bg-primary" style={{ width: '25%' }} />
        </View>
        <PermissionStep
          icon={<MapPin size={64} color="#00B8A9" />}
          title="Localização"
          description="Precisamos de acesso à sua localização, mesmo com o app fechado."
          benefit="Detectamos automaticamente quando você chega em uma unidade cliente e fazemos o check-in sem você precisar abrir o app."
          onAllow={handleLocation}
          onSkip={advance}
        />
      </SafeAreaView>
    );
  }

  if (currentStep === 'camera') {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
          <View className="h-1 bg-primary" style={{ width: '50%' }} />
        </View>
        <PermissionStep
          icon={<Camera size={64} color="#00B8A9" />}
          title="Câmera e Fotos"
          description="Precisamos de acesso à câmera e galeria de fotos."
          benefit="Registre evidências fotográficas durante as auditorias diretamente pelo app."
          onAllow={handleCamera}
          onSkip={advance}
        />
      </SafeAreaView>
    );
  }

  if (currentStep === 'notifications') {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
          <View className="h-1 bg-primary" style={{ width: '75%' }} />
        </View>
        <PermissionStep
          icon={<Bell size={64} color="#00B8A9" />}
          title="Notificações"
          description="Enviaremos alertas importantes sobre suas auditorias."
          benefit="Seja avisado sobre check-ins detectados, sincronização concluída e análises de IA disponíveis."
          onAllow={handleNotifications}
          onSkip={advance}
        />
      </SafeAreaView>
    );
  }

  // Tela final
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="absolute top-0 left-0 right-0 h-1 bg-primary" />
      <View className="flex-1 px-8 justify-center gap-6">
        <View className="items-center">
          <CheckCircle size={72} color="#00B8A9" />
        </View>
        <View className="gap-2">
          <Text className="font-display text-2xl text-neutral text-center">Tudo pronto!</Text>
          {allDenied && (
            <View className="bg-warning/10 rounded-xl p-4 mt-2">
              <Text className="font-sans text-warning text-center text-sm">
                Algumas funcionalidades estão limitadas. Você pode ajustar as permissões nas configurações do celular a qualquer momento.
              </Text>
            </View>
          )}
        </View>
        <View className="gap-3 mt-4">
          <Pressable onPress={onComplete} className="bg-primary rounded-xl py-4 items-center">
            <Text className="text-white font-sans-semibold text-base">Começar</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openSettings()} className="items-center py-2">
            <Text className="text-primary font-sans-medium text-sm">Ajustar permissões</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 5: Criar tela de onboarding**

```typescript
// apps/mobile/app/(app)/onboarding.tsx
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/auth';
import { PermissionOnboarding } from '../../src/components/onboarding/PermissionOnboarding';

export default function OnboardingScreen() {
  const setOnboardingCompleted = useAuthStore((s) => s.setOnboardingCompleted);

  function handleComplete() {
    setOnboardingCompleted();
    router.replace('/(app)');
  }

  return <PermissionOnboarding onComplete={handleComplete} />;
}
```

- [ ] **Step 6: Rodar testes de onboarding**

```bash
cd apps/mobile && npx jest src/components/onboarding/__tests__/ --no-coverage
```
Expected: PASS (3 testes)

- [ ] **Step 7: Rodar todos os testes**

```bash
cd apps/mobile && npx jest --no-coverage
```
Expected: PASS (todos os testes das Tasks 3–12)

- [ ] **Step 8: Commit final**

```bash
git add apps/mobile/src/components/onboarding/ apps/mobile/app/(app)/onboarding.tsx
git commit -m "feat(mobile/onboarding): add permission onboarding flow with degraded-state handling"
```

---

## Task 13: Verificação final e smoke test

- [ ] **Step 1: Verificar tipos em todo o projeto mobile**

```bash
cd apps/mobile && npx tsc --noEmit
```
Expected: 0 erros

- [ ] **Step 2: Rodar suite completa de testes**

```bash
cd apps/mobile && npx jest --no-coverage --verbose
```
Expected: todos PASS

- [ ] **Step 3: Verificar que o app compila (Expo)**

```bash
cd apps/mobile && npx expo export --platform ios --dev 2>&1 | tail -5
```
Expected: `Export was successful` ou equivalente (não quebra em erros de compilação)

- [ ] **Step 4: Commit de cierre**

```bash
git add .
git commit -m "feat(mobile): complete foundation - auth, DB, sync queue, navigation, onboarding"
```

---

## Notas para o Plano 2

O Plano 2 (Auditorias) vai:
1. Adicionar `pullAuditorias()` em `src/sync/pull.ts`
2. Implementar `src/sync/push.ts` com lógica de envio da `sync_queue`
3. Criar repositórios SQLite para `auditorias` e `auditoria_itens`
4. Implementar as telas de auditoria: lista, nova, checklist, item, resumo
5. Adicionar câmera + upload de fotos com fila offline

O banco SQLite e o schema já estão prontos — o Plano 2 só adiciona a camada de acesso de dados por cima.
