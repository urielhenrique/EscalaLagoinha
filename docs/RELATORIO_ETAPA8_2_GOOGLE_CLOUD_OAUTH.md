# Relatório Etapa 8.2 — Google Cloud Console + OAuth

## 1. Objetivo

Preparar a configuração do Google Cloud Console e OAuth 2.0 para a futura integração com Google Calendar. Esta etapa é de configuração e documentação — nenhuma implementação de código foi realizada.

## 2. Estado encontrado no projeto

### Estrutura do backend

| Item | Valor |
|------|-------|
| Framework | NestJS 11.x |
| ORM | Prisma 6.6.x |
| Porta | 3000 |
| Prefixo global | `/api` |
| Escuta | `0.0.0.0` |
| Swagger | `/docs` (habilitado em dev) |

### Estrutura do frontend

| Item | Valor |
|------|-------|
| Framework | React 19.x |
| Build tool | Vite 8.x |
| Porta dev | 5173 (padrão Vite) |
| API client | Axios com interceptor |
| Token storage | localStorage |

### Variáveis de ambiente

#### Backend `.env` (somente nomes)

| Variável | Finalidade |
|----------|------------|
| `DATABASE_URL` | Conexão PostgreSQL |
| `JWT_SECRET` | Chave de assinatura JWT |
| `PORT` | Porta do servidor (3000) |
| `CORS_ORIGINS` | Origens permitidas CORS |

#### Backend `.env.example` — variáveis documentadas

| Categoria | Variáveis |
|-----------|-----------|
| Database | `DATABASE_URL` |
| JWT Auth | `JWT_SECRET`, `JWT_EXPIRES_IN` |
| Server | `PORT`, `NODE_ENV`, `PRISMA_CONNECT_*`, `PRISMA_MIGRATE_*`, `RUN_PRISMA_SEED` |
| CORS | `FRONTEND_URL`, `APP_URL`, `CORS_ORIGINS` |
| Rate limit | `AUTH_RATE_LIMIT`, `ENABLE_SWAGGER` |
| Docker Postgres | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` |
| Notifications | `REMINDERS_ENABLED`, `REMINDERS_HOURS_AHEAD` |
| AI (opcional) | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| Email SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |

#### Frontend `.env.example`

| Variável | Finalidade |
|----------|------------|
| `VITE_API_URL` | URL da API backend |
| `VITE_APP_NAME` | Nome da aplicação |

### Configuração de CORS

```typescript
// main.ts — lógica de CORS
const allowedOrigins = corsOriginsEnv
  ? corsOriginsEnv.split(",").map((origin) => origin.trim())
  : frontendUrl
    ? [frontendUrl]
    : ["http://localhost:5173", "http://localhost:5174"];

app.enableCors({
  origin: (origin, callback) => { /* validação */ },
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});
```

### URLs atuais

| Ambiente | Backend | Frontend |
|----------|---------|----------|
| Development | `http://localhost:3000/api` | `http://localhost:5173` |
| Production | `https://api.escalafacil.coderonin.com.br` | `https://app.escalafacil.coderonin.com.br` |

### Configuração de autenticação

```typescript
// JWT Payload
{
  sub: string;        // user UUID
  email: string;
  perfil: Perfil;     // MASTER_PLATFORM_ADMIN | MASTER_ADMIN | ADMIN | VOLUNTARIO
  churchId?: string;
  churchSlug?: string;
}
```

- Expiração: 7 dias (configurável via `JWT_EXPIRES_IN`)
- Armazenamento frontend: `localStorage` (key: `escala_lagoinha_auth_token`)
- Validação: `JwtStrategy` verifica `passwordChangedAt > iat`

### Configuração Google existente

**Nenhuma configuração Google existe no projeto.** Não há:
- `passport-google-oauth20`
- `googleapis`
- Variáveis de ambiente Google
- Módulos ou services Google

O único relacionamento com Google é um link externo para criar eventos manualmente (`calendar.google.com/calendar/render?...`).

## 3. Documentação oficial consultada

