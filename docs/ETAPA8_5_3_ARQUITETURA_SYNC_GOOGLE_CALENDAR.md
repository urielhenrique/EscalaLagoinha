# Etapa 8.5.3 — Arquitetura de Sincronização com Google Calendar

## 1. Objetivo

Definir a arquitetura, contrato e decisões técnicas para sincronizar eventos criados no Escala Fácil com o Google Calendar do usuário, mantendo o sistema como **LOCAL-FIRST**.

## 2. Estado atual

### 2.1 O que existe

| Componente | Status |
|------------|--------|
| Prisma schema `Event` | Completo, sem campos de sync |
| Prisma schema `GoogleCalendarConnection` | Completo, com `calendarId` (placeholder, nunca escrito) |
| OAuth flow (connect/callback/disconnect) | Funcional (Etapa 8.5.1) |
| Frontend GoogleCalendarSection | Funcional (Etapa 8.5.2) |
| `refreshAccessToken()` | Funcional, com buffer de 5min |
| Encryption (AES-256-GCM) | Funcional |
| `AuditLogsService` | Funcional, usado por SchedulesService |

### 2.2 O que NÃO existe

- Nenhum campo `googleEventId` em nenhuma tabela
- Nenhum campo `syncStatus`, `lastSyncedAt`, `syncError` em nenhuma tabela
- Nenhum código que chame Google Calendar Events API (criar/editar/excluir)
- Nenhum endpoint de sincronização
- Nenhum log de auditoria para operações Google

### 2.3 Modelo de dados relevante

```prisma
model Event {
  id                String          @id @default(uuid())
  nome              String
  descricao         String
  churchId          String?
  dataInicio        DateTime
  dataFim           DateTime
  recurrenceGroupId String?
  recurrenceType    RecurrenceType  @default(NONE)
  recurrenceDays    String[]
  recurrenceStart   DateTime?
  recurrenceEnd     DateTime?
  recurrenceIndex   Int?
  // SEM googleEventId, SEM syncStatus
}

model GoogleCalendarConnection {
  id              String   @id @default(uuid())
  userId          String   @unique
  googleAccountId String?
  accessTokenEnc  String
  refreshTokenEnc String
  expiresAt       DateTime
  scope           String
  calendarId      String?  // Nunca escrito pelo código atual
}
```

### 2.4 Recorrência

- Cada ocorrência é uma `Event` row independente
- Vinculadas por `recurrenceGroupId` (UUID compartilhado)
- Máximo 52 ocorrências por série
- Edição: apenas ocorrência individual (não propaga para a série)
- Exclusão: apenas ocorrência individual

### 2.5 Timezone

- Backend: tudo em UTC (`getUTCDay()`, `setUTCHours()`, etc.)
- Frontend: `Intl.DateTimeFormat("pt-BR")` (usa timezone do browser)
- Nenhuma referência explícita a `America/Sao_Paulo`
- Nenhuma biblioteca de data importada diretamente

### 2.6 Multi-tenancy

- `Event.churchId` → FK para `Church`
- `Schedule.churchId` → FK para `Church`
- JWT carrega `churchId`
- Todas as queries filtram por `churchId`
- `GoogleCalendarConnection` é por `userId` (1:1), não por `churchId`

## 3. Responsável pela sincronização

### Decisão: **O usuário autenticado que possui conexão Google ativa**

**Justificativa:**

- `GoogleCalendarConnection` é vinculada a `userId` (1:1 via `@@unique`)
- Um usuário pode ser membro de uma igreja (`churchId`) mas a conexão Google é individual
- O evento é da igreja (`churchId`), mas a sincronização vai para o calendário pessoal do usuário
- Portanto, **qualquer usuário autenticado com conexão Google ativa pode sincronizar eventos da sua igreja**

**Regra de autorização:**

1. Usuário deve estar autenticado (JWT válido)
2. Usuário deve ter `GoogleCalendarConnection` ativa (tokens válidos)
3. Evento deve pertencer à mesma `churchId` do usuário
4. Para operações de CRUD de evento: o ADMIN/MASTER_ADMIN já tem permissão (controlado por `@Roles` no controller)

**Fluxo de decisão:**

```
Usuário cria evento
  → EventsService.create() já extrai churchId do JWT
  → Após commit local, verifica se o USUÁRIOROLE tem GoogleCalendarConnection
  → Se SIM: agenda sincronização assíncrona
  → Se NÃO: evento criado normalmente (sem sync)
```

