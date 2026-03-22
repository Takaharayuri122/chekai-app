# Baseline de performance da geração de PDF

Use para comparar **antes/depois** de otimizações (tempo e memória).

## Como medir

1. No `.env` da API (`apps/api/.env`), defina:

   ```env
   PDF_GERACAO_METRICAS=true
   ```

2. Suba a API e gere PDFs pelos fluxos reais:

   - Relatório de auditoria: `GET /auditorias/:id/pdf` (auditoria finalizada).
   - Relatório técnico: `GET /relatorios-tecnicos/:id/pdf` (relatório finalizado).

3. Nos logs da API, procure linhas no formato:

   ```text
   [PDF métricas] auditoria <uuid>: <ms> ms · RSS <MB> MB · <bytes> bytes
   [PDF métricas] relatório-técnico <uuid>: <ms> ms · RSS <MB> MB · <bytes> bytes
   ```

4. Anote em uma tabela:

   | Cenário        | N fotos | Tempo (ms) | RSS (MB) | Tamanho PDF (bytes) |
   | -------------- | ------- | ---------- | -------- | --------------------- |
   | Ex.: técnico   | 10      |            |          |                       |
   | Ex.: técnico   | 50      |            |          |                       |
   | Ex.: auditoria | —       |            |          |                       |

5. Desligue a métrica em produção (`PDF_GERACAO_METRICAS=false` ou omita a variável).

## Variáveis relacionadas

- `CHEKAI_LOGO_URL` — URL pública do logo PNG (opcional; há fallback).
- `PUPPETEER_EXECUTABLE_PATH` — Chromium no Docker (`/usr/bin/chromium`).
