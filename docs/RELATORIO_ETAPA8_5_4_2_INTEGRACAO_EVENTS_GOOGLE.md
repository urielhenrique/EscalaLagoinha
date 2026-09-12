# RELATÓRIO — ETAPA 8.5.4.2: Integração Google Calendar com EventsService + Endpoints REST

**Data:** 12/09/2026  
**Status:** PASS

---

## 1. Objetivo

Integrar o `GoogleCalendarSyncService` ao domínio de Events, criando endpoints REST de sincronização Google Calendar com multi-tenancy, tratamento de 404, e audit pattern.

---

## 2. Inspeção Inicial

### Arquitetura mapeada

| Item | Padrão identificado |
|------|---------------------|
| Auth | `JwtPayload` via `@CurrentUser()`, `getChurchIdOrThrow()` |
| Roles | `@Roles(Perfil.ADMIN)` em mutações |
| Multi-tenancy | `findFirst({ where: { id, churchId } })` — sempre filtra por churchId |
| Erros | `NotFoundException`, `BadRequestException`, `ForbiddenException` |
| Swagger | `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiOkResponse` |
| Response | `@ResponseMessage("...")` |
| Audit | `AuditLogsService.log({ userId, churchId, action, module, targetId })` |
| DI | Constructor injection, modules com imports/exports |

### Decisões

- Endpoints usam `@Roles(Perfil.ADMIN)` como mutações existentes
- `userId` para Google Connection vem de `user.sub` (JWT)
- `churchId` vem de `actor.churchId` (JWT), nunca do body/path
- AuditLog não registrado nesta etapa (será etapa futura com o padrão do projeto)

---

## 3. Arquivos Alterados

| Arquivo | Alteração |
|---------|-----------|
| `google-calendar-sync.service.ts` | UPDATE 404 → recreate; DELETE 404 → success; `getHttpStatus()` helper |
| `events.service.ts` | `syncEventToGoogle()` + `unlinkEventFromGoogle()` + injeção de dependências |
| `events.controller.ts` | `POST :id/sync-google` + `DELETE :id/sync-google` |
| `events.module.ts` | `imports: [GoogleCalendarModule]` |
| `events.service.spec.ts` | 12 novos testes (sync/unlink) |
| `events.controller.spec.ts` | Criado — 8 testes para endpoints sync |
| `google-calendar-sync.service.spec.ts` | Mantidos (50 testes) |

---

## 4. Endpoints Criados

### POST /api/events/:id/sync-google

- **Auth:** JWT + `@Roles(Perfil.ADMIN)`
- **Fluxo:**
  1. Valida churchId do JWT
  2. Busca Event com `{ id, churchId }` (multi-tenancy)
  3. Verifica GoogleCalendarConnection do userId
  4. Chama `GoogleCalendarSyncService.syncEvent()`
  5. Retorna: `eventId, status, googleEventId, lastSyncedAt, googleSyncError`

### DELETE /api/events/:id/sync-google

- **Auth:** JWT + `@Roles(Perfil.ADMIN)`
- **Fluxo:**
  1. Valida churchId do JWT
  2. Busca Event com `{ id, churchId }`
  3. Chama `GoogleCalendarSyncService.deleteGoogleEvent()`
  4. Retorna: `eventId, success, googleSyncError`

---

## 5. Integração EventsService ↔ GoogleCalendarSyncService

### syncEventToGoogle(userId, eventId, actor)

```
actor.churchId → findFirst Event (multi-tenancy)
              → findUnique GoogleCalendarConnection (userId)
              → GoogleCalendarSyncService.syncEvent()
              → retorna resultado seguro
```

### unlinkEventFromGoogle(userId, eventId, actor)

```
actor.churchId → findFirst Event (multi-tenancy)
              → GoogleCalendarSyncService.deleteGoogleEvent()
              → retorna resultado seguro
```

---

## 6. Multi-tenancy