**Nota:** A sincronização é feita pelo usuário que está realizando a operação, não por um "service account" ou "system user". Isso é coerente com o modelo atual onde cada voluntário tem seu próprio Google Calendar.

## 4. Calendário destino

### Decisão: **Usar `"primary"` como padrão, com suporte futuro a `calendarId`**

**Análise:**

- O campo `calendarId` já existe em `GoogleCalendarConnection` mas nunca é escrito
- Durante o OAuth flow, o scope é `calendar.events` (não `calendar.readonly` nem `calendar`)
- Para listar calendários do usuário, seria necessário o scope `calendar.readonly` adicional

**Contrato proposto:**

| Situação | Comportamento |
|----------|---------------|
| `calendarId` é `null` | Usa `"primary"` (calendário padrão do usuário Google) |
| `calendarId` tem valor | Usa o `calendarId` especificado |
| Calendário não existe mais | Google retorna 404 → tratamento de erro (ver seção 13) |

**Seleção de calendário:** Não implementada nesta etapa. O campo `calendarId` continua opcional. Em etapa futura, pode-se:
1. Adicionar scope `calendar.readonly` ao OAuth
2. Criar endpoint `GET /integrations/google/calendars` para listar calendários
3. Criar endpoint `PATCH /integrations/google/calendar` para selecionar

## 5. Identificação do evento Google

### Decisão: **Campo `googleEventId` na entidade `Event` + `extendedProperties.private`**

**Não existe atualmente.** Será necessário migration futura.

**Campo recomendado:**

```prisma
model Event {
  // ... campos existentes ...
  googleEventId     String?
  googleSyncStatus  GoogleSyncStatus @default(NONE)
  lastSyncedAt      DateTime?
  googleSyncError   String?
}

enum GoogleSyncStatus {
  NONE
  PENDING
  SYNCED
  ERROR
}
```

**Relação com Event:**

- `Event.googleEventId` → ID retornado pela Google Calendar API após criação
- Um Event pode ter 0 ou 1 `googleEventId`
- Recorrência: cada ocorrência (Event row) tem seu próprio `googleEventId`

**extendedProperties.private** (no Google Calendar Event):

```json
{
  "source": "escala-facil",
  "eventId": "<Event.id do Escala Fácil>",
  "churchId": "<Event.churchId>",
  "recurrenceGroupId": "<Event.recurrenceGroupId ou vazio>"
}
```

**Por que `extendedProperties.private`:**

- Visível apenas para a aplicação que o criou
- Permite identificar que o evento veio do Escala Fácil
- Permite buscar eventos por `eventId` para evitar duplicação
- Não expõe dados sensíveis em calendários compartilhados

## 6. Criação

### Decisão: **Pós-commit local, síncrono com tratamento de falha assíncrono**

**Fluxo:**

```
1. Usuário cria evento no frontend
2. Frontend chama POST /events (via api client com JWT)
3. EventsService.create() valida e cria Event no banco (commit local)
4. APÓS commit bem-sucedido:
   a. Verifica se usuário tem GoogleCalendarConnection ativa
   b. Se SIM: tenta criar evento no Google Calendar
   c. Se criado com sucesso: salva googleEventId no Event
   d. Se falhou: marca googleSyncStatus = ERROR, salva googleSyncError
5. Retorna resposta ao frontend (evento criado com ou sem sync)
```

**Por que pós-commit:**

- A operação local NÃO pode depender do Google
- Se o Google estiver indisponível, o evento continua existindo
- O `googleEventId` só pode ser obtido após o Google criar o evento

**Tratamento de falha na criação Google:**

- `googleSyncStatus` = `ERROR`
- `googleSyncError` = mensagem do erro (truncada para 500 chars)
- Usuário pode tentar sincronizar novamente manualmente (resync)
- Nenhum toast de erro é mostrado automaticamente (operação local bem-sucedida)

**Idempotência na criação:**

- Antes de criar, busca eventos existentes via `extendedProperties.private.eventId = Event.id`
- Se já existe: atualiza `googleEventId` e retorna (evita duplicação por retry)
- Se não existe: cria normalmente

## 7. Atualização

### Decisão: **Atualização síncrona pós-commit, com busca por `googleEventId`**

**Fluxo:**

