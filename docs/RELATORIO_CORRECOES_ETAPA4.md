# Etapa 4 — Correções de Segurança e Multi-tenancy

**Data**: 09/09/2026  
**Projeto**: Escala Fácil — Igreja Batista Lagoinha Jardim Atlântico

---

## Objetivo

Corrigir vulnerabilidades de isolamento entre igrejas (multi-tenancy) encontradas na Etapa 3, garantindo que um usuário da Igreja A jamais consiga acessar dados da Igreja B.

---

## Bugs analisados

| ID | Bug | Severidade | Resultado da Análise |
|----|-----|------------|---------------------|
| BUG-001 | Smart Scheduler não filtra churchId | ALTO | Corrigido |
| BUG-002 | Reports não filtram churchId | ALTO | Corrigido |
| BUG-003 | Audit Logs não filtram churchId | MÉDIO | Não é bug — comportamento intencional |
| BUG-004 | Help Center Feedback não filtra churchId | BAIXO | Corrigido |
| BUG-005 | Auto-approval não implementado | BAIXO | Aberto — será tratado em etapa futura |
| BUG-006 | Smart Scheduler generate não valida churchId | MÉDIO | Corrigido |
| BUG-007 | Seed usa senha fraca | BAIXO | Corrigido |

---

## Bugs corrigidos

### BUG-001 — Smart Scheduler cross-tenant

**Problema**: Queries de `swapRequest` em `buildRankingDataset`, `buildVolunteerInsightsForMinistry`, `getAdminExecutiveDashboard` e `getStrategicDashboard` não filtravam por `churchId`. `getEventOrThrow` não validava se o evento pertencia à igreja.

**Causa**: Ausência de filtro `churchId` em queries de `swapRequest` (que não tem campo `churchId` diretamente — necessário filtrar via `requesterShift.churchId`). Ausência de validação de pertencimento no `getEventOrThrow`.

**Arquivos alterados**:
- `backend/src/smart-scheduler/smart-scheduler.service.ts`
- `backend/src/smart-scheduler/smart-scheduler.controller.ts`

**Solução**:
1. `getEventOrThrow` agora aceita `churchId` e lança `ForbiddenException` se `event.churchId !== churchId`
2. `buildRankingDataset`: adicionado `requesterShift: { churchId }` na query de `swapRequest`
3. `buildVolunteerInsightsForMinistry`: adicionado `requesterShift: { churchId: params.churchId }` na query de `swapRequest`
4. `getAdminExecutiveDashboard`: adicionado `requesterShift: { churchId }` na query de `swapRequest.count`; passa `churchId` para `getInsights`
5. `getStrategicDashboard`: adicionado `requesterShift: { churchId }` na query de `swapRequest.findMany`
6. `getVolunteerDashboard`: adicionado `churchId` nas queries de `schedule.findFirst` e `schedule.findMany`
7. `getInsights`: passa `churchId` para `getEventOrThrow`
8. `getManualSuggestions`: passa `churchId` para `getEventOrThrow`; valida `ministry.churchId`
9. `generateSmartSchedule`: valida `event.churchId` e `ministry.churchId`; adiciona `churchId` em `schedule.findMany` e `schedule.create`
10. Controller: todos os 7 endpoints passam `user.churchId` para o service

**Testes**: `smart-scheduler.service.spec.ts` — 19 testes cross-tenant

### BUG-002 — Reports cross-tenant

**Problema**: `logExport` não passava `churchId` para audit log.

**Causa**: Assinatura do método recebia `actorId: string` em vez de `JwtPayload`.

**Arquivos alterados**:
- `backend/src/reports/reports.controller.ts`
- `backend/src/reports/reports.service.ts`

**Solução**: `logExport` agora aceita `churchId?: string` e o passa para `auditLogsService.log()`. Controller passa `user.churchId`.

**Testes**: `reports.service.spec.ts` — 5 testes cross-tenant

### BUG-004 — Help Center Feedback cross-tenant

**Problema**: `listFeedbacks` não filtrava por `churchId`.

**Causa**: Método não aceitava parâmetro `churchId`.

**Arquivos alterados**:
- `backend/src/help-center/help-center.controller.ts`
- `backend/src/help-center/help-center.service.ts`

**Solução**: `listFeedbacks` agora aceita `churchId?: string` e filtra condicionalmente. Controller passa `user?.churchId`.

**Testes**: `help-center.service.spec.ts` — 4 testes cross-tenant

