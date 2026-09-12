# Etapa 8.1 — Arquitetura Google Calendar

## 1. Objetivo

Realizar análise técnica completa para definir a arquitetura da integração com Google Calendar antes de implementar código. Esta é uma etapa de análise — nenhuma alteração de código, schema ou configuração será realizada.

## 2. Estado atual do projeto

### Stack
- **Backend**: NestJS + Prisma + PostgreSQL
- **Frontend**: React + Vite + Tailwind
- **Auth**: JWT (7 dias), HttpOnly não utilizado
- **Multi-tenancy**: `churchId` em praticamente todos os models

### Modelo de Usuário
```prisma
model User {
  id        String  @id @default(uuid())
  nome      String
  email     String  @unique
  senha     String
  telefone  String
  foto      String?
  perfil    Perfil  @default(VOLUNTARIO)
  status    UserStatus @default(ATIVO)
  churchId  String?
  church    Church? @relation(fields: [churchId], references: [id], onDelete: SetNull)
  // ... outros relations
}
```

### Modelo de Evento
```prisma
model Event {
  id                String         @id @default(uuid())
  nome              String
  descricao         String
  churchId          String?
  dataInicio        DateTime
  dataFim           DateTime
  recorrencia       String?
  recurrenceGroupId String?
  recurrenceType    RecurrenceType @default(NONE)
  recurrenceDays    String[]
  recurrenceStart   DateTime?
  recurrenceEnd     DateTime?
  recurrenceIndex   Int?
  schedules         Schedule[]
  createdAt         DateTime       @default(now())
}
```

### JWT Payload
```typescript
{
  sub: string;        // user UUID
  email: string;
  perfil: Perfil;     // MASTER_PLATFORM_ADMIN | MASTER_ADMIN | ADMIN | VOLUNTARIO
  churchId?: string;
  churchSlug?: string;
}
```

### Hierarquia de Permissões
```
MASTER_PLATFORM_ADMIN > MASTER_ADMIN > ADMIN > VOLUNTARIO
```
- MASTER_ADMIN e MASTER_PLATFORM_ADMIN bypassam todas as verificações de role
- `@Roles(Perfil.ADMIN)` permite ADMIN, MASTER_ADMIN e MASTER_PLATFORM_ADMIN

### Padrões existentes
- **Church scoping**: `buildChurchScope(actor)` retorna `{ churchId }` para não-platform-admins
- **Cross-church guard**: `assertSameChurch()` verifica pertencimento à mesma igreja
- **AuditLog**: Toda mutação cria entrada de auditoria
- **No frontend**: JWT armazenado em `localStorage` (key: `escala_lagoinha_auth_token`)

## 3. Escopo MVP

### Fase 1 (MVP)
| Funcionalidade | Prioridade |
|----------------|------------|
| Conectar Google Calendar | Obrigatório |
| Autorizar acesso (OAuth) | Obrigatório |
| Criar evento no Google | Obrigatório |
| Armazenar referência do evento Google | Obrigatório |
| Disponibilizar link para abrir no Google | Obrigatório |
| Atualizar evento no Google | Obrigatório |
| Excluir evento no Google | Obrigatório |
| Desconectar conta | Obrigatório |

### Fase 2 (Futuro)
| Funcionalidade | Prioridade |
|----------------|------------|
| Recorrência Google | Futuro |
| Sincronização avançada | Futuro |
| Tratamento de conflitos | Futuro |
| Sincronização bidirecional | Futuro |

## 4. OAuth 2.0

### Fluxo recomendado: Authorization Code Flow with Refresh Token