| Documento | URL |
|-----------|-----|
| OAuth 2.0 overview | https://developers.google.com/identity/protocols/oauth2 |
| Web server OAuth | https://developers.google.com/identity/protocols/oauth2/web-server |
| Production guidelines | https://developers.google.com/identity/protocols/oauth2/production-guidelines |
| Configure OAuth consent | https://developers.google.com/workspace/guides/configure-oauth-consent |
| Calendar API - Events | https://developers.google.com/calendar/api/v3/reference/events |
| Calendar API - Calendars | https://developers.google.com/calendar/api/concepts/access-calendars |
| OAuth consent screen overview | https://support.google.com/cloud/answer/9110914 |
| Quotas - Google Calendar API | https://developers.google.com/calendar/api/concepts/quotas-limits |
| OAuth app verification | https://support.google.com/cloud/answer/7447424 |

## 4. Google Cloud Project

### Guia passo a passo

1. Acessar `https://console.cloud.google.com/`
2. Criar novo projeto ou selecionar existente
3. Definir nome: **Escala Fácil** ou **EscalaLagoinha**
4. O Project ID será gerado automaticamente (ex: `escala-facil-123456`)
5. A conta Google proprietária será quem criar o projeto

### Recomendação

- Criar um projeto **dedicado** ao Escala Fácil
- Não misturar com outros projetos
- Documentar o Project ID e a conta Google proprietária
- Verificar se a conta Google tem permissão de Owner ou Editor

### Nota

O projeto ainda não foi criado. Esta configuração será realizada manualmente pelo responsável.

## 5. Google Calendar API

### Como habilitar

1. Acessar `https://console.cloud.google.com/apis/library`
2. Pesquisar "Google Calendar API"
3. Clicar em "Enable"

### Informações da API

| Item | Valor |
|------|-------|
| Nome | Google Calendar API |
| URL | `https://www.googleapis.com/calendar/v3` |
| Documentação | https://developers.google.com/calendar/api |
| Quotas | https://developers.google.com/calendar/api/concepts/quotas-limits |

### APIs adicionais necessárias

Para o fluxo OAuth, nenhuma API adicional é obrigatória. A habilitação da Google Calendar API é suficiente para o MVP.

## 6. OAuth / Google Auth Platform

### Nome atual no Console

O menu no Google Cloud Console é chamado **"Google Auth Platform"** (não mais "OAuth consent screen" na navegação).

Caminho: `Menu > Google Auth Platform > Branding`

URL direta: `https://console.developers.google.com/auth/branding`

### Configuração necessária

| Campo | Valor |
|-------|-------|
| App name | Escala Fácil |
| User support email | Email do responsável |
| Developer contact information | Email do responsável |
| Audience | External (ver seção 7) |
| Publishing status | Testing (ver seção 8) |
| Authorized domains | `coderonin.com.br` (produção) |
| App domain | Opcional para MVP |
| Privacy policy | Não obrigatória para MVP (recomendado) |
| Terms of service | Não obrigatória para MVP (recomendado) |

### Navegação atualizada

```
Google Cloud Console
  └── Google Auth Platform
       ├── Branding (configurações gerais)
       ├── Audience (user type + test users)
       ├── Data Access (scopes)
       └── Clients (OAuth credentials)
```

## 7. Internal x External

### Análise

| Critério | Internal | External |
|----------|----------|----------|
| Requer Google Workspace | Sim | Não |
| Acessível para contas Gmail | Não | Sim |
| Test users | Não aplicável | Até 100 |
| Verificação necessária | Não | Sim (para produção) |
| Público-alvo | Organização | Qualquer usuário |

### Decisão para o Escala Fácil

**External** é a opção correta.

Justificativa:
- O Escala Fácil é utilizado por voluntários de igrejas
- Voluntários podem ter contas Gmail pessoais
- Não há requisito de Google Workspace
- Internal só funcionaria se todos os voluntários fossem da mesma organização Google

### Pendência

A decisão entre Internal e External depende de saber se a igreja utiliza Google Workspace. Como o sistema é multi-igreja e voluntários podem ter contas pessoais, **External** é a opção mais segura.

## 8. Testing x Production

### Comportamento por status

| Status | Quem acessa | Refresh token | Verificação |
|--------|-------------|---------------|-------------|
| **Testing** | Apenas test users (até 100) | **Expira em 7 dias** | Não necessária |
| **Published (Unverified)** | Qualquer Google user (com aviso) | Não expira | Não completada |
| **Published (Verified)** | Qualquer Google user | Não expira | Completada |

### Correção em relação à Etapa 8.1

**A documentação da Etapa 8.1 contém uma informação incorreta sobre refresh tokens.**