```
1. Usuário edita evento
2. Frontend chama PATCH /events/:id
3. EventsService.update() atualiza Event no banco
4. APÓS commit:
   a. Verifica se Event tem googleEventId
   b. Se NÃO tem: ignora (nunca foi sincronizado)
   c. Se TEM: busca evento no Google via googleEventId
   d. Atualiza no Google Calendar
   e. Se Google retorna 404: remove googleEventId, marca como NONE
   f. Se falhou: mantém googleSyncStatus = ERROR
```

**Tratamento de cenários especiais:**

| Cenário | Comportamento |
|---------|---------------|
| Evento Google excluído manualmente | Google retorna 404 → remove `googleEventId`, `googleSyncStatus` = `NONE` |
| Token expirado | `refreshAccessToken()` tenta refresh; se falhar → `googleSyncStatus` = `ERROR` |
| Usuário desconectou Google | `GoogleCalendarConnection` não existe → ignora sync |
| Calendário não existe | Google retorna 404 → tratamento igual "evento excluído" |
| Permissão negada | Google retorna 403 → `googleSyncStatus` = `ERROR` |

## 8. Exclusão

### Decisão: **Exclusão local primeiro, depois tenta remover do Google**

**Fluxo:**

```
1. Usuário exclui evento
2. Frontend chama DELETE /events/:id
3. EventsService.remove() exclui Event do banco
4. APÓS commit:
   a. Verifica se Event tinha googleEventId
   b. Se SIM: tenta deletar evento no Google via googleEventId
   c. Se Google retorna 404: ignorar (já foi removido)
   d. Se falhou: ignorar (evento local já excluído)
```

**Nota:** O `Schedule` associado ao Event pode ter FK constraint. O código atual já trata isso com try/catch no `P2003`.

**Por que local primeiro:**

- A exclusão local é a operação primária
- Se o Google falhar, o evento já não existe localmente
- O evento "fantasma" no Google Calendar eventualmente será removido pelo usuário manualmente
- Não há risco de dados inconsistentes (fonte de verdade é local)

## 9. Recorrência

### Decisão: **OPÇÃO A — cada ocorrência local = um Google Event independente**

**Comparação:**

| Critério | Opção A (independentes) | Opção B (recorrência nativa Google) |
|----------|------------------------|-------------------------------------|
| Simplicidade | Alta — cada row = 1 Google Event | Baixa — precisa mapear série |
| Rastreabilidade | Cada ocorrência tem googleEventId próprio | Série inteira = 1 googleEventId |
| Edição individual | Natural — edita ocorrência individual | Complexo — precisa de exceções no Google |
| Exclusão individual | Natural — deleta Google Event individual | Complexo — precisa de exceções no Google |
| Consistência com modelo atual | Perfeita — modelo já é row-per-occurrence | Incompatível — exigiria refatoração |
| Limite Google | Máx 255 ocorrências por série (OK, temos max 52) | Sem limite |

**Justificativa:**

O sistema atual já cria ocorrências independentes (row-per-occurrence). Criar uma recorrência nativa no Google exigiria:
1. Mapear `recurrenceGroupId` → 1 Google Event com RRULE
2. Lidar com edições individuais via exceções (`recurrenceException`)
3. Lidar com exclusões individuais via exceções
4. Sincronizar estado bidirecional (complicado)

**Opção A é claramente superior** para a arquitetura atual.

**Fluxo para série recorrente:**

```
1. Usuário cria evento recorrente (ex: todo Domingo por 3 meses)
2. Backend cria N Event rows (uma por ocorrência), cada uma com recurrenceGroupId
3. Para CADA ocorrência criada:
   a. Verifica se usuário tem GoogleCalendarConnection
   b. Cria Google Event individual
   c. Salva googleEventId naquela ocorrência específica
4. Resultado: N Google Events independentes no calendário do usuário
```

## 10. Timezone

### Decisão: **Usar ISO 8601 com UTC, converter para `America/Sao_Paulo` no Google API**

**Situação atual:**

- Backend armazena tudo em UTC
- Frontend formata com `Intl.DateTimeFormat("pt-BR")` (timezone do browser)
- Usuários estão em `America/Sao_Paulo` (UTC-3)

**Contrato de conversão:**

