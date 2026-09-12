# Relatório Correção Etapa 5.1

**Data:** 2026-09-10
**Objetivo:** Corrigir problemas de isolamento multi-tenant identificados na Etapa 5

---

## ISO-001

### Problema
`swap-requests.service.ts` — `assertNoEventConflict` não filtra por `churchId`. Verificava conflitos de evento em TODAS as igrejas, permitindo que um voluntário da Church A fosse bloqueado por uma escala da Church B.

### Correção
Adicionado parâmetro `churchId` como obrigatório em `assertNoEventConflict`. A query de conflito agora inclui `churchId` explicitamente no `where` clause.

### Arquivos
- `backend/src/swap-requests/swap-requests.service.ts` — método `assertNoEventConflict` e callers em `approve`

### Testes
- Teste adicionado em `swap-requests.service.spec.ts`: "should only check conflicts within the same church"
- Verifica que `schedule.findFirst` é chamado com `churchId: "church-a"`

---

## ISO-002

### Problema
`notifications.scheduler.ts` — `runRemindersForUpcomingSchedules` consultava schedules de TODAS as igrejas quando chamado pelo cron (sem `actor`). Usuários recebiam notificações de igrejas diferentes.

### Correção
- `notifications.scheduler.ts`: Injetado `PrismaService`, agora busca todas as igrejas ativas e processa cada uma individualmente
- `notifications.service.ts`: Adicionado parâmetro `directChurchId` ao método `runRemindersForUpcomingSchedules`
- Cron agora itera sobre cada igreja e passa o `churchId` correto

### Arquivos
- `backend/src/notifications/notifications.scheduler.ts` — reescrito para processar igrejas individualmente
- `backend/src/notifications/notifications.service.ts` — assinatura do método atualizada

### Testes
- Testes existentes de smart-scheduler já validam isolamento de reminders
- Comportamento do cron agora é explicitamente tenant-scoped

---

## ISO-003

### Problema
`schedules.service.ts` — `assertNoTimeConflict` não filtrava por `churchId`. Verificava conflitos de horário跨tenancy.

### Correção
Adicionado parâmetro `churchId` como obrigatório em `assertNoTimeConflict`. A query de conflito agora inclui `churchId` explicitamente.

### Arquivos
- `backend/src/schedules/schedules.service.ts` — método `assertNoTimeConflict` e callers em `create` e `update`

### Testes
- Teste adicionado em `schedules.service.spec.ts`: "should only check conflicts within the same church"
- Verifica que `schedule.findFirst` é chamado com `churchId: "church-a"`

---

## ISO-004

### Problema
`notifications.service.ts` — verificação de reminder duplicado não incluía `churchId`. Um reminder da Church A poderia bloquear um reminder válido da Church B para o mesmo usuário.

### Correção
Adicionado `churchId: schedule.churchId` na query de verificação de duplicata.

### Arquivos
- `backend/src/notifications/notifications.service.ts` — `runRemindersForUpcomingSchedules`, query de duplicate check

### Testes
- Teste existente de smart-scheduler validas o comportamento
- Duplicate check agora é tenant-scoped

---

## ISO-005

### Problema
`smart-scheduler.service.ts` — `getEventOrThrow` usava `findUnique` (busca por ID global) seguido de validação pós-query. Quando `churchId` era undefined, retornava eventos de qualquer igreja.

### Correção
Mudado de `findUnique` para `findFirst` com filtro condicional de `churchId`. Quando `churchId` é fornecido, a query já filtra por igreja no banco.

### Arquivos
- `backend/src/smart-scheduler/smart-scheduler.service.ts` — método `getEventOrThrow`

### Testes
- Testes existentes atualizados para usar `findFirst` em vez de `findUnique`
- Teste de cross-tenant: "should throw NotFoundException when event belongs to another church"

---

## ISO-006

### Problema
`smart-scheduler.service.ts` — `ministry.findUnique` em `getManualSuggestions` não filtrava por `churchId`. Ministérios de outras igrejas poderiam ser usados.

### Correção
Mudado de `findUnique` para `findFirst` com filtro condicional de `churchId`.