Todas as consultas ao Event usam `findFirst({ where: { id, churchId } })` onde `churchId` vem exclusivamente do JWT.

**Testes cross-tenant:**
- `syncEventToGoogle` com `userFromChurchB` → `NotFoundException`
- `unlinkEventFromGoogle` com `userFromChurchB` → `NotFoundException`

---

## 7. UPDATE 404

`updateGoogleEvent()` agora captura erro 404 do Google:
1. Limpa `googleEventId`, define `googleSyncStatus = NONE`
2. Chama `createGoogleEvent()` para recriar com ID determinístico
3. Retorna `SYNCED` se recriação funcionar

---

## 8. DELETE 404

`deleteGoogleEvent()` agora trata 404 como sucesso lógico:
1. Captura erro 404
2. Continua para resetar campos no DB
3. Retorna `{ success: true }`

---

## 9. Token Refresh/Retry

Utiliza `GoogleCalendarService.refreshAccessToken()` existente:
- Se token expirado → refresh automático
- Se refresh falha → `syncEvent()` retorna `ERROR`
- Se Google retorna 401 → erro propagado (retry será etapa futura)

---

## 10. AuditLog

Não registrado nesta etapa. O padrão `AuditLogsService.log()` está disponível e será utilizado quando a integração for conectada ao fluxo de mutation do EventsService.

---

## 11. Testes Adicionados

### EventsService (12 testes)

| # | Cenário | Status |
|---|---------|--------|
| 1 | syncEventToGoogle — evento da igreja | OK |
| 2 | syncEventToGoogle — evento não encontrado | OK |
| 3 | syncEventToGoogle — cross-tenant | OK |
| 4 | syncEventToGoogle — sem conexão Google | OK |
| 5 | syncEventToGoogle — sem churchId | OK |
| 6 | syncEventToGoogle — sync com erro | OK |
| 7 | unlinkEventFromGoogle — desvincula | OK |
| 8 | unlinkEventFromGoogle — não encontrado | OK |
| 9 | unlinkEventFromGoogle — cross-tenant | OK |
| 10 | unlinkEventFromGoogle — sem googleEventId | OK |
| 11 | unlinkEventFromGoogle — erro Google | OK |
| 12 | unlinkEventFromGoogle — sem churchId | OK |

### EventsController (8 testes)

| # | Cenário | Status |
|---|---------|--------|
| 13 | POST sync-google autenticado | OK |
| 14 | POST sync-google — NotFoundException | OK |
| 15 | POST sync-google — BadRequestException | OK |
| 16 | POST sync-google — cross-tenant | OK |
| 17 | DELETE unlink-google autenticado | OK |
| 18 | DELETE unlink-google — NotFoundException | OK |
| 19 | DELETE unlink-google — sem googleEventId | OK |
| 20 | DELETE unlink-google — erro Google | OK |

### GoogleCalendarSyncService (50 testes existentes)

Mantidos. Comportamento de 404 coberto pelo mock do Google API.

---

## 12. Resultado dos Testes

```
npx jest --runInBand
Test Suites: 17 passed, 17 total
Tests:       271 passed, 271 total
```

---

## 13. Resultado do Build

```
npx nest build
(sem erros)
```

---

## 14. Resultado do Lint

```
npx eslint (7 arquivos modificados)
(sem erros)
```

---

## 15. Pendências

| Item | Status | Etapa futura |
|------|--------|--------------|
| AuditLog para sync/unlink | PENDENTE | 8.5.4.3 |
| Retry 401 após refresh | PENDENTE | 8.5.4.3 |
| Sincronização automática no CRUD | PENDENTE | Etapa futura |
| Frontend botão sync | PENDENTE | 8.5.5 |
| Seleção de calendário | PENDENTE | Etapa futura |

---

## 16. Próxima Etapa

**Etapa 8.5.4.3:** AuditLog + retry 401 + sincronização automática.