O backend NestJS será responsável pelo fluxo OAuth completo. O frontend nunca manipula tokens Google.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend   │────▶│   Backend    │────▶│   Google    │
│   (React)    │◀────│   (NestJS)   │◀────│   OAuth     │
└─────────────┘     └──────────────┘     └─────────────┘
```

### Fluxo detalhado

1. **Frontend**: Usuário clica "Conectar Google Calendar"
2. **Frontend**: Requisição `GET /integrations/google/connect` (com JWT)
3. **Backend**: Gera `state` aleatório, armazena em cache/DB associado ao `userId`
4. **Backend**: Retorna URL de autorização Google
5. **Frontend**: Redireciona o navegador para a URL Google
6. **Google**: Exibe tela de consentimento
7. **Usuário**: Autoriza acesso
8. **Google**: Redireciona para `redirect_uri` com `code` e `state`
9. **Backend**: Recebe callback `GET /integrations/google/callback`
10. **Backend**: Valida `state` contra o armazenado
11. **Backend**: Troca `code` por `access_token` + `refresh_token`
12. **Backend**: Armazena tokens criptografados no banco
13. **Backend**: Redireciona frontend para página de sucesso
14. **Frontend**: Exibe "Google Calendar conectado"

### Parâmetros OAuth

| Parâmetro | Valor |
|-----------|-------|
| `response_type` | `code` |
| `access_type` | `offline` |
| `prompt` | `consent` |
| `include_granted_scopes` | `true` |
| `state` | UUID aleatório (CSRF protection) |

### URL de autorização

```
https://accounts.google.com/o/oauth2/v2/auth
  ?client_id={GOOGLE_CLIENT_ID}
  &redirect_uri={GOOGLE_REDIRECT_URI}
  &response_type=code
  &scope=https://www.googleapis.com/auth/calendar
  &access_type=offline
  &include_granted_scopes=true
  &state={RANDOM_STATE}
  &prompt=consent
```

### Troca de código por tokens

```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

code={AUTHORIZATION_CODE}
&client_id={GOOGLE_CLIENT_ID}
&client_secret={GOOGLE_CLIENT_SECRET}
&redirect_uri={GOOGLE_REDIRECT_URI}
&grant_type=authorization_code
```

### Resposta da troca

```json
{
  "access_token": "ya29...",
  "refresh_token": "1//...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "https://www.googleapis.com/auth/calendar"
}
```

**Nota importante**: O `refresh_token` só é retornado na **primeira autorização**. Em re-autorizações, pode não ser retornado.

## 5. Scopes

### Scope escolhido para MVP

```
https://www.googleapis.com/auth/calendar
```

### Justificativa

| Scope | Cobre CRUD? | Cobre calendários? | Recomendado? |
|-------|-------------|---------------------|--------------|
| `calendar` | Sim | Sim | **Sim (MVP)** |
| `calendar.events` | Sim | Não | Não (futuro) |
| `calendar.readonly` | Somente leitura | Sim | Não (insuficiente) |

O scope `https://www.googleapis.com/auth/calendar` é o menor escopo que permite:
- Criar, atualizar e excluir eventos
- Acessar calendário padrão do usuário
- Listar calendários (futuro)

### Risco

O scope `calendar` permite acesso total aos calendários do usuário. Para mitigar:
- Solicitar apenas quando necessário
- Permitir desconexão a qualquer momento
- Não armazenar tokens desnecessariamente
- Documentar claramente no consentimento

### Impacto no consentimento

O Google exibirá: "Gerenciar seus eventos no Google Calendar". O usuário deve entender que o app poderá criar, editar e excluir eventos.

## 6. Segurança

### OAuth State (CSRF)

O parâmetro `state` protege contra ataques CSRF:

1. Backend gera UUID aleatório antes do redirect
2. Armazena `state` associado ao `userId` (com TTL de 10 minutos)
3. Google retorna o `state` no callback
4. Backend valida `state` contra o armazenado
5. Remove `state` após uso (one-time use)

### Redirect URI

| Ambiente | URI |
|----------|-----|
| Development | `http://localhost:3000/integrations/google/callback` |
| Production | `https://api.escalafacil.coderonin.com.br/integrations/google/callback` |

Apenas URIs registradas no Google Cloud Console são aceitas.

### Token Leakage

- Tokens Google **nunca** são expostos ao frontend
- Todas as chamadas à API Google são feitas pelo backend
- Tokens são armazenados criptografados no banco (AES-256)
- Logs nunca registram tokens

### Isolamento por usuário

```
authenticatedUser.id === googleConnection.userId
```

Antes de qualquer operação, o backend valida:
1. O usuário está autenticado (JWT)
2. A conexão Google pertence ao usuário autenticado
3. O evento pertence à mesma igreja (quando aplicável)

### Isolamento por churchId

Eventos do Escala Fácil possuem `churchId`. A sincronização respeita:
- Usuário deve pertencer à mesma igreja do evento
- Conexão Google deve pertencer ao usuário do evento

### Autorização para sincronizar

| Operação | Role mínimo |
|----------|-------------|
| Conectar Google | VOLUNTARIO (própria conta) |
| Desconectar Google | VOLUNTARIO (própria conta) |
| Sincronizar evento | ADMIN da igreja do evento |
| Criar via sync | ADMIN da igreja do evento |

## 7. Tokens

### Onde armazenar