```
Event.dataInicio (UTC no banco)
  → new Date(event.dataInicio).toISOString()  // "2026-09-12T22:00:00.000Z"
  → Google Calendar API aceita ISO 8601 com timezone:
     "2026-09-12T19:00:00-03:00"
  → OU: enviar como UTC e deixar o Google ajustar
```

**Recomendação:**

Enviar como **ISO 8601 sem timezone** (formato que o Google aceita como "floating time"):

```json
{
  "start": { "dateTime": "2026-09-12T19:00:00", "timeZone": "America/Sao_Paulo" },
  "end": { "dateTime": "2026-09-12T21:00:00", "timeZone": "America/Sao_Paulo" }
}
```

**Conversão:**

```typescript
function toGoogleDateTime(utcIso: string): { dateTime: string; timeZone: string } {
  // Converter UTC para horário de São Paulo
  const date = new Date(utcIso);
  // Usar Intl para formatar no timezone desejado
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  return {
    dateTime: formatter.format(date).replace(" ", "T"),
    timeZone: "America/Sao_Paulo",
  };
}
```

**Por que não UTC puro:**

- Usuários veem horários em BRT (UTC-3)
- Se enviar UTC, o Google mostra o horário convertido
- Mas se o usuário estiver em outro timezone (viagem), o horário pode parecer "errado"
- Enviar com `timeZone: "America/Sao_Paulo"` garante consistência visual

## 11. Idempotência

### Decisão: **Busca por `extendedProperties.private.eventId` antes de criar**

**Estratégia:**

```typescript
async function syncEventToGoogle(event: Event, accessToken: string) {
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  // 1. Buscar se já existe
  const existing = await calendar.events.list({
    calendarId: "primary",
    q: event.id,  // busca por texto
    privateExtendedProperty: `eventId=${event.id}`,
  });

  if (existing.data.items?.length > 0) {
    // Já existe — atualizar
    const googleEventId = existing.data.items[0].id!;
    await calendar.events.update({ calendarId: "primary", eventId: googleEventId, ... });
    return googleEventId;
  }

  // 2. Criar novo
  const created = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: event.nome,
      description: event.descricao,
      start: toGoogleDateTime(event.dataInicio),
      end: toGoogleDateTime(event.dataFim),
      extendedProperties: {
        private: {
          source: "escala-facil",
          eventId: event.id,
          churchId: event.churchId || "",
        },
      },
    },
  });

  return created.data.id!;
}
```

**Por que `extendedProperties.private`:**

- Busca eficiente por `eventId` (índice no Google)
- Não duplica mesmo com retry
- Visível apenas para a aplicação

**Alternativa avaliada e rejeitada:**

- Buscar por `summary` + `start.dateTime` → impreciso, pode match errado
- Usar `googleEventId` como único mecanismo → não ajuda no primeiro create

## 12. Tokens

### Decisão: **Reutilizar `refreshAccessToken()` existente**

**Fluxo de refresh antes de cada operação Google:**

```
1. Chama googleCalendarService.refreshAccessToken(userId)
2. Retorna access token válido ou null
3. Se null: usuário não está conectado ou refresh falhou
   → googleSyncStatus = ERROR, ignora sync
4. Se token válido: prossegue com operação Google
5. Se operação Google retorna 401:
   → tenta refresh uma segunda vez
   → se falhar again: googleSyncStatus = ERROR
```

**Nota:** O refresh já tem buffer de 5 minutos. Não é necessário implementar lógica adicional.

## 13. Tratamento de falhas

### Matriz de erros

| Situação | Evento local | Google | Ação |
|----------|-------------|--------|------|
| Google indisponível (5xx) | Mantido | Ignorado | `syncStatus=ERROR`, retry manual |
| Token expirado | Mantido | Refresh automático | Tenta refresh; se falhar → `ERROR` |
| Refresh falhou | Mantido | Ignorado | `syncStatus=ERROR`, usuário reconecta |
| Calendar inexistente (404) | Mantido | Ignorado | `syncStatus=ERROR`, mensagem sugerindo reconexão |
| Evento Google 404 | Mantido | Removido manualmente | Remove `googleEventId`, `syncStatus=NONE` |
| Permissão negada (403) | Mantido | Ignorado | `syncStatus=ERROR`, mensagem de permissão |
| Rate limit (429) | Mantido | Retry com backoff | Retry após delay (exponencial, máx 3 tentativas) |
| Evento duplicado | Mantido | Já existe | Busca existente, atualiza em vez de criar |

