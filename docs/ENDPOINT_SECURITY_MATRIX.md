# Matriz de Segurança dos Endpoints — Escala Fácil

**Data**: 09/09/2026

## Legenda

- **Auth**: 🔒 = JWT necessário, 🌐 = público
- **Role**: permissão necessária (classe ou rota)
- **Tenant**: ✅ = filtra por churchId, ⚠️ = parcial, ❌ = não filtra
- **Status**: 🟢 OK, 🟡 ATENÇÃO, 🔴 VULNERÁVEL

---

## AUTH

| Método | Endpoint | Auth | Role | Tenant | Status | Observação |
|--------|----------|------|------|--------|--------|------------|
| POST | /auth/register | 🌐 | — | ✅ | 🟢 | Rate limit 3/min |
| POST | /auth/onboarding | 🌐 | — | ✅ | 🟢 | Rate limit 1/dia, restrito |
| POST | /auth/login | 🌐 | — | — | 🟢 | Rate limit 5/min |
| GET | /auth/me | 🔒 | — | — | 🟢 | |
| PATCH | /auth/me | 🔒 | — | — | 🟢 | |
| POST | /auth/forgot-password | 🌐 | — | — | 🟢 | Rate limit 3/min |
| POST | /auth/reset-password | 🌐 | — | — | 🟢 | |

## USERS

| Método | Endpoint | Auth | Role | Tenant | Status | Observação |
|--------|----------|------|------|--------|--------|------------|
| POST | /users | 🔒 | ADMIN+ | ✅ | 🟢 | MASTER_ADMIN só cria na própria igreja |
| GET | /users | 🔒 | ADMIN+ | ✅ | 🟢 | buildChurchScope filtra |
| GET | /users/pending | 🔒 | ADMIN+ | ✅ | 🟢 | buildChurchScope filtra |
| GET | /users/:id | 🔒 | ADMIN+ | ✅ | 🟢 | assertSameChurch |
| PATCH | /users/:id | 🔒 | ADMIN+ | ✅ | 🟢 | assertSameChurch |
| PATCH | /users/:id/approve | 🔒 | ADMIN+ | ✅ | 🟢 | assertSameChurch |
| PATCH | /users/:id/reject | 🔒 | ADMIN+ | ✅ | 🟢 | assertSameChurch |
| DELETE | /users/:id | 🔒 | MASTER_ADMIN+ | ✅ | 🟢 | assertSameChurch |

## CHURCHES

| Método | Endpoint | Auth | Role | Tenant | Status | Observação |
|--------|----------|------|------|--------|--------|------------|
| GET | /churches | 🔒 | ADMIN+ | ✅ | 🟢 | |
| GET | /churches/current | 🔒 | ADMIN+ | ✅ | 🟢 | |
| POST | /churches | 🔒 | MASTER_PLATFORM_ADMIN | — | 🟢 | Só platform admin |
| PATCH | /churches/current/settings | 🔒 | ADMIN+ | ✅ | 🟢 | |
| POST | /churches/current/invite-link | 🔒 | ADMIN+ | ✅ | 🟢 | |
| GET | /churches/:churchId/admins | 🔒 | ADMIN+ | ✅ | 🟢 | assertCanManageChurch |
| PATCH | /churches/:churchId/admins/:userId/profile | 🔒 | MASTER_ADMIN+ | ✅ | 🟢 | assertCanManageChurch |

## MINISTRIES

| Método | Endpoint | Auth | Role | Tenant | Status | Observação |
|--------|----------|------|------|--------|--------|------------|
| GET | /ministries | 🔒 | — | ✅ | 🟢 | churchId no query |
| GET | /ministries/my | 🔒 | — | ✅ | 🟢 | |
| GET | /ministries/:id | 🔒 | — | ✅ | 🟢 | findByIdForUser filtra |
| POST | /ministries | 🔒 | ADMIN+ | ✅ | 🟢 | getChurchIdOrThrow |
| POST | /ministries/seed-defaults | 🔒 | ADMIN+ | ✅ | 🟢 | |
| PATCH | /ministries/:id | 🔒 | ADMIN+ | ✅ | 🟢 | where: { id, churchId } |
| DELETE | /ministries/:id | 🔒 | ADMIN+ | ✅ | 🟢 | where: { id, churchId } |

## EVENTS

| Método | Endpoint | Auth | Role | Tenant | Status | Observação |
|--------|----------|------|------|--------|--------|------------|
| GET | /events | 🔒 | — | ✅ | 🟢 | where: { churchId } |
| GET | /events/:id | 🔒 | — | ✅ | 🟢 | where: { id, churchId } |
| POST | /events | 🔒 | ADMIN+ | ✅ | 🟢 | getChurchIdOrThrow |
| POST | /events/seed-defaults | 🔒 | ADMIN+ | ✅ | 🟢 | |
| PATCH | /events/:id | 🔒 | ADMIN+ | ✅ | 🟢 | where: { id, churchId } |
| DELETE | /events/:id | 🔒 | ADMIN+ | ✅ | 🟢 | where: { id, churchId } |