| Token | Local | Criptografia |
|-------|-------|--------------|
| `access_token` | Backend (DB) | AES-256 |
| `refresh_token` | Backend (DB) | AES-256 |
| `expires_at` | Backend (DB) | Texto claro |

### Regras

1. **Nunca** armazenar tokens no frontend (localStorage, sessionStorage, cookies)
2. Tokens ficam **apenas** no backend
3. Frontend só conhece o status (conectado/desconectado)
4. Renovação é transparente para o usuário

### Renovação do access_token

```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

client_id={GOOGLE_CLIENT_ID}
&client_secret={GOOGLE_CLIENT_SECRET}
&refresh_token={REFRESH_TOKEN}
&grant_type=refresh_token
```

O `googleapis` Node.js library gerencia isso automaticamente via `setCredentials()`.

### Revogação

```
POST https://oauth2.googleapis.com/revoke
  ?token={ACCESS_TOKEN_OR_REFRESH_TOKEN}
```

Ou via `google.auth.revokeCredentials()`.

### Expiração

| Token | Expiração | Renovação |
|-------|-----------|-----------|
| `access_token` | 1 hora | Automática via refresh_token |
| `refresh_token` | 6 meses sem uso | Re-autorização necessária |

## 8. Modelo de dados proposto

### Tabela: GoogleCalendarConnection

```prisma
model GoogleCalendarConnection {
  id                String   @id @default(uuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  googleAccountId   String?  // email ou ID da conta Google
  accessTokenEnc    String   // access_token criptografado (AES-256)
  refreshTokenEnc   String   // refresh_token criptografado (AES-255)
  expiresAt         DateTime // timestamp da expiração do access_token
  scope             String   // scopes autorizados
  calendarId        String?  // "primary" ou ID específico
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([userId]) // uma conexão por usuário
  @@index([userId])
}
```

### Campo na tabela Event

```prisma
model Event {
  // ... campos existentes
  googleCalendarEventId  String?  // ID do evento no Google Calendar
  googleCalendarSyncedAt DateTime? // último sync timestamp
}
```

### Comparação de abordagens

| Critério | A) Campos em Event | B) Tabela separada |
|----------|--------------------|--------------------|
| Simplicidade | Simples | Mais complexo |
| Recorrência | Difícil (52 eventos) | Fácil (1:1) |
| Exclusão | Limpar campo | Deletar registro |
| Auditoria | Limitada | Completa |
| Múltiplos calendários | Não suporta | Suporta |
| Múltiplas contas | Não suporta | Suporta |
| Evolução futura | Limitada | Flexível |

**Recomendação**: Abordagem B (tabela separada para conexão + campo em Event para referência).

## 9. Estratégia de sincronização

### Abordagem escolhida: Síncrona com fallback assíncrono

```
Operação Escala Fácil
    ↓
Salvar localmente (Prisma)
    ↓
Tentar sincronizar com Google
    ↓
Sucesso → OK
Falha → Registrar erro, permitir retry manual
```

### Justificativa

| Abordagem | Vantagem | Desvantagem |
|-----------|----------|-------------|
| Síncrona | Consistência imediata | Bloqueia se Google cair |
| Assíncrona | Não bloqueia | Complexidade de fila |
| **Síncrona + fallback** | **Simples + resiliente** | **Erros precisam de retry** |

### Para MVP

A operação local do Escala Fácil **nunca** deve ficar indisponível por causa do Google Calendar. Se a sincronização falhar:
1. Evento é salvo localmente
2. Erro é registrado
3. Usuário pode retry manualmente
4. Próxima operação tenta sincronizar novamente

## 10. Event → Google Calendar

### Mapeamento de campos

| Escala Fácil | Google Calendar | Observação |
|--------------|-----------------|------------|
| `Event.nome` | `summary` | Nome do evento |
| `Event.descricao` | `description` | Descrição |
| `Event.dataInicio` | `start.dateTime` | RFC 3339 com timezone |
| `Event.dataFim` | `end.dateTime` | RFC 3339 com timezone |
| `Event.igreja.endereco` | `location` | Opcional |
| `Event.id` | `extendedProperties.private.escalaEventId` | Identificação |
| `Event.recurrenceGroupId` | `extendedProperties.private.escalaGroupId` | Para séries |

### Timezone

Eventos do Escala Fácil possuem instante absoluto (DateTime UTC). No Google Calendar:

```json
{
  "start": {
    "dateTime": "2026-09-11T19:00:00-03:00",
    "timeZone": "America/Sao_Paulo"
  },
  "end": {
    "dateTime": "2026-09-11T21:00:00-03:00",
    "timeZone": "America/Sao_Paulo"
  }
}
```