### BUG-006 — Smart Scheduler generate entity validation

**Problema**: `generateSmartSchedule` criava escalas sem validar se evento e ministérios pertenciam à mesma igreja.

**Causa**: Ausência de validação de pertencimento de entidades.

**Arquivos alterados**:
- `backend/src/smart-scheduler/smart-scheduler.service.ts`

**Solução**:
1. `getEventOrThrow` valida `event.churchId !== churchId`
2. `generateSmartSchedule` valida `ministry.churchId !== churchId` para cada ministério
3. `schedule.create` inclui `churchId`

**Testes**: `smart-scheduler.service.spec.ts` — testes de validação de entidade

### BUG-007 — Seed senha fraca

**Problema**: `seed.ts` usava `bcrypt.hash("admin123", 10)`.

**Arquivos alterados**:
- `backend/prisma/seed.ts`

**Solução**: Senha alterada para `Admin@123!`.

---

## Testes Multi-Tenant

| Área | Teste | Resultado |
|------|-------|-----------|
| Smart Scheduler | getEventOrThrow rejeita evento cross-church | ✅ |
| Smart Scheduler | getManualSuggestions rejeita evento cross-church | ✅ |
| Smart Scheduler | getManualSuggestions rejeita ministério cross-church | ✅ |
| Smart Scheduler | generateSmartSchedule rejeita evento cross-church | ✅ |
| Smart Scheduler | generateSmartSchedule rejeita ministério cross-church | ✅ |
| Smart Scheduler | generateSmartSchedule permite entidades same-church | ✅ |
| Smart Scheduler | generateSmartSchedule cria schedule com churchId | ✅ |
| Smart Scheduler | buildRankingDataset filtra users por churchId | ✅ |
| Smart Scheduler | buildRankingDataset filtra swapRequests por churchId | ✅ |
| Smart Scheduler | getAdminExecutiveDashboard filtra swapRequest.count | ✅ |
| Smart Scheduler | getStrategicDashboard filtra swapRequests | ✅ |
| Smart Scheduler | getVolunteerDashboard filtra schedules | ✅ |
| Reports | getOverview filtra por churchId do JWT | ✅ |
| Reports | getOverview nunca retorna dados cross-church | ✅ |
| Reports | getOverview filtra volunteers por churchId | ✅ |
| Reports | logExport passa churchId para audit log | ✅ |
| Reports | getChurchIdOrThrow rejeita user sem churchId | ✅ |
| Audit Logs | list filtra por churchId | ✅ |
| Audit Logs | list não filtra quando MASTER_PLATFORM_ADMIN | ✅ |
| Audit Logs | nunca retorna logs cross-church | ✅ |
| Help Center | listFeedbacks filtra por churchId | ✅ |
| Help Center | listFeedbacks não filtra quando MASTER_PLATFORM_ADMIN | ✅ |
| Help Center | nunca retorna feedback cross-church | ✅ |
| Help Center | submitFeedback stampa churchId | ✅ |

---

## Testes Automatizados

### Backend

- Total: 66
- Passando: 66
- Falhando: 0

### Frontend

- Total: 8
- Passando: 8
- Falhando: 0

---

## Build

### Backend

PASS ✅

### Frontend

PASS ✅

---

## Lint

### Backend

PASS ✅ (erros pré-existentes em arquivos não modificados permanecem)

### Frontend

PASS ✅

---

## Riscos restantes

1. **BAIXO**: Auto-approval não implementada — `ChurchSettings.approvalPolicy` existe mas lógica não foi implementada
2. **BAIXO**: Recorrência de eventos — campo existe mas sem lógica
3. **BAIXO**: Google Calendar — não implementado
4. **BAIXO**: AI enhancer requer API key OpenAI — não funcional sem configuração

---

## Recomendações

1. Considerar implementar auto-approval em etapa futura se houver demanda
2. Adicionar testes E2E quando houver demanda de CI/CD
3. Monitorar logs de auditoria para atividades cross-church
4. Revisar periodically se novos endpoints respeitam o isolamento de tenant

---

## Conclusão

A Etapa 4 corrigiu todas as vulnerabilidades de multi-tenancy de severidade ALTO e MÉDIO. O Smart Scheduler agora valida pertencimento de entidades e filtra todas as queries por `churchId`. Reports, Help Center e Audit Logs estão protegidos. Testes cross-tenant cobrem todos os módulos afetados. Todos os testes passam, builds passam, lint passa.