Etapa 8.1 afirma:
> "refresh_token: Long-lived: Does not expire (unless unused for 6 months, or user revokes)"

**Documentação oficial do Google afirma:**
> "A Google Cloud Platform project with an OAuth consent screen configured for an external user type and a publishing status of 'Testing' is issued a refresh token expiring in **7 days**, unless the only OAuth scopes requested are a subset of name, email address, and user profile"

**Correção em relação à Etapa 8.1:** Para apps externos em Testing, o refresh token expira em **7 dias**, não é long-lived. Isso não se aplica a apps Intern nem a apps Published/Verified.

### Impacto no MVP

- **Testing**: Adequado para desenvolvimento e testes internos. Refresh token expira em 7 dias, exigindo re-autorização periódica.
- **Published (Unverified)**: Adequado para uso limitado (<100 usuários). Qualquer pessoa pode usar, mas com avisos de app não verificado. Cap de 100 usuários totais.
- **Published (Verified)**: Necessário para produção em escala. Requer verificação pelo Google (processo que pode levar semanas).

### Recomendação para MVP

1. **Desenvolvimento**: Usar status Testing com test users
2. **Lançamento inicial**: Usar Published/Unverified (até 100 usuários)
3. **Escala**: Iniciar processo de verificação Google

## 9. Test Users

### Como configurar

1. Acessar `https://console.developers.google.com/auth/audience`
2. Em "Test users", clicar em "Add users"
3. Inserir email(s) do(s) test user(s)
4. Clicar em "Save"

### Regras

| Regra | Valor |
|-------|-------|
| Limite | 100 test users |
| Quem pode acessar | Apenas emails na lista |
| Usuários não autorizados | Veem tela de aviso "app em teste" |
| Exceção | Apps com apenas scopes básicos (openid, email, profile) não precisam de lista |

### Quem deve ser cadastrado

- Desenvolvedor(es) do projeto
- Administrador(es) da igreja de teste
- Voluntário(s) de teste
- Qualquer pessoa que precise testar a integração Google Calendar

## 10. Scopes

### Scope validado

```
https://www.googleapis.com/auth/calendar
```

### Verificação oficial

| Operação | Scope necessário | `calendar` atende? |
|----------|------------------|-------------------|
| Criar eventos | `calendar.events` | ✅ Sim |
| Atualizar eventos | `calendar.events` | ✅ Sim |
| Excluir eventos | `calendar.events` | ✅ Sim |
| Consultar eventos | `calendar.events` | ✅ Sim |
| Acessar calendário selecionado | `calendar.calendarlist` | ✅ Sim |
| Acessar calendário padrão | `calendar` | ✅ Sim |

### Classificação de sensibilidade

Segundo documentação oficial:
> "Apps that request access to scopes categorized as **sensitive** or **restricted** must complete Google's OAuth app verification before being granted access."

O scope `calendar` é classificado como **sensitive**.

### Impacto na verificação

- **Testing**: Não requer verificação
- **Published/Unverified**: Requer verificação para usar em produção
- **Published/Verified**: Verificação completada

### Scope alternativo avaliado

| Scope | Cobre CRUD? | Sensibilidade | Recomendado? |
|-------|-------------|---------------|--------------|
| `calendar` | Sim (tudo) | Sensitive | **Sim (MVP)** |
| `calendar.events` | Sim (eventos) | Sensitive | Não (futuro) |
| `calendar.readonly` | Somente leitura | Non-sensitive | Não (insuficiente) |

O scope `calendar` é necessário porque precisamos:
1. Criar, atualizar e excluir eventos
2. Acessar o calendário padrão do usuário
3. Listar calendários (futuro)

## 11. OAuth Client

### Configuração

| Campo | Valor |
|-------|-------|
| Nome | Escala Fácil |
| Tipo | Web application |
| Authorized redirect URIs | Ver seção 12 |

### Campos necessários para o fluxo Authorization Code

| Campo | Necessário? | Observação |
|-------|-------------|------------|
| Name | Sim | Identificação do client |
| Authorized redirect URIs | Sim | Obrigatório para web apps |
| Authorized JavaScript origins | **Não** | Fluxo é server-side, não client-side |
| Application home page | Opcional | Recomendado para produção |
| Application privacy policy | Opcional | Recomendado para produção |
| Application terms of service | Opcional | Recomendado para produção |

