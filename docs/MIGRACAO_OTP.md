# Migração para Sistema de Autenticação via OTP

## Resumo das Mudanças

Este documento descreve as mudanças implementadas para migrar o sistema de autenticação de senha para OTP (One-Time Password) via e-mail.

## 1. Serviço de E-mail

### Módulo Criado
- **Módulo**: `apps/api/src/modules/email/`
- **Serviço**: `EmailService` com suporte a SMTP via nodemailer
- **Templates**: 
  - E-mail de boas-vindas
  - E-mail com código OTP

### Configuração SMTP
Adicione as seguintes variáveis de ambiente no arquivo `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app
SMTP_FROM=noreply@metaapp.com
```

**Nota**: Para Gmail, você precisará criar uma "Senha de App" nas configurações de segurança da sua conta Google.

## 2. Mudanças no Banco de Dados

### Script de Migração
Execute o script `scripts/migrar-para-otp.sql` no seu banco de dados:

```sql
-- Tornar senhaHash nullable
ALTER TABLE usuarios ALTER COLUMN senha_hash DROP NOT NULL;

-- Adicionar campos OTP
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6) NULL,
ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP NULL;

-- Criar índice para otp_code
CREATE INDEX IF NOT EXISTS idx_usuarios_otp_code ON usuarios(otp_code) WHERE otp_code IS NOT NULL;
```

### Mudanças na Entidade
- `senhaHash`: Agora é `nullable` (usuários novos não terão senha)
- `otpCode`: Novo campo para armazenar código OTP temporário (6 dígitos)
- `otpExpiresAt`: Novo campo para armazenar data de expiração do OTP (10 minutos)

## 3. Novos Endpoints de Autenticação

### POST `/auth/solicitar-otp`
Solicita um código OTP por e-mail.

**Request:**
```json
{
  "email": "usuario@email.com"
}
```

**Response:**
```json
{
  "message": "Código OTP enviado por e-mail"
}
```

### POST `/auth/validar-otp`
Valida o código OTP e retorna o token JWT.

**Request:**
```json
{
  "email": "usuario@email.com",
  "codigo": "123456"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": "uuid",
    "nome": "João Silva",
    "email": "usuario@email.com",
    "perfil": "gestor",
    "gestorId": null,
    "tenantId": "uuid"
  }
}
```

### POST `/auth/cadastro`
Cadastro público agora **não requer senha**. Apenas nome, e-mail e telefone.

**Request:**
```json
{
  "nome": "João Silva",
  "email": "usuario@email.com",
  "telefone": "11999998888"
}
```

**Response:**
```json
{
  "message": "Usuário cadastrado com sucesso. Verifique seu e-mail para mais informações."
}
```

**Nota**: Um e-mail de boas-vindas é enviado automaticamente após o cadastro.

### POST `/auth/login` (DEPRECATED)
O endpoint de login com senha ainda existe para compatibilidade com usuários antigos, mas está marcado como deprecated. Use `solicitar-otp` e `validar-otp` para novos usuários.

## 4. Fluxo de Autenticação

### Novo Fluxo (OTP)
1. Usuário acessa a tela de login
2. Usuário informa apenas o e-mail
3. Sistema envia código OTP de 6 dígitos por e-mail (válido por 10 minutos)
4. Usuário informa o código recebido
5. Sistema valida o código e retorna token JWT

### Fluxo Legado (Senha)
1. Usuário informa e-mail e senha
2. Sistema valida e retorna token JWT
3. **Nota**: Apenas usuários antigos que já possuem senha podem usar este método

## 5. E-mails do Sistema

### E-mail de Boas-Vindas
Enviado automaticamente quando:
- Um novo usuário se cadastra na plataforma
- Um usuário é criado por um administrador

**Conteúdo**: Mensagem de boas-vindas com informações sobre a plataforma.

### E-mail com Código OTP
Enviado quando:
- Usuário solicita login via OTP

**Conteúdo**: Código de 6 dígitos com validade de 10 minutos.

## 6. Próximos Passos

### Frontend
Atualizar a interface de login para:
1. Remover campo de senha
2. Adicionar fluxo de solicitação de OTP
3. Adicionar campo para inserir código OTP
4. Atualizar página de cadastro para remover campo de senha

### Testes
1. Testar envio de e-mails em ambiente de desenvolvimento
2. Testar fluxo completo de OTP
3. Validar expiração de códigos OTP
4. Testar cadastro sem senha

### Segurança
1. Implementar rate limiting para solicitação de OTPs (evitar spam)
2. Considerar adicionar reCAPTCHA na solicitação de OTP
3. Implementar logs de tentativas de login

## 7. Compatibilidade

- Usuários antigos com senha ainda podem fazer login usando o endpoint `/auth/login`
- Novos usuários devem usar o fluxo OTP
- O campo `senhaHash` permanece no banco para compatibilidade, mas é opcional

## 8. Variáveis de Ambiente Necessárias

Certifique-se de configurar todas as variáveis no arquivo `.env`:

```env
# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app
SMTP_FROM=noreply@metaapp.com
```

## 9. Dependências Adicionadas

- `nodemailer`: Biblioteca para envio de e-mails via SMTP
- `@types/nodemailer`: Tipos TypeScript para nodemailer