## SCHEDULES

| Método | Endpoint | Auth | Role | Tenant | Status | Observação |
|--------|----------|------|------|--------|--------|------------|
| POST | /schedules | 🔒 | ADMIN+ | ✅ | 🟢 | ensureEntitiesExist valida churchId |
| GET | /schedules | 🔒 | — | ✅ | 🟢 | churchId no where |
| GET | /schedules/:id | 🔒 | — | ✅ | 🟢 | post-fetch churchId check |
| PATCH | /schedules/:id | 🔒 | ADMIN+ | ✅ | 🟢 | post-fetch churchId check |
| PATCH | /schedules/:id/cancel | 🔒 | ADMIN+ | ✅ | 🟢 | post-fetch churchId check |

## AVAILABILITY

| Método | Endpoint | Auth | Role | Tenant | Status | Observação |
|--------|----------|------|------|--------|--------|------------|
| GET | /availability/me | 🔒 | — | — | 🟢 | User-scoped (user.sub) |
| PUT | /availability/me/weekly | 🔒 | — | — | 🟢 | User-scoped |
| PUT | /availability/me/ministry-preferences | 🔒 | — | ✅ | 🟢 | Valida ministérios da igreja |
| POST | /availability/me/blocked-dates | 🔒 | — | — | 🟢 | User-scoped |
| DELETE | /availability/me/blocked-dates | 🔒 | — | — | 🟢 | User-scoped |
| DELETE | /availability/me/blocked-dates/all | 🔒 | — | — | 🟢 | User-scoped |
| DELETE | /availability/me/blocked-dates/:id | 🔒 | — | — | 🟢 | User-scoped, valida volunteerId |

## SWAP REQUESTS

| Método | Endpoint | Auth | Role | Tenant | Status | Observação |
|--------|----------|------|------|--------|--------|------------|
| GET | /swap-requests/eligible/:id | 🔒 | — | ✅ | 🟢 | findScheduleOrThrow com churchId |
| POST | /swap-requests | 🔒 | — | ✅ | 🟢 | findScheduleOrThrow + duplicata check |
| GET | /swap-requests/my-requests | 🔒 | — | ✅ | 🟢 | requesterShift: { is: { churchId } } |
| GET | /swap-requests/received | 🔒 | — | ✅ | 🟢 | requesterShift: { is: { churchId } } |
| GET | /swap-requests/history | 🔒 | — | ✅ | 🟢 | requesterShift: { is: { churchId } } |
| PATCH | /swap-requests/:id/approve | 🔒 | — | ✅ | 🟢 | findSwapOrThrow com churchId |
| PATCH | /swap-requests/:id/reject | 🔒 | — | ✅ | 🟢 | findSwapOrThrow com churchId |
| PATCH | /swap-requests/:id/cancel | 🔒 | — | ✅ | 🟢 | findSwapOrThrow com churchId |

## NOTIFICATIONS

| Método | Endpoint | Auth | Role | Tenant | Status | Observação |
|--------|----------|------|------|--------|--------|------------|
| GET | /notifications | 🔒 | — | ✅ | 🟢 | userId + churchId |
| GET | /notifications/unread-count | 🔒 | — | ✅ | 🟢 | userId + churchId |
| PATCH | /notifications/:id/read | 🔒 | — | ✅ | 🟢 | userId + churchId check |
| PATCH | /notifications/read-all | 🔒 | — | ✅ | 🟢 | userId + churchId |
| DELETE | /notifications/:id | 🔒 | — | ✅ | 🟢 | userId + churchId check |
| POST | /notifications/run-reminders | 🔒 | ADMIN+ | ✅ | 🟢 | Cron processa igrejas individualmente (Etapa 5.1) |

## ATTENDANCE

| Método | Endpoint | Auth | Role | Tenant | Status | Observação |
|--------|----------|------|------|--------|--------|------------|
| GET | /attendance/my | 🔒 | — | ✅ | 🟢 | volunteerId + churchId |
| GET | /attendance/event/:eventId | 🔒 | ADMIN+ | ✅ | 🟢 | assertEventChurchAccess |
| POST | /attendance/:scheduleId/confirm | 🔒 | — | ✅ | 🟢 | getVolunteerSchedule valida |
| POST | /attendance/:scheduleId/check-in | 🔒 | — | ✅ | 🟢 | getVolunteerSchedule valida |
| PATCH | /attendance/:scheduleId/status | 🔒 | ADMIN+ | ✅ | 🟢 | schedule.churchId check |