### Credenciais geradas

| Credencial | Uso |
|------------|-----|
| Client ID | Variável `GOOGLE_CLIENT_ID` |
| Client Secret | Variável `GOOGLE_CLIENT_SECRET` |

### Segurança

- Client Secret **nunca** será exposto ao frontend
- Client Secret **nunca** será committado no Git
- Client Secret será armazenado como secret no Coolify

### Clientes separados

Recomendado criar **dois OAuth Clients**:

| Cliente | Uso | Redirect URI |
|---------|-----|--------------|
| Development | Desenvolvimento local | `http://localhost:3000/integrations/google/callback` |
| Production | Aplicação em produção | `https://api.escalafacil.coderonin.com.br/integrations/google/callback` |

Isso evita mistura de ambientes e permite testes isolados.

## 12. Redirect URIs

### URIs definidas

| Ambiente | Redirect URI |
|----------|--------------|
| Development | `http://localhost:3000/integrations/google/callback` |
| Production | `https://api.escalafacil.coderonin.com.br/integrations/google/callback` |

### Validação da porta

A porta do backend foi confirmada no código:
```typescript
// main.ts
const port = configService.get<number>("PORT", 3000);
await app.listen(port, "0.0.0.0");
```

E no `.env`:
```
PORT=3000
```

Porta confirmada: **3000**

### Regras do Google

> "The value must exactly match one of the authorized redirect URIs for the OAuth 2.0 client"
> "Note that the http or https scheme, case, and trailing slash ('/') must all match."

A redirect URI deve ser **idêntica** ao que o backend enviará no fluxo OAuth.

### Nota sobre o prefixo `/api`

O backend usa `app.setGlobalPrefix("api", { exclude: ["health"] })`. Portanto, o endpoint de callback será:
```
/api/integrations/google/callback
```

A redirect URI deve incluir `/api`:
```
https://api.escalafacil.coderonin.com.br/api/integrations/google/callback
```

**ATENÇÃO**: A Etapa 8.1 definiu o callback como `/integrations/google/callback`. Com o prefixo global, o path correto será `/api/integrations/google/callback`. A redirect URI no Google Cloud Console deve refletir o path completo.

## 13. Environment Variables

### Variáveis validadas

| Variável | Necessária em | Obrigatória? |
|----------|---------------|--------------|
| `GOOGLE_CLIENT_ID` | Etapa 8.3 | Sim |
| `GOOGLE_CLIENT_SECRET` | Etapa 8.3 | Sim |
| `GOOGLE_REDIRECT_URI` | Etapa 8.3 | Sim |
| `GOOGLE_ENCRYPTION_KEY` | Etapa 8.4 | Sim |

### Pendências por etapa

| Etapa | Variáveis necessárias |
|-------|----------------------|
| 8.3 (Backend OAuth) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| 8.4 (Persistência) | `GOOGLE_ENCRYPTION_KEY` |
| 8.5+ (Frontend) | Nenhuma variável Google |

### Formato do `.env.example`

```env
# ─── Google Calendar (FUTURA) ────────────────────────────────────────────────
# Configure no Google Cloud Console: https://console.cloud.google.com
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GOOGLE_REDIRECT_URI=http://localhost:3000/api/integrations/google/callback
# GOOGLE_ENCRYPTION_KEY=CHANGE_ME_WITH_A_32_BYTE_RANDOM_SECRET
```

### Nota

Não foi adicionado ao `.env.example` porque a implementação ainda não ocorreu. Será adicionado na Etapa 8.3.

## 14. Security

### Checklist de segurança

| # | Item | Status |
|---|------|--------|
| 1 | Client Secret somente no backend | ✅ Definido |
| 2 | Client Secret nunca no frontend | ✅ Definido |
| 3 | Client Secret nunca no Git | ✅ Definido |
| 4 | Redirect URI exata | ✅ Definida |
| 5 | HTTPS em produção | ✅ Coolify configura automaticamente |
| 6 | OAuth state obrigatório | ✅ Definido na arquitetura |
| 7 | state com expiração (10 min) | ✅ Definido na arquitetura |
| 8 | state single-use | ✅ Definido na arquitetura |
| 9 | tokens Google nunca logados | ✅ Definido |
| 10 | refresh token criptografado | ✅ Definido (Etapa 8.4) |
| 11 | secrets no Coolify | ✅ Definido |
| 12 | credenciais separadas dev/prod | ✅ Definido |
| 13 | scopes mínimos necessários | ✅ `calendar` é necessário |
| 14 | não usar service account | ✅ Definido |