A timezone deve ser obtida do contexto da igreja (futuro: campo `timezone` no Church).

### Extended Properties

O Google Calendar permite armazenar metadados privados em eventos:

```json
{
  "extendedProperties": {
    "private": {
      "escalaEventId": "uuid-do-evento",
      "escalaGroupId": "uuid-do-grupo-recorrencia",
      "escalaChurchId": "uuid-da-igreja"
    }
  }
}
```

Limitações:
- Chave máxima: 44 caracteres
- Valor máximo: 1024 caracteres
- Máximo de 300 propriedades por evento

## 11. Identificação e idempotência

### Como evitar duplicidade

O campo `googleCalendarEventId` no Event indica se já foi sincronizado:

```
Event.googleCalendarEventId == null → não sincronizado
Event.googleCalendarEventId != null → já sincronizado
```

### Regras de idempotência

| Cenário | Comportamento |
|---------|---------------|
| Criar evento sem sync | Criar local + sync com Google |
| Criar evento que já tem sync | Atualizar no Google |
| Sincronizar evento já sincronizado | Atualizar no Google |
| Evento Google removido manualmente | Recriar no Google |
| Conexão Google perdida | Marcar erro, permitir retry |

### Extended Properties para busca

Para encontrar eventos do Escala Fácil no Google Calendar:

```
GET /calendars/primary/events
  ?privateExtendedProperty=escalaEventId%3D{eventId}
```

## 12. CREATE

### Fluxo

```
1. Usuário cria evento no Escala Fácil
2. Evento é salvo no banco (Prisma)
3. Backend verifica se há conexão Google para o usuário
4. Se não há conexão → retorna evento local (OK)
5. Se há conexão:
   6. Montar payload Google Calendar
   7. Chamar POST /calendars/{calendarId}/events
   8. Salvar googleCalendarEventId no Event
   9. Retornar evento local com referência Google
```

### Payload Google

```json
{
  "summary": "Culto Domingo Manhã",
  "description": "Celebração dominical da manhã\n\nEvento criado pelo Escala Fácil",
  "start": {
    "dateTime": "2026-09-13T09:00:00-03:00",
    "timeZone": "America/Sao_Paulo"
  },
  "end": {
    "dateTime": "2026-09-13T11:00:00-03:00",
    "timeZone": "America/Sao_Paulo"
  },
  "extendedProperties": {
    "private": {
      "escalaEventId": "uuid-do-evento",
      "escalaChurchId": "uuid-da-igreja"
    }
  }
}
```

## 13. UPDATE

### Fluxo

```
1. Usuário atualiza evento no Escala Fácil
2. Evento é atualizado no banco
3. Backend verifica googleCalendarEventId
4. Se não há referência Google → retorna (OK, sem sync)
5. Se há referência Google:
   6. Verificar se evento ainda existe no Google
   7. Se existe → PATCH /calendars/{calendarId}/events/{eventId}
   8. Se não existe → recriar e atualizar referência
   9. Se falha → registrar erro, permitir retry
```

### Comportamento quando evento Google não existe

| Cenário | Ação |
|---------|------|
| Evento foi deletado no Google | Recriar no Google |
| Evento foi movido para outro calendário | Recriar no Google |
| Conexão Google foi revogada | Marcar erro, solicitar reconexão |
| Google API retornou 404 | Recriar no Google |

### Retry

Se a atualização falhar:
1. Evento permanece atualizado localmente
2. Erro é registrado
3. Usuário pode retry manualmente
4. Próxima operação tenta sincronizar

## 14. DELETE

### Fluxo

```
1. Usuário exclui evento no Escala Fácil
2. Backend verifica googleCalendarEventId
3. Se não há referência Google → excluir local (OK)
4. Se há referência Google:
   5. Chamar DELETE /calendars/{calendarId}/events/{eventId}
   6. Se sucesso → excluir local
   7. Se 404 → excluir local (já não existe no Google)
   8. Se outro erro → registrar, excluir local, informar usuário
```

### Decisão: exclusão local sempre occurs

A exclusão local **sempre** acontece, independentemente do sucesso da exclusão no Google. Justificativa:
- O usuário solicitou exclusão
- Não podemos deixar o evento "preso" por causa de falha do Google
- Eventos excluídos no Google podem ser recuperados por 30 dias (Google trash)

### Para MVP