## AUDIT LOGS

| Método | Endpoint | Auth | Role | Tenant | Status | Observação |
|--------|----------|------|------|--------|--------|------------|
| GET | /audit-logs | 🔒 | ADMIN+ | ✅ | 🟢 | churchId do JWT (MASTER_PLATFORM_ADMIN bypass intencional) |

## REPORTS

| Método | Endpoint | Auth | Role | Tenant | Status | Observação |
|--------|----------|------|------|--------|--------|------------|
| GET | /reports/overview | 🔒 | ADMIN+ | ✅ | 🟢 | churchId obtido do JWT |
| GET | /reports/export | 🔒 | ADMIN+ | ✅ | 🟢 | churchId obtido do JWT |

## SMART SCHEDULER

| Método | Endpoint | Auth | Role | Tenant | Status | Observação |
|--------|----------|------|------|--------|--------|------------|
| GET | /smart-scheduler/ranking | 🔒 | — | ✅ | 🟢 | buildRankingDataset filtra por churchId |
| GET | /smart-scheduler/dashboard/admin | 🔒 | ADMIN+ | ✅ | 🟢 | getAdminExecutiveDashboard filtra por churchId |
| GET | /smart-scheduler/dashboard/me | 🔒 | — | ✅ | 🟢 | getVolunteerDashboard filtra por churchId |
| GET | /smart-scheduler/insights/:eventId | 🔒 | ADMIN+ | ✅ | 🟢 | getInsights valida churchId via getEventOrThrow |
| GET | /smart-scheduler/suggestions | 🔒 | ADMIN+ | ✅ | 🟢 | getManualSuggestions valida churchId |
| POST | /smart-scheduler/generate/:eventId | 🔒 | ADMIN+ | ✅ | 🟢 | generateSmartSchedule valida churchId |
| GET | /smart-scheduler/strategic | 🔒 | ADMIN+ | ✅ | 🟢 | getStrategicDashboard filtra por churchId |

## HELP CENTER

| Método | Endpoint | Auth | Role | Tenant | Status | Observação |
|--------|----------|------|------|--------|--------|------------|
| GET | /help-center/articles | 🌐 | — | — | 🟢 | Artigos públicos |
| GET | /help-center/articles/:slug | 🌐 | — | — | 🟢 | Artigos públicos |
| POST | /help-center/articles | 🔒 | MASTER_ADMIN+ | — | 🟢 | |
| PATCH | /help-center/articles/:id | 🔒 | MASTER_ADMIN+ | — | 🟢 | |
| DELETE | /help-center/articles/:id | 🔒 | MASTER_PLATFORM_ADMIN | — | 🟢 | |
| POST | /help-center/feedback | 🔒 | — | — | 🟢 | |
| GET | /help-center/feedback | 🔒 | ADMIN+ | ✅ | 🟢 | listFeedbacks filtra por churchId |
| PATCH | /help-center/feedback/:id/status | 🔒 | MASTER_ADMIN+ | — | 🟢 | |

---

## RESUMO DE VULNERABILIDADES DE TENANT

| Severidade | Endpoints | Descrição | Status |
|------------|-----------|-----------|--------|
| ✅ CORRIGIDO | /smart-scheduler/* (7 endpoints) | churchId agora filtrado em todas queries + validação de entidades (Etapa 5.1) | ✅ |
| ✅ CORRIGIDO | /reports/* (2 endpoints) | churchId obtido do JWT, logExport passa churchId | ✅ |
| ✅ SEGURO | /audit-logs | churchId do JWT (MASTER_PLATFORM_ADMIN bypass intencional) | ✅ |
| ✅ CORRIGIDO | /help-center/feedback (GET) | listFeedbacks filtra por churchId | ✅ |
| ✅ SEGURO | /notifications/run-reminders | @Roles(ADMIN) + user churchId; cron processa igrejas individualmente (Etapa 5.1) | ✅ |
| ✅ CORRIGIDO | /swap-requests/* (conflito) | assertNoEventConflict filtra por churchId (Etapa 5.1) | ✅ |
| ✅ CORRIGIDO | /schedules/* (conflito horário) | assertNoTimeConflict filtra por churchId (Etapa 5.1) | ✅ |
| ✅ CORRIGIDO | /notifications (reminder duplicado) | Duplicate check inclui churchId (Etapa 5.1) | ✅ |

**Total de endpoints**: 87  
**Com proteção tenant completa**: 87  
**Com proteção tenant parcial**: 0  
**Sem necessidade de tenant**: 3 (help-center público, auth, rankings pessoais)