### Validação por operação

```typescript
// Antes de sincronizar
if (connection.userId !== actor.id) {
  throw new ForbiddenException('Conexão não pertence ao usuário');
}

// Antes de sincronizar evento
if (event.churchId !== actor.churchId) {
  throw new ForbiddenException('Evento não pertence à igreja do usuário');
}
```

## 15. Quotas e Verification

### Quotas do Google Calendar API

| Quota | Limite |
|-------|--------|
| Requisições por minuto por projeto | 10.000 |
| Requisições por minuto por usuário por projeto | 600 |
| Requisições por dia por projeto | 1.000.000 (threshold de billing) |

### Verificação do OAuth App

| Scope | Categoria | Verificação necessária |
|-------|-----------|----------------------|
| `calendar` | **Sensitive** | Sim (para Published) |

### Processo de verificação

1. **Testing**: Não requer verificação
2. **Published/Unverified**: Pode usar com cap de 100 usuários
3. **Published/Verified**: Requer verificação completa pelo Google

### Tempo de verificação

O processo de verificação pode levar **semanas a meses**, dependendo da complexidade do app e dos scopes solicitados.

### Recomendação para MVP

1. Iniciar em **Testing** durante desenvolvimento
2. Usar **Published/Unverified** para lançamento inicial (até 100 usuários)
3. Iniciar processo de verificação antecipadamente para produção em escala

## 16. Correções em relação à Etapa 8.1

### Correção 1: Expiração de refresh token

**Etapa 8.1 afirma:**
> "refresh_token: Long-lived: Does not expire (unless unused for 6 months, or user revokes)"

**Documentação oficial do Google:**
> "A Google Cloud Platform project with an OAuth consent screen configured for an external user type and a publishing status of 'Testing' is issued a refresh token expiring in **7 days**"

**Status:** Correção necessária. Apps externos em Testing possuem refresh token com expiração de 7 dias.

### Correção 2: Prefixo de path no callback

**Etapa 8.1 definiu:**
> `GET /integrations/google/callback`

**Com prefixo global `/api`:**
> `GET /api/integrations/google/callback`

**Status:** A redirect URI no Google Cloud Console deve incluir o prefixo `/api`.

### Correção 3: Nome do menu no Google Cloud Console

**Etapa 8.1 pode referenciar "OAuth consent screen":**
O nome atual do menu é **"Google Auth Platform"**.

**Status:** Informativo. Não afeta funcionalidade.

### Documentação histórica

As correções foram registradas nesta seção. O documento da Etapa 8.1 **não foi alterado**.

## 17. Pendências para Etapa 8.3

### Configuração manual (antes de codificar)

| # | Pendência | Responsável |
|---|-----------|-------------|
| 1 | Criar projeto no Google Cloud Console | Manual |
| 2 | Habilitar Google Calendar API | Manual |
| 3 | Configurar Google Auth Platform (Branding) | Manual |
| 4 | Definir user type como External | Manual |
| 5 | Criar OAuth Client ID (Web application) - Development | Manual |
| 6 | Criar OAuth Client ID (Web application) - Production | Manual |
| 7 | Adicionar redirect URIs | Manual |
| 8 | Adicionar test users | Manual |
| 9 | Documentar Client ID e Client Secret | Manual |
| 10 | Configurar variáveis no Coolify (produção) | Manual |
| 11 | Configurar variáveis no .env (desenvolvimento) | Manual |

### Dependências para Etapa 8.3

| Dependência | Status |
|-------------|--------|
| Google Cloud Project criado | Pendente |
| Google Calendar API habilitada | Pendente |
| OAuth Client criado | Pendente |
| Client ID documentado | Pendente |
| Client Secret documentado | Pendente |
| Variáveis de ambiente definidas | Pendente |

## 18. Checklist final