Exclusão no Google é melhor-effort. Se falhar, o evento é excluído localmente e o usuário é informado.

## 15. Falhas e retries

### Cenários de falha

| Cenário | Ação | Retry |
|---------|------|-------|
| Google API indisponível | Registrar erro | Manual |
| Token expirado | Renovar automaticamente | Automático |
| Refresh token inválido | Solicitar reconexão | Manual |
| Evento Google removido | Recriar | Automático |
| Usuário desconectou | Parar sync | N/A |
| Rate limit (429) | Exponential backoff | Automático (3 tentativas) |
| Timeout | Retry com backoff | Automático (2 tentativas) |

### Exponential backoff

```
wait_time = min((2^n + random(0,1000)), 32000)
```

- 1ª tentativa: ~1s
- 2ª tentativa: ~2s
- 3ª tentativa: ~4s
- Máximo: 32s

### Regra principal

**A operação local do Escala Fácil NUNCA deve ficar indisponível por causa do Google Calendar.**

Se o Google estiver indisponível:
1. Evento é salvo/atualizado/excluído localmente
2. Erro de sincronização é registrado
3. Usuário vê indicador "pendente de sincronização"
4. Retry disponível via botão ou próximo acesso

## 16. Recorrência

### Estado atual

O Escala Fácil trata cada ocorrência como `Event` independente:
- Série de 4 domingos = 4 Events com mesmo `recurrenceGroupId`
- Cada ocorrência pode ser editada/excluída individualmente

### Representação no Google Calendar

| Abordagem | Descrição | Compatível com modelo atual? |
|-----------|-----------|------------------------------|
| A) 52 eventos individuais | Criar 52 Events separados | **Sim** |
| B) Evento recorrente RRULE | Criar 1 evento com RRULE | Parcialmente |

### Análise

**Abordagem A (52 eventos individuais)**:
- ✅ Compatível com o modelo atual (cada ocorrência é independente)
- ✅ Edição individual funciona naturalmente
- ✅ Exclusão individual funciona naturalmente
- ❌ Muitos eventos no Google Calendar
- ❌ Não usa a funcionalidade nativa de recorrência do Google

**Abordagem B (RRULE)**:
- ✅ Usa funcionalidade nativa do Google
- ✅ Menos eventos no Google Calendar
- ❌ Edição individual requer exceção (EXDATE + novo evento)
- ❌ Exclusão individual requer exceção
- ❌ Complexidade significativamente maior

### Recomendação para MVP

**Abordagem A**: Criar eventos individuais no Google Calendar.

Justificativa:
- Compatível direta com o modelo atual do Escala Fácil
- Edição/exclusão individual funciona sem complexidade
- O Google Calendar suporta até 250.000 eventos por calendário
- 52 eventos por série é aceitável

### Futuro (Fase 2)

Avaliar RRULE se:
- Usuários reportarem muitos eventos no Google
- Necessidade de sincronização bidirecional
- Exceções de recorrência forem necessárias

## 17. Permissões

### Quem pode conectar

| Operação | Role mínimo | Restrição |
|----------|-------------|-----------|
| Conectar Google | VOLUNTARIO | Própria conta |
| Desconectar Google | VOLUNTARIO | Própria conta |
| Ver status de conexão | VOLUNTARIO | Própria conta |
| Sincronizar evento | ADMIN | Evento da mesma igreja |
| Criar evento via sync | ADMIN | Evento da mesma igreja |
| Excluir evento via sync | ADMIN | Evento da mesma igreja |

### Regras de negócio

1. **Um usuário pode ter apenas uma conexão Google** (constraint `@@unique([userId])`)
2. **A conexão pertence ao usuário**, não à igreja
3. **Vários usuários da mesma igreja podem ter conexões diferentes**
4. **MASTER_ADMIN pode ver status de conexão de qualquer usuário**
5. **MASTER_PLATFORM_ADMIN pode gerenciar todas as conexões**

### Validação em cada operação

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

## 18. Desconexão

### O que acontece quando o usuário clica "Desconectar Google Calendar"

1. **Revogar token no Google**:
   ```
   POST https://oauth2.googleapis.com/revoke
     ?token={refresh_token}
   ```

2. **Remover conexão local**:
   ```sql
   DELETE FROM GoogleCalendarConnection WHERE userId = {userId}
   ```

3. **Limpar referências em eventos** (opcional):
   ```sql
   UPDATE Event
   SET googleCalendarEventId = NULL, googleCalendarSyncedAt = NULL
   WHERE id IN (SELECT eventId FROM ... WHERE userId = {userId})
   ```