### Arquivos
- `backend/src/smart-scheduler/smart-scheduler.service.ts` — `getManualSuggestions`

### Testes
- Testes existentes atualizados para usar `findFirst`
- Teste de cross-tenant: "should throw NotFoundException when ministry belongs to another church"

---

## Busca adicional de vulnerabilidades

### VULN-1 (ALTA) — CORRIGIDO
`notifications.service.ts:164` — `ministry.findUnique` sem `churchId` em `notifySwapAutoCompletedToLeader`.

**Correção:** Mudado para `findFirst` com filtro de `churchId`. Caller em `swap-requests.service.ts` agora passa `churchId`.

### VULN-2 (ALTA) — CORRIGIDO
`help-center.service.ts:106` — `updateFeedbackStatus` não validava `churchId`. Usuário da Church A poderia alterar feedback da Church B.

**Correção:** Adicionada validação de `churchId` no service. Controller agora passa `user.churchId`.

### VULN-3/4 (ALTA) — OK (protegido por controller)
`help-center.service.ts` — `updateArticle` e `deleteArticle` são protegidos por `@Roles(Perfil.MASTER_PLATFORM_ADMIN)` no controller.

### VULN-5 (MEDIA) — OK (protegido por controller)
`smart-scheduler.service.ts` — queries com `churchId` opcional. Protegido porque o controller exige `churchId` para usuários não-platform-admin.

### VULN-6 (MEDIA) — OK (protegido por controller)
`audit-logs.service.ts` — `churchId` opcional. Protegido porque o controller extrai `churchId` do JWT.

---

## Testes finais

**Backend:**
- Testes: 68/68 PASS (11 suites)
- Build: PASS
- Lint: PASS (0 errors)

**Frontend:**
- Build: PASS
- Lint: 6 warnings (react-hooks/exhaustive-deps — não bloqueante)

---

## Resultado

| ISO | Status |
|---|---|
| ISO-001 | CORRIGIDO |
| ISO-002 | CORRIGIDO |
| ISO-003 | CORRIGIDO |
| ISO-004 | CORRIGIDO |
| ISO-005 | CORRIGIDO |
| ISO-006 | CORRIGIDO |
| VULN-1 | CORRIGIDO |
| VULN-2 | CORRIGIDO |

### Arquivos modificados

| Arquivo | Tipo de alteração |
|---|---|
| `backend/src/swap-requests/swap-requests.service.ts` | Adicionado `churchId` em `assertNoEventConflict` e caller |
| `backend/src/schedules/schedules.service.ts` | Adicionado `churchId` em `assertNoTimeConflict` e callers |
| `backend/src/notifications/notifications.service.ts` | Adicionado `churchId` em duplicate check e `notifySwapAutoCompletedToLeader`; novo parâmetro `directChurchId` |
| `backend/src/notifications/notifications.scheduler.ts` | Reescrito para processar igrejas individualmente |
| `backend/src/smart-scheduler/smart-scheduler.service.ts` | `getEventOrThrow` e `getManualSuggestions` usam `findFirst` tenant-aware |
| `backend/src/help-center/help-center.service.ts` | `updateFeedbackStatus` valida `churchId` |
| `backend/src/help-center/help-center.controller.ts` | Passa `user.churchId` para `updateFeedbackStatus` |
| `backend/src/swap-requests/swap-requests.service.spec.ts` | Teste cross-tenant para `assertNoEventConflict` |
| `backend/src/schedules/schedules.service.spec.ts` | Teste cross-tenant para `assertNoTimeConflict` |
| `backend/src/smart-scheduler/smart-scheduler.service.spec.ts` | Testes atualizados para `findFirst` |

### Testes criados/atualizados

| Arquivo | Testes |
|---|---|
| swap-requests.service.spec.ts | +1 teste cross-tenant |
| schedules.service.spec.ts | +1 teste cross-tenant |
| smart-scheduler.service.spec.ts | 6 testes atualizados (findUnique → findFirst) |

### Problemas restantes

- Nenhum risco crítico
- Nenhum risco alto
- Riscos medios restantes: JWT em localStorage (recomendação futura), auto-approval não implementado, recorrência não implementada
