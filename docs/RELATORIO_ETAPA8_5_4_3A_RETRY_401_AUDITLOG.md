# Relatório Etapa 8.5.4.3A — Retry 401 + AuditLog

## STATUS: ✅ PASS (FIX APPLIED)

## Resumo

Implementação de retry automático para erros 401 (token expirado) no Google Calendar Sync e registro de audit logs para operações de sync/unlink. Auditoria identificou falha no fluxo de retry (chamava `refreshAccessToken` antes da primeira operação); correção aplicada via novo método `getStoredAccessToken()`.

## 1. Retry 401 — `GoogleCalendarSyncService`

### 1.1 Novo método `retryWithRefresh<T>`

- **Primeira tentativa:** usa `getStoredAccessToken(userId)` para obter o token armazenado (sem chamar Google API)
- Se a operação lança erro 401 (`getHttpStatus(error) === 401`):
  - Renova o token via `refreshAccessToken()` (só chama Google API nesta etapa)
  - Repete a operação uma única vez
- Se a renovação falhar (retorna null), lança erro com mensagem amigável
- Erros que NÃO são 401 são propagados diretamente (403, 404, 409, 429, 500)
- Máximo de 1 retry por operação

### 1.2 Método `syncEvent` refatorado

- Agora delega para `retryWithRefresh` as chamadas `createGoogleEvent` e `updateGoogleEvent`
- O erro "Google Calendar não conectado" ainda é tratado no nível de `syncEvent` (via catch)

### 1.3 Método `deleteGoogleEvent` refatorado

- Envolto em `retryWithRefresh` com tratamento específico para 404 (sucesso) e erros gerais (falha)
- Mantém lógica existente de: 404 = deslinkar localmente como sucesso

### 1.4 Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `google-calendar.service.ts` | Novo `getStoredAccessToken(userId)` — lê token armazenado sem refresh |
| `google-calendar-sync.service.ts` | Novo `retryWithRefresh()` (usa `getStoredAccessToken` → `refreshAccessToken`), refatorado `syncEvent`, `deleteGoogleEvent` |
| `google-calendar-sync.service.spec.ts` | Testes atualizados com mocks corretos + assertions de call count (65 total) |

## 2. AuditLog — `EventsService`

### 2.1 Injeção

- `AuditLogsService` injetado no construtor de `EventsService`
- `AuditLogsModule` adicionado aos `imports` de `EventsModule`

### 2.2 Ações registradas

| Método | Action | Module | Dados |
|---|---|---|---|
| `syncEventToGoogle` | `GOOGLE_CALENDAR_SYNC` | `EVENTS` | `{ status, googleEventId }` |
| `unlinkEventFromGoogle` | `GOOGLE_CALENDAR_UNLINK` | `EVENTS` | `{ success }` |

### 2.3 Condições

- Audit log é registrado APENAS quando a operação é bem-sucedida (sem exceção)
- Exceções (NotFoundException, BadRequestException, ForbiddenException) são propagadas ANTES do audit log
- Campos: `userId` (actor.sub), `churchId` (actor.churchId), `action`, `module`, `targetId`, `newValue`

### 2.4 Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `events.service.ts` | Import `AuditLogsService`, injeção, 2 chamadas `log()` |
| `events.module.ts` | Import `AuditLogsModule` |
| `events.service.spec.ts` | Mock `AuditLogsService`, +10 testes audit (107 total) |

## 3. Testes

### 3.1 Retry 401 — 15 cenários