4. **Parar sincronizações futuras**

### Decisão para MVP

| Ação | Decisão |
|------|---------|
| Revogar token | Sim |
| Remover conexão local | Sim |
| Manter IDs dos eventos Google | Não (limpar) |
| Parar sync futuras | Sim |

### Eventos já criados no Google

Após desconexão, os eventos já criados no Google Calendar permanecem lá (o usuário pode acessá-los normalmente). O Escala Fácil perde a referência e não poderá mais sincronizá-los.

## 19. API proposta

### Endpoints

| Método | Path | Descrição | Auth |
|--------|------|-----------|------|
| `GET` | `/integrations/google/status` | Status da conexão | JWT |
| `GET` | `/integrations/google/connect` | Gerar URL de autorização | JWT |
| `GET` | `/integrations/google/callback` | Callback do OAuth | Público (state) |
| `POST` | `/integrations/google/disconnect` | Desconectar Google | JWT |
| `POST` | `/events/:id/google/sync` | Sincronizar evento | JWT + ADMIN |
| `DELETE` | `/events/:id/google/sync` | Remover sync de evento | JWT + ADMIN |
| `GET` | `/events/:id/google/link` | Obter link do evento Google | JWT |

### Detalhes

**GET /integrations/google/status**
```json
// Response 200
{
  "connected": true,
  "googleAccountId": "user@gmail.com",
  "calendarId": "primary",
  "connectedAt": "2026-09-11T10:00:00Z",
  "lastSyncAt": "2026-09-11T15:30:00Z"
}
```

**GET /integrations/google/connect**
```json
// Response 200
{
  "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

**GET /integrations/google/callback?code=...&state=...**
```
// Response 302 redirect
// Sucesso: /settings?google=connected
// Erro: /settings?google=error
```

**POST /events/:id/google/sync**
```json
// Response 200
{
  "googleCalendarEventId": "abc123",
  "googleCalendarLink": "https://calendar.google.com/calendar/event?eid=...",
  "syncedAt": "2026-09-11T15:30:00Z"
}
```

## 20. Frontend proposto

### Localização dos elementos

| Elemento | Localização | Justificativa |
|----------|-------------|---------------|
| "Conectar Google Calendar" | Página de Configurações da Igreja | Configuração de integração |
| Status da conexão | Página de Configurações | Visão geral |
| "Desconectar" | Página de Configurações | Ação de configuração |
| Sincronizar evento | Modal de edição do evento | Ação no evento |
| Link para Google | Detalhe do evento | Acesso rápido |
| Indicador "sincronizado" | Card do evento na lista | Status visual |

### Componentes

```
SettingsPage
├── GoogleCalendarSection
│   ├── ConnectButton ("Conectar Google Calendar")
│   ├── StatusBadge (Conectado/Desconectado)
│   ├── AccountInfo (email da conta Google)
│   └── DisconnectButton ("Desconectar")

EventModal
├── GoogleCalendarSync
    ├── SyncButton ("Sincronizar com Google")
    ├── SyncStatus (Sincronizado/Pendente/Erro)
    └── GoogleLink (Abrir no Google Calendar)
```

### Fluxo de conexão

```
1. Usuário clica "Conectar Google Calendar"
2. Frontend chama GET /integrations/google/connect
3. Frontend redireciona para authorizationUrl
4. Google exibe consentimento
5. Usuário autoriza
6. Google redireciona para /integrations/google/callback
7. Backend processa callback
8. Backend redireciona para /settings?google=connected
9. Frontend exibe "Conectado com sucesso"
```

## 21. Variáveis de ambiente

### Necessárias

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `GOOGLE_CLIENT_ID` | ID do cliente OAuth | Sim |
| `GOOGLE_CLIENT_SECRET` | Segredo do cliente OAuth | Sim |
| `GOOGLE_REDIRECT_URI` | URI de callback | Sim |
| `GOOGLE_ENCRYPTION_KEY` | Chave AES-256 para tokens | Sim |

### Desenvolvimento vs Produção

| Variável | Development | Production |
|----------|-------------|------------|
| `GOOGLE_CLIENT_ID` | ID de teste | ID de produção |
| `GOOGLE_CLIENT_SECRET` | Segredo de teste | Segredo de produção |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3000/integrations/google/callback` | `https://api.escalafacil.coderonin.com.br/integrations/google/callback` |
| `GOOGLE_ENCRYPTION_KEY` | Chave de teste (32 bytes) | Chave de produção (32 bytes) |