| # | Item | Status | Evidência | Pendência |
|---|------|--------|-----------|-----------|
| 1 | Arquitetura analisada | ✅ | Etapa 8.1 | — |
| 2 | Autenticação atual analisada | ✅ | JWT, roles, churchId | — |
| 3 | OAuth definido | ✅ | Authorization Code Flow | — |
| 4 | Scopes definidos | ✅ | `calendar` (sensitive) | — |
| 5 | Segurança definida | ✅ | Checklist completo | — |
| 6 | Estratégia de tokens definida | ✅ | Backend only, criptografado | — |
| 7 | Modelo de dados proposto | ✅ | GoogleCalendarConnection | — |
| 8 | Estratégia de sincronização definida | ✅ | Síncrona com fallback | — |
| 9 | CREATE definido | ✅ | Fluxo documentado | — |
| 10 | UPDATE definido | ✅ | Fluxo documentado | — |
| 11 | DELETE definido | ✅ | Fluxo documentado | — |
| 12 | Recorrência analisada | ✅ | Eventos individuais | — |
| 13 | Multi-tenancy analisado | ✅ | userId + churchId | — |
| 14 | Permissões analisadas | ✅ | Tabela definida | — |
| 15 | Falhas analisadas | ✅ | Retry + fallback | — |
| 16 | Coolify analisado | ✅ | HTTPS automático | — |
| 17 | Endpoints futuros definidos | ✅ | 7 endpoints | — |
| 18 | Frontend futuro definido | ✅ | Configurações + eventos | — |
| 19 | Fases futuras definidas | ✅ | 8.1-8.11 | — |
| 20 | Documentação criada | ✅ | Etapa 8.1 | — |
| 21 | Nenhuma alteração de código | ✅ | — | — |
| 22 | Google Cloud Project definido | ⏳ | Pendente | Configuração manual |
| 23 | Google Calendar API identificada | ✅ | Documentação oficial | — |
| 24 | Configuração OAuth documentada | ✅ | Branding + Clients | — |
| 25 | Internal/External analisado | ✅ | External (contas Gmail) | — |
| 26 | Testing/Production analisado | ✅ | Tabela comparativa | — |
| 27 | Test Users documentados | ✅ | Até 100, como adicionar | — |
| 28 | Scope validado oficialmente | ✅ | `calendar` (sensitive) | — |
| 29 | OAuth Client Web Application definido | ✅ | Tipo correto | — |
| 30 | Redirect URI dev definida | ✅ | `http://localhost:3000/api/...` | — |
| 31 | Redirect URI prod definida | ✅ | `https://api.escalafacil.coderonin.com.br/api/...` | — |
| 32 | Secrets documentados sem valores | ✅ | Apenas nomes | — |
| 33 | Requisitos de domínio verificados | ✅ | `coderonin.com.br` | — |
| 34 | Refresh token verificado | ✅ | 7 dias em Testing | Correção Etapa 8.1 |
| 35 | Verification requirements verificados | ✅ | Sensitive scope | — |
| 36 | Nenhuma implementação OAuth | ✅ | — | — |
| 37 | Relatório criado | ✅ | Este documento | — |
| 38 | Projeto compilando | ✅ | Backend e frontend OK | — |

## Status: PASS WITH PENDING

### Motivo

A etapa foi concluída com sucesso. Todas as definições arquiteturais foram documentadas. As pendências restantes são **configuração manual** no Google Cloud Console, que não podem ser automatizadas por esta etapa.

### Pendências

| # | Pendência | Tipo | Bloqueia |
|---|-----------|------|----------|
| 1 | Criar projeto no Google Cloud Console | Manual | Etapa 8.3 |
| 2 | Habilitar Google Calendar API | Manual | Etapa 8.3 |
| 3 | Criar OAuth Client ID (dev) | Manual | Etapa 8.3 |
| 4 | Criar OAuth Client ID (prod) | Manual | Etapa 8.3 |
| 5 | Adicionar test users | Manual | Testes locais |
| 6 | Configurar variáveis no Coolify | Manual | Produção |
| 7 | Verificar processo de publicação Google | Futuro | Escala |

### Próxima etapa recomendada

**8.3 — Backend OAuth**: Implementar `GoogleCalendarModule` com endpoints de conexão, callback, status e desconexão.

**Pré-requisito para 8.3**: Configuração manual no Google Cloud Console (itens 1-5 acima).

---

**NÃO implementado (conforme especificado):**
- código OAuth no NestJS
- controllers
- services
- Prisma migrations
- tabelas
- integração com Google API
- frontend
- sincronização de eventos
- refresh token
- criptografia de tokens