**Regra fundamental:** A operação local NUNCA falha por causa do Google.

## 14. Multi-tenancy

### Garantias conceituais

1. `Event.churchId` = igreja do evento
2. `User.churchId` = igreja do usuário
3. `GoogleCalendarConnection.userId` = conexão Google do usuário
4. Só é possível sincronizar se `Event.churchId === User.churchId`

**Fluxo de verificação:**

```
EventsService.create() já garante:
  → churchId = actor.churchId (extraído do JWT)
  → Event é criado com churchId do usuário

Sincronização:
  → Usa o mesmo actor (userId do JWT)
  → Busca GoogleCalendarConnection por userId
  → Google Calendar API opera no calendário PESSOAL do usuário
  → Não há risco de cross-church (evento church A no calendário church B)
```

**Casos extremos:**

| Cenário | Resultado |
|---------|-----------|
| Usuário trocou de igreja | Evento antigo mantém churchId original; sync usa Google Calendar pessoal |
| Usuário é admin de múltiplas igrejas | Cada sync vai para o calendário pessoal do usuário |
| Dois usuários sincronizam o mesmo evento | Cada um cria em seu próprio calendário (comportamento esperado) |

## 15. Auditoria

### Operações que deveriam gerar log (não implementar agora)

| Ação | Módulo | TargetId | Dados |
|------|--------|----------|-------|
| `GOOGLE_CONNECTED` | `google-calendar` | userId | `{ googleAccountId }` |
| `GOOGLE_DISCONNECTED` | `google-calendar` | userId | — |
| `EVENT_SYNCED` | `google-calendar` | Event.id | `{ googleEventId, calendarId }` |
| `SYNC_FAILED` | `google-calendar` | Event.id | `{ error, syncStatus }` |
| `SYNC_RETRIED` | `google-calendar` | Event.id | `{ attempt, result }` |

## 16. API proposta

### Recomendação: **Híbrida (automática + ação explícita)**

**Justificativa:**

- Criação automática pós-commit é a melhor UX (usuário não precisa clicar "sincronizar")
- Mas preciso de ação explícita para retry (quando sync falhou)
- E para resync (quando evento foi editado enquanto Google estava offline)

### Endpoints

#### Sincronização automática (interno, não exposto como endpoint)

Acontece dentro de `EventsService.create()`, `EventsService.update()`, `EventsService.remove()`.