### Segredos

- **NUNCA** committar no Git
- Usar variáveis de ambiente ou secret manager
- Coolify: configurar via UI de variáveis de ambiente
- Produção: considerar usar Coolify secrets ou vault

## 22. Coolify

### Configuração atual

| Serviço | URL |
|---------|-----|
| Frontend | `app.escalafacil.coderonin.com.br` |
| Backend | `api.escalafacil.coderonin.com.br` |

### OAuth callback

| Ambiente | Redirect URI |
|----------|--------------|
| Development | `http://localhost:3000/integrations/google/callback` |
| Production | `https://api.escalafacil.coderonin.com.br/integrations/google/callback` |

### No Google Cloud Console

1. Criar OAuth 2.0 Client ID (tipo: Web application)
2. Adicionar Authorized redirect URIs:
   - `http://localhost:3000/integrations/google/callback` (dev)
   - `https://api.escalafacil.coderonin.com.br/integrations/google/callback` (prod)

### HTTPS

O Coolify já configura HTTPS automaticamente via Let's Encrypt. O callback usará HTTPS em produção.

### Variáveis no Coolify

Configurar na UI do Coolify:
- `GOOGLE_CLIENT_ID` (Secret)
- `GOOGLE_CLIENT_SECRET` (Secret)
- `GOOGLE_REDIRECT_URI` (Variable)
- `GOOGLE_ENCRYPTION_KEY` (Secret)

## 23. Auditoria e logs

### Logs necessários

| Evento | Nível | Dados |
|--------|-------|-------|
| Conexão criada | INFO | userId, googleAccountId, calendarId |
| Conexão revogada | INFO | userId |
| Token renovado | DEBUG | userId |
| Sincronização iniciada | DEBUG | userId, eventId |
| Sincronização concluída | INFO | userId, eventId, action |
| Erro de sincronização | ERROR | userId, eventId, errorCode, errorMessage |
| Rate limit atingido | WARN | userId, retryAfter |

### AuditLog

Integrar com o `AuditLog` existente:

```typescript
// Exemplo de entrada
{
  userId: "user-uuid",
  churchId: "church-uuid",
  action: "GOOGLE_CALENDAR_SYNC",
  module: "INTEGRATIONS",
  targetId: "event-uuid",
  newValue: { googleCalendarEventId: "google-event-id" }
}
```

### O que NÃO registrar

- ❌ access_token
- ❌ refresh_token
- ❌ client_secret
- ❌ Códigos de autorização

## 24. Segurança e privacidade

### Princípios

1. **Menor privilégio**: Solicitar apenas o escopo necessário
2. **Defesa em profundidade**: Múltiplas camadas de validação
3. **Transparência**: Usuário sabe o que o app acessa
4. **Controle**: Usuário pode desconectar a qualquer momento
5. **Isolamento**: Tokens de um usuário não são acessíveis por outro

### Checklist de segurança

- [ ] OAuth state validado no callback
- [ ] Tokens criptografados no banco
- [ ] Tokens nunca expostos ao frontend
- [ ] Validação userId antes de cada operação
- [ ] Validação churchId para eventos
- [ ] Logs sem dados sensíveis
- [ ] Revogação de token na desconexão
- [ ] Rate limiting nas rotas de integração
- [ ] HTTPS obrigatório em produção

### LGPD

- Informar ao usuário quais dados são acessados
- Permitir desconexão e exclusão de dados
- Não compartilhar tokens com terceiros
- Documentar finalidade do acesso

## 25. Fases de implementação

### Fase 8.1 — Arquitetura e análise (ATUAL)
- Análise técnica completa
- Definição de arquitetura
- Documentação

### Fase 8.2 — Google Cloud Console + OAuth
- Criar projeto no Google Cloud Console
- Configurar OAuth consent screen
- Criar OAuth 2.0 Client ID
- Configurar variáveis de ambiente

### Fase 8.3 — Backend OAuth
- Implementar `GoogleCalendarModule`
- Implementar `GET /integrations/google/connect`
- Implementar `GET /integrations/google/callback`
- Implementar `GET /integrations/google/status`
- Implementar `POST /integrations/google/disconnect`
- Implementar renovação de token

### Fase 8.4 — Persistência segura da conexão
- Criar migration `GoogleCalendarConnection`
- Implementar criptografia de tokens (AES-256)
- Implementar service de conexão