| # | Teste | Resultado |
|---|---|---|
| 1 | syncEvent: 401 insert → refresh → retry sucesso | PASS |
| 2 | syncEvent: 401 insert → refresh falha → ERROR | PASS |
| 3 | syncEvent: 401 insert → refresh → retry 401 again → ERROR | PASS |
| 4 | syncEvent: 401 update → refresh → retry sucesso | PASS |
| 5 | syncEvent: 401 update → refresh → retry 404 → recreate | PASS |
| 6 | syncEvent: 403 → sem refresh, throw | PASS |
| 7 | syncEvent: 404 → sem refresh, throw | PASS |
| 8 | syncEvent: 409 → sem refresh, throw | PASS |
| 9 | syncEvent: 429 → sem refresh, throw | PASS |
| 10 | syncEvent: 500 → sem refresh, throw | PASS |
| 11 | delete: 401 → refresh → retry sucesso | PASS |
| 12 | delete: 401 → refresh falha → ERROR | PASS |
| 13 | delete: 401 → refresh → retry 401 again → ERROR | PASS |
| 14 | delete: 404 → success (já deletado) | PASS |
| 15 | delete: 500 → sem refresh, ERROR | PASS |

### 3.2 AuditLog — 10 cenários

| # | Teste | Resultado |
|---|---|---|
| 1 | Audit em sync bem-sucedido | PASS |
| 2 | Audit em sync com erro | PASS |
| 3 | Sem audit quando NotFoundException | PASS |
| 4 | Sem audit quando BadRequestException | PASS |
| 5 | Audit em unlink bem-sucedido | PASS |
| 6 | Audit em unlink com falha | PASS |
| 7 | Sem audit quando NotFoundException no unlink | PASS |
| 8 | Audit com churchId correto do actor | PASS |
| 9 | Estrutura newValue correta no sync audit | PASS |
| 10 | Estrutura newValue correta no unlink audit | PASS |

### 3.3 Totais

| Suite | Antes | Depois | Delta |
|---|---|---|---|
| `google-calendar-sync.service.spec.ts` | 50 | 65 | +15 |
| `events.service.spec.ts` | 97 | 107 | +10 |
| Total backend | 271 | 296 | +25 |

## 4. Auditoria e Correção

### 4.1 Falha encontrada

- `retryWithRefresh()` chamava `refreshAccessToken()` **ANTES** da primeira operação
- Requisito: primeira operação deve usar token armazenado (`getStoredAccessToken`), refresh **SÓ** em 401

### 4.2 Correção aplicada

1. Criado `getStoredAccessToken(userId)` em `GoogleCalendarService` — lê token criptografado sem chamar Google API
2. `retryWithRefresh()` refatorado:
   - Primeira tentativa: `getStoredAccessToken()` → sem chamada Google
   - Em 401: `refreshAccessToken()` → renova token via Google API → retry
3. Testes atualizados: mocks mudaram de `refreshAccessToken` → `getStoredAccessToken` para happy path
4. Adicionadas assertions de `toHaveBeenCalledTimes`: `getStoredAccessToken`=1, `refreshAccessToken`=0 (happy) ou =1 (401)
5. Delete tests: `mockReset()` isolado para evitar contaminação entre cenários

### 4.3 Arquivos da correção

| Arquivo | Mudança |
|---|---|
| `google-calendar.service.ts` | Novo `getStoredAccessToken(userId)` |
| `google-calendar-sync.service.spec.ts` | Todos os mocks atualizados + assertions de call count |

## 5. Qualidade

| Check | Status |
|---|---|
| `npx jest --runInBand` | 296/296 PASS |
| `npx nest build` | CLEAN |
| `npx eslint` | CLEAN |

## 6. Decisões técnicas

1. **`getStoredAccessToken` vs `refreshAccessToken`** — primeira tentativa usa stored (rápido, sem I/O Google); refresh só em 401
2. **`retryWithRefresh` é privado** — não exposto publicamente, usado internamente
3. **Máximo 1 retry** — não entra em loop; se o retry falhar, propaga o erro
4. **Apenas 401 dispara retry** — 403/404/409/429/500 são tratados imediatamente
5. **AuditLog em try/catch** — se `log()` falhar, não impede a operação principal
6. **`eslint-disable-line preserve-caused-error`** — necessário porque ES2021 não suporta `new Error(msg, { cause })`
7. **`mockReset()` nos delete tests** — `jest.clearAllMocks()` não reseta `mockResolvedValue` queues entre cenários isolados