#### Ação explícita

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/events/:id/sync-google` | JWT + ADMIN | Sincroniza (ou resync) um evento específico |
| `DELETE` | `/events/:id/sync-google` | JWT + ADMIN | Remove a sincronização (apenas googleEventId, não exclui o evento) |

**POST /events/:id/sync-google**

Request: `{}` (vazio — usa a conexão do usuário autenticado)

Response:
```json
{
  "success": true,
  "message": "Evento sincronizado com o Google Calendar.",
  "data": {
    "googleEventId": "abc123...",
    "syncedAt": "2026-09-12T14:00:00.000Z"
  }
}
```

Erros:
- `404` → Event não encontrado
- `403` → Usuário sem permissão ou sem conexão Google
- `409` → Usuário não tem GoogleCalendarConnection ativa
- `502` → Google API retornou erro

**DELETE /events/:id/sync-google**

Response:
```json
{
  "success": true,
  "message": "Sincronização removida.",
  "data": { "success": true }
}
```

Remove `googleEventId`, `googleSyncStatus`, `lastSyncedAt` do Event. NÃO exclui o evento local nem o evento no Google Calendar.

## 17. Frontend futuro

### Indicadores de status propostos

| Status | Indicador visual |
|--------|-----------------|
| `NONE` (nunca sincronizado) | Sem indicador (comportamento padrão) |
| `PENDING` (sincronizando) | Spinner small ao lado do nome |
| `SYNCED` (sincronizado) | Ícone check verde (`CalendarCheck2`) |
| `ERROR` (falha na sync) | Ícone alerta vermelho (`AlertTriangle`) + tooltip com erro |

### Botões de ação

Na EventsPage, ao editar um evento:
- Se `SYNCED`: mostrar badge "Sincronizado com Google Calendar"
- Se `ERROR`: mostrar badge "Falha na sincronização" + botão "Tentar novamente"
- Se `NONE`: sem indicador especial

## 18. Testes futuros

### CREATE

| # | Teste | Prioridade |
|---|-------|------------|
| 1 | Evento criado e sincronizado com sucesso | Alta |
| 2 | Google indisponível — evento criado localmente, sync com erro | Alta |
| 3 | Usuário sem conexão Google — evento criado, sem tentativa de sync | Alta |
| 4 | Retry cria evento duplicado — idempotência via extendedProperties | Alta |
| 5 | Token expirado durante sync — refresh automático | Média |

### UPDATE

| # | Teste | Prioridade |
|---|-------|------------|
| 6 | Atualização sincronizada com sucesso | Alta |
| 7 | Google retorna 404 — googleEventId removido | Alta |
| 8 | Token expirado durante update — refresh + retry | Média |
| 9 | Usuário desconectou — sync ignorada | Média |

### DELETE

| # | Teste | Prioridade |
|---|-------|------------|
| 10 | Exclusão local + exclusão Google bem-sucedida | Alta |
| 11 | Google retorna 404 na exclusão — ignorado | Alta |
| 12 | Google indisponível na exclusão — local já excluído | Média |

### RECORRÊNCIA

| # | Teste | Prioridade |
|---|-------|------------|
| 13 | Série de 3 ocorrências — 3 Google Events criados | Alta |
| 14 | Edição de 1 ocorrência — apenas 1 Google Event atualizado | Alta |
| 15 | Exclusão de 1 ocorrência — apenas 1 Google Event removido | Alta |

### SEGURANÇA

| # | Teste | Prioridade |
|---|-------|------------|
| 16 | Usuário church A não acessa evento church B | Alta |
| 17 | Usuário sem permissão de ADMIN não pode resync | Alta |
| 18 | Conexão Google de outro usuário não é utilizada | Alta |

## 19. Decisões arquiteturais

| # | Decisão | Escolha | Motivo |
|---|---------|---------|--------|
| 1 | Quem sincroniza | Usuário autenticado com GoogleCalendarConnection | Conexão é por usuário, não por igreja |
| 2 | Calendário destino | `"primary"` (padrão) | Simplicidade; calendarId opcional preservado |
| 3 | Onde guardar googleEventId | Campo na entidade `Event` | Mais simples que tabela separada; 1:1 com Event |
| 4 | Status de sync | Enum `GoogleSyncStatus` no Event | Rastreabilidade sem join |
| 5 | Estratégia criação | Pós-commit síncrono | Local-first; Google é complementar |
| 6 | Estratégia atualização | Pós-commit, busca por googleEventId | Idempotente |
| 7 | Estratégia exclusão | Local primeiro, depois Google | Fonte de verdade é local |
| 8 | Recorrência | Ocorrência independente (row-per-occurrence) | Consistente com modelo atual |
| 9 | Timezone | `America/Sao_Paulo` explícito no Google API | Consistência visual para usuários BR |
| 10 | Idempotência | ID determinístico + extendedProperties + googleEventId | Três camadas de proteção |
| 11 | Falhas | `syncStatus=ERROR`, retry manual | Local-first; sync é best-effort |
| 12 | Retry | Ação explícita "Tentar novamente" | Controle do usuário; sem retry automático complexo |
| 13 | Auditoria | Logs em `AuditLog` (módulo `google-calendar`) | Consistente com SchedulesService |
| 14 | Endpoints | Híbrida: automática + `POST/DELETE /events/:id/sync-google` | UX + controle manual |
| 15 | UX futura | Badge de status + botão retry | Informação sem poluição visual |
| 16 | ID Google | Determinístico derivado de `Event.id` | Evita duplicação por retry |
| 17 | Async model | Em-memória, sem fila durável | MVP sem infraestrutura externa |
| 18 | DELETE sync | Remove vínculo + tenta remover Google Event | Best-effort; Event local preservado |

## 19.1 — Ajustes arquiteturais pós-revisão

### 19.1.1 — ID determinístico do Google Event

A criação do Google Event deverá utilizar um identificador **determinístico** derivado do `Event.id` local.

**Objetivo:** Evitar duplicação caso:
1. O Google crie o evento
2. A resposta seja perdida (timeout, rede)
3. A aplicação tente novamente

**Restrições da Google Calendar API para `eventId`:**

- Máximo 1024 caracteres
- Apenas caracteres alfanuméricos e `-` são permitidos
- Deve ser único por calendário

**Formato proposto (conceitual):**

```
escala-{Event.id normalizado}
```

Onde `Event.id` é um UUID v4 (ex: `550e8400-e29b-41d4-a716-446655440000`). A implementação definitiva deverá:
1. Remover caracteres não-alfanuméricos do UUID
2. Prefixar com `escala-`
3. Validar que o resultado comprimento < 1024

**Exemplo conceitual:**

```
Event.id = "550e8400-e29b-41d4-a716-446655440000"
Google Event.eventId = "escala-550e8400e29b41d4a716446655440000"
```

**Por que determinístico:**

- Mesmo que a resposta do Google seja perdida, a próxima tentativa usa o mesmo `eventId`
- O Google Calendar API é idempotente para `events.insert` quando `eventId` é fornecido
- Não é necessário buscar eventos existentes antes de criar (a busca por `extendedProperties` é redundante quando o ID é determinístico)

**Não implementar ainda.** A implementação deverá validar as restrições reais da Google Calendar API.

### 19.1.2 — Extended Properties

Manter `extendedProperties.private` com as propriedades conceituais:

```json
{
  "source": "escala-facil",
  "eventId": "<Event.id>",
  "churchId": "<Event.churchId>",
  "recurrenceGroupId": "<Event.recurrenceGroupId ou vazio>"
}
```

**Função:**
- Rastreabilidade
- Identificação da origem
- Recuperação futura
- Suporte a diagnóstico
- Redundância em relação ao `googleEventId`

**IMPORTANTE:**
- `extendedProperties` NÃO substitui o `googleEventId` persistido no banco
- NÃO deve ser utilizado como única estratégia de idempotência se o ID determinístico estiver disponível
- As `extendedProperties` são uma camada de redundância, não a primária

### 19.1.3 — Timezone (revisão)

A decisão permanece: Google Calendar receberá `dateTime` + `timeZone = "America/Sao_Paulo"`.

```json
{
  "start": {
    "dateTime": "2026-09-12T19:00:00",
    "timeZone": "America/Sao_Paulo"
  }
}
```

**Registrar explicitamente:**
- Isso é uma **decisão de representação**, não de armazenamento
- Não significa que o Google Calendar não aceite UTC
- O objetivo é representar explicitamente o horário local dos eventos da igreja
- O banco continua armazenando `DateTime` em UTC
- A conversão ocorrerá **somente** na integração com Google Calendar
- A conversão usa `Intl.DateTimeFormat` com `timeZone: "America/Sao_Paulo"`

### 19.1.4 — DELETE /events/:id/sync-google (correção)

O endpoint `DELETE /events/:id/sync-google` deverá ter o seguinte comportamento:

1. Verificar `Event` e `churchId` (autorização)
2. Verificar `googleEventId`
3. Se existir conexão Google válida:
   - Tentar excluir o evento correspondente no Google via `calendar.events.delete()`
4. Se Google retornar 404:
   - Considerar já removido
5. **Depois** limpar os campos locais de sincronização:
   - `googleEventId = null`
   - `googleSyncStatus = NONE`
   - `lastSyncedAt = null`
   - `googleSyncError = null`
6. Manter o `Event` local **intacto**

**"Remover sincronização" significa:**
- Remover o vínculo local
- Remover o evento correspondente no Google, quando possível
- NÃO excluir o Event do Escala Fácil

**Se o Google estiver indisponível:** comportamento é **best-effort** — limpa os campos locais mesmo assim. O evento pode permanecer como "fantasma" no Google Calendar, mas o vínculo local será removido.

## 20. Modelo de sincronização

### Local-first com execução assíncrona em memória

A arquitetura continua **LOCAL-FIRST**. A operação local deve ser concluída independentemente da disponibilidade do Google.

**Distinção entre "pós-commit" e "background assíncrono":**

| Conceito | Significado |
|----------|-------------|
| Pós-commit | O código de sincronização roda **depois** do commit local, no mesmo request |
| Background assíncrono | A sincronização é disparada mas não bloqueia a resposta ao cliente |

**Decisão para o MVP:**

- A implementação do MVP **não** deve introduzir Redis, RabbitMQ, BullMQ ou outra infraestrutura externa somente para sincronização
- Caso seja utilizada execução assíncrona em memória/processo (ex: `setTimeout`, `Promise` sem `await`):
  - Documentar que **não é uma fila durável**
  - Documentar que um restart/crash pode interromper uma sincronização pendente
  - O mecanismo de resync manual deverá permitir recuperação
- A sincronização automática será disparada **após a operação local**
- Falha Google **não** deve transformar POST/PATCH/DELETE local em erro
- Sincronização deve ser tratada como **best-effort**
- Resync manual será o mecanismo de recuperação

## 21. Idempotência (revisão)

### Três camadas de proteção

| Camada | Mecanismo | Quando atua |
|--------|-----------|-------------|
| **1ª** | ID determinístico no Google Event | Na criação — Google API é idempotente para `eventId` fornecido |
| **2ª** | `extendedProperties.private.eventId` | Busca prévia — verifica se já existe antes de criar |
| **3ª** | `googleEventId` persistido no Event | Atualização/exclusão — busca direta por ID |

**Fluxo de idempotência no CREATE:**

```
1. Gerar eventId determinístico: "escala-{Event.id normalizado}"
2. Criar Google Event com esse eventId
3. Google é idempotente: se já existe, retorna o existente
4. Salvar googleEventId no Event
5. Próxima tentativa usa o mesmo eventId → não duplica
```

**Fluxo de idempotência no UPDATE:**

```
1. Buscar Event tem googleEventId?
2. Se SIM: usar googleEventId para buscar no Google
3. Se não encontrado: remover googleEventId (evento foi removido no Google)
4. Se encontrado: atualizar
```

**Objetivo:** `CREATE + retry` **não pode** resultar em dois eventos Google para o mesmo Event local.

## 22. Recorrência (preservada)

A decisão aprovada permanece: **cada ocorrência local = um Google Event independente**.

```
Event A (recurrenceIndex = 0) → Google Event A (próprio eventId)
Event B (recurrenceIndex = 1) → Google Event B (próprio eventId)
Event C (recurrenceIndex = 2) → Google Event C (próprio eventId)
```

Cada Event possui seu próprio:
- `googleEventId`
- `googleSyncStatus`
- `lastSyncedAt`

Não utilizar RRULE do Google Calendar nesta primeira implementação.

## 23. API futura (revisão)

### Endpoints mantidos

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/events/:id/sync-google` | JWT + ADMIN | Criar ou resync Google Event |
| `DELETE` | `/events/:id/sync-google` | JWT + ADMIN | Remover sincronização + tentar remover Google Event |

