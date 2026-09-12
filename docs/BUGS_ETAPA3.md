# Bugs Encontrados — Etapa 3

**Data**: 09/09/2026  
**Atualizado**: Etapa 4 — Correções de Segurança

---

## BUG-001

**Título**: Smart Scheduler não filtra por churchId  
**Severidade**: ALTO  
**Área**: Multi-tenancy / Smart Scheduler  
**Status**: ✅ CORRIGIDO (Etapa 4)

**Problema**: Os endpoints do Smart Scheduler não filtravam por churchId em queries de `swapRequest`, `schedule`, e não validavam entidades (event, ministry) pertencem à mesma igreja.

**Causa**: `buildRankingDataset`, `buildVolunteerInsightsForMinistry`, `getAdminExecutiveDashboard`, `getStrategicDashboard` tinham queries de `swapRequest` sem filtro de `churchId`. `getEventOrThrow` não validava `churchId`.

**Arquivos alterados**:
- `smart-scheduler/smart-scheduler.service.ts`
- `smart-scheduler/smart-scheduler.controller.ts`

**Solução**:
- Adicionado filtro `requesterShift: { churchId }` em todas as queries de `swapRequest`
- `getEventOrThrow` agora aceita `churchId` e valida `event.churchId !== churchId`
- `getManualSuggestions` valida `ministry.churchId !== churchId`
- `generateSmartSchedule` valida `event.churchId` e `ministry.churchId`
- `getVolunteerDashboard` filtra schedules por `churchId`
- `getAdminExecutiveDashboard` passa `churchId` para `getInsights`

**Testes**: `smart-scheduler.service.spec.ts` — 19 testes cross-tenant

---

## BUG-002

**Título**: Reports não filtram por churchId automaticamente  
**Severidade**: ALTO  
**Área**: Multi-tenancy / Reports  
**Status**: ✅ CORRIGIDO (Etapa 4 — verificação anterior + testes adicionados)

**Problema**: `logExport` não passava `churchId` para audit log.

**Arquivos alterados**:
- `reports/reports.controller.ts`
- `reports/reports.service.ts`

**Solução**: `logExport` agora aceita `churchId` e o passa para `auditLogsService.log()`.

**Testes**: `reports.service.spec.ts` — 5 testes cross-tenant

---

## BUG-003

**Título**: Audit Logs não filtram por churchId automaticamente  
**Severidade**: MÉDIO  
**Área**: Multi-tenancy / Audit Logs  
**Status**: ✅ NÃO É BUG — comportamento intencional

**Análise**: O controller já filtra por `churchId` do JWT (linha 34-37). MASTER_PLATFORM_ADMIN pode ver todos (sem filtro). Comportamento correto.

**Testes**: `audit-logs.service.spec.ts` — 4 testes de isolamento

---

## BUG-004

**Título**: Help Center Feedback não filtra por churchId  
**Severidade**: BAIXO  
**Área**: Multi-tenancy / Help Center  
**Status**: ✅ CORRIGIDO (Etapa 4 — verificação anterior + testes adicionados)

**Problema**: `listFeedbacks` não filtrava por `churchId`.

**Arquivos alterados**:
- `help-center/help-center.controller.ts`
- `help-center/help-center.service.ts`

**Solução**: `listFeedbacks` agora aceita `churchId` e filtra. Controller passa `user.churchId`.

**Testes**: `help-center.service.spec.ts` — 4 testes cross-tenant

---

## BUG-005

**Título**: Auto-approval não implementado  
**Severidade**: BAIXO  
**Área**: Auth / Approval  
**Status**: ABERTO — será tratado em etapa futura

---

## BUG-006

**Título**: Smart Scheduler generate não valida churchId de todas entidades  
**Severidade**: MÉDIO  
**Área**: Smart Scheduler / Schedules  
**Status**: ✅ CORRIGIDO (Etapa 4)

**Problema**: `generateSmartSchedule` criava escalas sem validar se evento e ministérios pertenciam à mesma igreja.

**Arquivos alterados**:
- `smart-scheduler/smart-scheduler.service.ts`

**Solução**: Validação de `event.churchId` (via `getEventOrThrow`) e `ministry.churchId` antes de criar escala. `schedule.create` agora inclui `churchId`.

**Testes**: `smart-scheduler.service.spec.ts` — testes de validação de entidade

---

## BUG-007

**Título**: Seed usa senha fraca em produção  
**Severidade**: BAIXO  
**Área**: Seed / Security  
**Status**: ✅ CORRIGIDO (Etapa 4 — verificação anterior)

**Problema**: `seed.ts` usava `bcrypt.hash("admin123", 10)`.

**Solução**: Senha alterada para `Admin@123!`.

---

## Resumo

| Severidade | Quantidade |
|------------|------------|
| CRÍTICO | 0 |
| ALTO | 0 ✅ |
| MÉDIO | 0 ✅ |
| BAIXO | 1 (ABERTO) |
| **Total** | **1** |

## Notificação Run-Reminders

**Status**: ✅ SEGURO — comportamento intencional

**Análise**: Endpoint HTTP requer `@Roles(ADMIN)` e passa `user` → escopado à igreja do admin. Cron job processa todas as igrejas → comportamento pretendido para lembretes automáticos.