### Fase 8.5 — Frontend conectar/desconectar
- Criar `GoogleCalendarSection` nas configurações
- Implementar fluxo de conexão
- Implementar status da conexão
- Implementar desconexão

### Fase 8.6 — CREATE → Google Calendar
- Implementar `POST /events/:id/google/sync`
- Implementar criação de evento no Google
- Implementar extended properties
- Salvar referência no Event

### Fase 8.7 — UPDATE → Google Calendar
- Implementar atualização de evento no Google
- Tratar evento não encontrado (recriar)
- Implementar retry em caso de falha

### Fase 8.8 — DELETE → Google Calendar
- Implementar exclusão de evento no Google
- Tratar exclusão local mesmo com falha Google
- Limpar referência no Event

### Fase 8.9 — Recorrência Google
- Decidir entre eventos individuais vs RRULE
- Implementar sync de séries
- Tratar edição/exclusão individual

### Fase 8.10 — Retries e observabilidade
- Implementar exponential backoff
- Implementar logs de sincronização
- Integrar com AuditLog
- Implementar indicadores de status

### Fase 8.11 — Testes completos
- Testes unitários de cada service
- Testes de integração com Google API mock
- Testes de OAuth flow
- Testes de criptografia
- Testes de multi-tenancy

## 26. Decisões arquiteturais

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| OAuth flow | Authorization Code + Refresh Token | Padrão para web apps, tokens no backend |
| Scope | `calendar` | Menor escopo que permite CRUD completo |
| Storage de tokens | Backend (DB criptografado) | Segurança, tokens nunca no frontend |
| Sincronização | Síncrona com fallback | Simples, não bloqueia operação local |
| Recorrência | Eventos individuais (Fase 1) | Compatível com modelo atual |
| Identificação | extendedProperties.private | Mecanismo oficial do Google |
| Tabela de conexão | GoogleCalendarConnection separada | Flexibilidade, auditoria, multi-conta |
| Referência no Event | googleCalendarEventId + googleCalendarSyncedAt | Simples, busca rápida |
| Exclusão | Local sempre + Google melhor-effort | Usuário nunca fica preso por falha Google |
| Concorrência | Race condition documentada | Sem constraint avançada no PostgreSQL |

## 27. Riscos

### Risco técnico

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Google revoga acesso | Baixa | Alto | Retry + reconexão manual |
| Rate limit atingido | Média | Médio | Exponential backoff |
| Token expirado durante operação | Alta | Baixo | Renovação automática |
| Evento removido no Google | Média | Baixo | Recriar automaticamente |
| Mudança na API Google | Baixa | Alto | Versionamento da API |
| Race condition na sync | Média | Baixo | Documentar limitação |

### Risco de negócio

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Usuário não autoriza | Alta | Baixo | Funcionalidade opcional |
| Google muda política de OAuth | Baixa | Médio | Acompanhar documentação |
| Custo de API (se billing) | Baixa | Baixo | 10.000 req/min gratuitas |

### Limitações documentadas

1. **Race condition**: Dois usuários sincronizando o mesmo evento simultaneamente podem causar conflito
2. **Sem sync bidirecional**: Alterações no Google não são refletidas no Escala Fácil
3. **Sem exceções de recorrência**: Edição individual de ocorrência cria novo evento no Google
4. **Um usuário, uma conexão**: Não suporta múltiplas contas Google

## 28. Conclusão

A arquitetura para integração com Google Calendar foi definida com foco em:

- **Segurança**: Tokens criptografados no backend, nunca no frontend
- **Simplicidade**: OAuth Authorization Code Flow, sincronização síncrona
- **Resiliência**: Operação local nunca depende do Google
- **Compatibilidade**: Eventos individuais, modelo atual preservado
- **Evolução**: Estrutura preparada para Fase 2 (RRULE, sync bidirecional)

### Decisões principais

1. Backend é responsável pelo fluxo OAuth completo
2. Scope `calendar` para CRUD completo
3. Tokens armazenados criptografados no banco
4. Sincronização síncrona com fallback
5. Extended properties para identificação
6. Um usuário = uma conexão Google
7. Exclusão local sempre, Google melhor-effort

### Próxima etapa recomendada

**8.2 — Google Cloud Console + OAuth**: Criar projeto no Google Cloud, configurar OAuth consent screen, criar credenciais, e testar fluxo de autorização.

---

**NÃO implementado (conforme especificado):**
- código
- schema Prisma
- DTOs
- endpoints
- frontend
- OAuth configuração
- credenciais Google
- deploy
- commit
- dependências