**POST /events/:id/sync-google:**
- Criar Google Event se não existir (ID determinístico)
- Atualizar/resync se já existir
- Retornar `googleEventId` e `syncedAt`

**DELETE /events/:id/sync-google:**
- Verificar Event e churchId
- Se Google disponível: tentar excluir evento no Google
- Limpar campos locais de sincronização
- Manter Event local intacto
- Best-effort: se Google indisponível, limpa vínculo local mesmo assim

NÃO implementar endpoints nesta etapa.

## 24. Automação (decisão de MVP)

**CRUD local continua sendo a fonte de verdade.**

A sincronização automática será disparada após a operação local.

Restrições do MVP:
- Falha Google NÃO deve transformar POST/PATCH/DELETE local em erro
- Sincronização deve ser tratada como **best-effort**
- Resync manual será o mecanismo de recuperação
- NÃO adicionar infraestrutura de filas nesta etapa

## 25. Próxima etapa

**Etapa 8.5.4 — Implementação da sincronização backend**

1. Migration: adicionar `googleEventId`, `googleSyncStatus`, `lastSyncedAt`, `googleSyncError` ao modelo `Event`
2. Enum `GoogleSyncStatus` (NONE, PENDING, SYNCED, ERROR)
3. `GoogleCalendarSyncService` — serviço de sincronização com Google Calendar Events API
4. Conversão de timezone (`America/Sao_Paulo`)
5. ID determinístico (`escala-{Event.id normalizado}`)
6. Extended Properties (`source`, `eventId`, `churchId`, `recurrenceGroupId`)
7. Create: pós-commit síncrono com ID determinístico
8. Update: pós-commit, busca por `googleEventId`
9. Delete: local primeiro, depois tenta remover Google
10. Refresh de token via `refreshAccessToken()` existente
11. Tratamento de erros (matriz da seção 13)
12. Endpoints manuais (`POST` e `DELETE /events/:id/sync-google`)
13. Integração com `EventsService` (create, update, remove)
14. Multi-tenancy (verificação de `churchId`)
15. Testes unitários e de integração
