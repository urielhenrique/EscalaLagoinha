# Matriz de Funcionalidades — Escala Fácil

**Data**: 10/09/2026  
**Etapa**: 6.1 — Consistência Documental

## Legenda

- 🟢 IMPLEMENTADO — Código existe, backend + frontend + banco
- 🟡 PARCIAL — Implementado parcialmente ou com limitações
- 🔴 QUEBRADO — Código existe mas com bugs críticos
- ⚪ NÃO IMPLEMENTADO — Não existe no código
- 🔵 NÃO TESTADO — Implementado mas não validado funcionalmente (ver nota sobre testes abaixo)

## Testes Automatizados

- **Backend**: 68/68 testes passando (Jest, 11 suites)
- **Frontend**: 8/8 testes passando (Vitest)
- **Build**: Backend e frontend compilando sem erros
- **Lint**: Backend 0 erros; Frontend 6 warnings (react-hooks/exhaustive-deps, não bloqueante)

---

## AUTENTICAÇÃO

| Funcionalidade | Frontend | Backend | Banco | Status | Arquivos |
|----------------|----------|---------|-------|--------|----------|
| Login | 🟢 | 🟢 | 🟢 | 🔵 | auth.controller.ts, auth.service.ts, LoginPage.tsx |
| Logout (limpar storage) | 🟢 | — | — | 🔵 | AuthContext.tsx |
| Cadastro (register) | 🟢 | 🟢 | 🟢 | 🔵 | auth.controller.ts, RegisterPage.tsx |
| Onboarding igreja | 🟢 | 🟢 | 🟢 | 🟡 | auth.service.ts:79-88 (restrito) |
| Aprovação voluntário | 🟢 | 🟢 | 🟢 | 🔵 | users.service.ts:195-245 |
| Rejeição voluntário | 🟢 | 🟢 | 🟢 | 🔵 | users.service.ts:247-297 |
| Recuperação de senha | 🟢 | 🟢 | 🟢 | 🔵 | auth.service.ts:270-295 |
| Reset de senha | 🟢 | 🟢 | 🟢 | 🔵 | auth.service.ts:297-302 |
| JWT (sign/verify) | — | 🟢 | — | 🟢 | jwt.strategy.ts |
| JWT invalidation (passwordChangedAt) | — | 🟢 | 🟢 | 🟢 | jwt.strategy.ts:34-47 |
| Roles (4 níveis) | 🟢 | 🟢 | 🟢 | 🔵 | roles.guard.ts, schema.prisma:10-15 |
| Senhas fortes (8+ chars) | 🟢 | 🟢 | — | 🟢 | is-strong-password.validator.ts |
| Rate limiting auth | — | 🟢 | — | 🟢 | auth.controller.ts:47,55 |

## USUÁRIOS

| Funcionalidade | Frontend | Backend | Banco | Status | Arquivos |
|----------------|----------|---------|-------|--------|----------|
| Ver perfil (me) | 🟢 | 🟢 | 🟢 | 🔵 | auth.controller.ts:50, MyProfilePage.tsx |
| Editar perfil (me) | 🟢 | 🟢 | — | 🔵 | auth.controller.ts:55 |
| Listar usuários | 🟢 | 🟢 | 🟢 | 🔵 | users.controller.ts:55, UsersPage.tsx |
| Criar usuário | 🟢 | 🟢 | 🟢 | 🔵 | users.controller.ts:48 |
| Editar usuário | 🟢 | 🟢 | — | 🔵 | users.controller.ts:89 |
| Desativar usuário | 🟢 | 🟢 | 🟢 | 🔵 | users.controller.ts:107 |
| Aprovar voluntário | 🟢 | 🟢 | 🟢 | 🔵 | users.controller.ts:96 |
| Rejeitar voluntário | 🟢 | 🟢 | 🟢 | 🔵 | users.controller.ts:103 |
| Listar pendentes | 🟢 | 🟢 | 🟢 | 🔵 | users.controller.ts:62 |

## IGREJA

| Funcionalidade | Frontend | Backend | Banco | Status | Arquivos |
|----------------|----------|---------|-------|--------|----------|
| Criar igreja | 🟡 | 🟢 | 🟢 | 🟡 | churches.controller.ts:54 (só MASTER_PLATFORM_ADMIN) |
| Listar igrejas | 🟢 | 🟢 | 🟢 | 🔵 | churches.controller.ts:30 |
| Igreja atual | 🟢 | 🟢 | 🟢 | 🔵 | churches.controller.ts:37 |
| Configurações | 🟢 | 🟢 | 🟢 | 🔵 | churches.controller.ts:62 |
| Branding (cores/logo) | 🟢 | 🟢 | 🟢 | 🔵 | ChurchSettings: primaryColor, secondaryColor, logoUrl |
| Invite link | 🟢 | 🟢 | — | 🔵 | churches.controller.ts:70 |
| Listar admins igreja | 🟢 | 🟢 | 🟢 | 🔵 | churches.controller.ts:77 |
| Alterar role admin | 🟢 | 🟢 | 🟢 | 🔵 | churches.controller.ts:84 |

## MINISTÉRIOS

| Funcionalidade | Frontend | Backend | Banco | Status | Arquivos |
|----------------|----------|---------|-------|--------|----------|
| Listar ministérios | 🟢 | 🟢 | 🟢 | 🔵 | ministries.controller.ts:30 |
| Meus ministérios | 🟢 | 🟢 | 🟢 | 🔵 | ministries.controller.ts:37 |
| Criar ministério | 🟢 | 🟢 | 🟢 | 🔵 | ministries.controller.ts:51 |
| Editar ministério | 🟢 | 🟢 | 🟢 | 🔵 | ministries.controller.ts:65 |
| Excluir ministério | 🟢 | 🟢 | 🟢 | 🔵 | ministries.controller.ts:72 |
| Seed ministérios padrão | 🟢 | 🟢 | 🟢 | 🟢 | seed.ts:172-218 (5 ministérios) |
| Associar voluntários | 🟢 | 🟢 | 🟢 | 🔵 | CreateMinistryDto: memberIds |
| Líder responsável | 🟢 | 🟢 | 🟢 | 🔵 | Ministry.leaderId |

**Ministérios seed (5)**: Foto, Vídeo, Projeção, Iluminação, Transmissão

## EVENTOS

| Funcionalidade | Frontend | Backend | Banco | Status | Arquivos |
|----------------|----------|---------|-------|--------|----------|
| Listar eventos | 🟢 | 🟢 | 🟢 | 🔵 | events.controller.ts:30 |
| Criar evento | 🟢 | 🟢 | 🟢 | 🔵 | events.controller.ts:44 |
| Editar evento | 🟢 | 🟢 | 🟢 | 🔵 | events.controller.ts:58 |
| Excluir evento | 🟢 | 🟢 | 🟢 | 🔵 | events.controller.ts:65 |
| Seed eventos padrão | 🟢 | 🟢 | 🟢 | 🟢 | seed.ts:221-279 (4 eventos) |
| Recorrência | 🟡 | 🟡 | 🟡 | ⚪ | Campo existe (recorrencia) mas não há lógica de recorrência |

**Eventos seed (4)**: Culto Domingo Manhã, Culto Domingo Noite, Culto de Jovens, Ensaio Worship

## ESCALAS

| Funcionalidade | Frontend | Backend | Banco | Status | Arquivos |
|----------------|----------|---------|-------|--------|----------|
| Criar escala | 🟢 | 🟢 | 🟢 | 🔵 | schedules.controller.ts:30 |
| Listar escalas | 🟢 | 🟢 | 🟢 | 🔵 | schedules.controller.ts:37 |
| Ver escala por ID | 🟢 | 🟢 | 🟢 | 🔵 | schedules.controller.ts:44 |
| Editar escala | 🟢 | 🟢 | 🟢 | 🔵 | schedules.controller.ts:51 |
| Cancelar escala | 🟢 | 🟢 | 🟢 | 🔵 | schedules.controller.ts:58 |
| Conflito de horário | — | 🟢 | — | 🔵 | schedules.service.ts:122-162 |
| Validação mesma igreja | — | 🟢 | — | 🔵 | schedules.service.ts:78-120 |
| Filtros (evento/ministério/voluntário) | 🟢 | 🟢 | — | 🔵 | schedules.controller.ts:37 |

## DISPONIBILIDADE

| Funcionalidade | Frontend | Backend | Banco | Status | Arquivos |
|----------------|----------|---------|-------|--------|----------|
| Minha disponibilidade | 🟢 | 🟢 | 🟢 | 🔵 | availability.controller.ts:30 |
| Disponibilidade semanal | 🟢 | 🟢 | 🟢 | 🔵 | availability.controller.ts:37 |
| 7 dias da semana | — | 🟢 | 🟢 | 🟢 | AvailabilityDayOfWeek enum |
| 3 períodos (manhã/tarde/noite) | — | 🟢 | 🟢 | 🟢 | AvailabilityPeriod enum |
| Estados (disponível/indisponível/preferencial) | — | 🟢 | 🟢 | 🟢 | AvailabilityPreference enum |
| Regra: sem slots = disponível | — | 🟢 | — | 🔵 | availability.service.ts:420-435 |
| Preferência de ministério | 🟢 | 🟢 | 🟢 | 🔵 | availability.controller.ts:44 |
| Datas bloqueadas | 🟢 | 🟢 | 🟢 | 🔵 | availability.controller.ts:51 |
| Bloqueio data única | — | 🟢 | 🟢 | 🔵 | addBlockedDate |
| Bloqueio intervalo | — | 🟢 | 🟢 | 🔵 | addBlockedDate with endDate |
| Remoção bloqueio | — | 🟢 | 🟢 | 🔵 | removeBlockedDate, removeBlockedDateRange |

## TROCAS

| Funcionalidade | Frontend | Backend | Banco | Status | Arquivos |
|----------------|----------|---------|-------|--------|----------|
| Listar elegíveis | 🟢 | 🟢 | 🟢 | 🔵 | swap-requests.controller.ts:30 |
| Solicitar troca | 🟢 | 🟢 | 🟢 | 🔵 | swap-requests.controller.ts:37 |
| Minhas solicitações | 🟢 | 🟢 | 🟢 | 🔵 | swap-requests.controller.ts:44 |
| Solicitações recebidas | 🟢 | 🟢 | 🟢 | 🔵 | swap-requests.controller.ts:51 |
| Histórico | 🟢 | 🟢 | 🟢 | 🔵 | swap-requests.controller.ts:58 |
| Aprovar troca | 🟢 | 🟢 | 🟢 | 🔵 | swap-requests.controller.ts:65 |
| Recusar troca | 🟢 | 🟢 | 🟢 | 🔵 | swap-requests.controller.ts:72 |
| Cancelar troca | 🟢 | 🟢 | 🟢 | 🔵 | swap-requests.controller.ts:79 |
| Regra: mesmo ministério | — | 🟢 | — | 🟢 | swap-requests.service.ts:238-242 |
| Regra: sem auto-troca | — | 🟢 | — | 🟢 | swap-requests.service.ts:232-236 |
| Regra: sem conflito | — | 🟢 | — | 🔵 | swap-requests.service.ts:99-130 |
| Regra: disponibilidade | — | 🟢 | — | 🔵 | swap-requests.service.ts:391-415 |

## NOTIFICAÇÕES

| Funcionalidade | Frontend | Backend | Banco | Status | Arquivos |
|----------------|----------|---------|-------|--------|----------|
| Listar notificações | 🟢 | 🟢 | 🟢 | 🔵 | notifications.controller.ts:30 |
| Contador não-lidas | 🟢 | 🟢 | 🟢 | 🔵 | notifications.controller.ts:37 |
| Marcar como lida | 🟢 | 🟢 | 🟢 | 🔵 | notifications.controller.ts:44 |
| Marcar todas como lidas | 🟢 | 🟢 | 🟢 | 🔵 | notifications.controller.ts:51 |
| Remover notificação | 🟢 | 🟢 | 🟢 | 🔵 | notifications.controller.ts:58 |
| Lembretes | 🟢 | 🟢 | 🟢 | 🔵 | notifications.controller.ts:65 |
| Email (via Resend) | — | 🟢 | — | 🔵 | email.service.ts |
| In-app notifications | 🟢 | 🟢 | 🟢 | 🔵 | notification.type enum |

**Tipos de notificação (9)**: SCALE_CREATED, REMINDER, SWAP_REQUEST, SWAP_APPROVED, SWAP_DECLINED, SCALE_CANCELLED, USER_APPROVED, USER_REJECTED, NEW_VOLUNTEER_PENDING

## CALENDÁRIO

| Funcionalidade | Frontend | Backend | Banco | Status | Arquivos |
|----------------|----------|---------|-------|--------|----------|
| Google Calendar | ⚪ | ⚪ | ⚪ | ⚪ | NÃO IMPLEMENTADO |

## RELATÓRIOS

| Funcionalidade | Frontend | Backend | Banco | Status | Arquivos |
|----------------|----------|---------|-------|--------|----------|
| Overview | 🟢 | 🟢 | 🟢 | 🔵 | reports.controller.ts:30 |
| Exportação (CSV/XLSX/PDF) | 🟢 | 🟢 | — | 🔵 | reports.controller.ts:37 |
| Dashboard executivo | 🟢 | 🟢 | 🟢 | 🔵 | smart-scheduler.controller.ts:37 |
| Dashboard voluntário | 🟢 | 🟢 | 🟢 | 🔵 | smart-scheduler.controller.ts:51 |
| Ranking | 🟢 | 🟢 | 🟢 | 🔵 | smart-scheduler.controller.ts:30 |
| Insights por evento | 🟢 | 🟢 | 🟢 | 🔵 | smart-scheduler.controller.ts:58 |

## AUDITORIA

| Funcionalidade | Frontend | Backend | Banco | Status | Arquivos |
|----------------|----------|---------|-------|--------|----------|
| Listar logs | 🟢 | 🟢 | 🟢 | 🔵 | audit-logs.controller.ts:30 |
| Criação de logs | — | 🟢 | 🟢 | 🟢 | audit-logs.service.ts:31-43 |
| Registro de ações | — | 🟢 | 🟢 | 🟢 | Chamado em: users, schedules, swap-requests, churches |
| Old/New values | — | 🟢 | 🟢 | 🟢 | AuditLog.oldValue, AuditLog.newValue |

**Ações registradas**: USER_CREATED, USER_APPROVED, USER_REJECTED, USER_UPDATED, USER_DEACTIVATED, SCHEDULE_CREATED, SCHEDULE_UPDATED, SCHEDULE_CANCELLED, SWAP_REQUEST_CREATED, SWAP_REQUEST_APPROVED, SWAP_REQUEST_REJECTED, SWAP_REQUEST_CANCELLED

## SMART SCHEDULER (regras/heurísticas locais)

| Funcionalidade | Frontend | Backend | Banco | Status | Arquivos |
|----------------|----------|---------|-------|--------|----------|
| Ranking voluntários | 🟢 | 🟢 | 🟢 | 🔵 | smart-scheduler.service.ts:836 |
| Sugestões manuais | 🟢 | 🟢 | 🟢 | 🔵 | smart-scheduler.service.ts:1161 |
| Gerar escala automática | 🟢 | 🟢 | 🟢 | 🔵 | smart-scheduler.service.ts:1197 |
| Insights por evento (heurística local) | 🟢 | 🟢 | 🟢 | 🔵 | smart-scheduler.service.ts:1310 |
| AI enhancer (OpenAI) | ⚪ | ⚪ | — | ⚪ | ADIADO — Custo operacional de APIs de IA/tokens |
| Dashboard estratégico | 🟢 | 🟢 | 🟢 | 🔵 | smart-scheduler.service.ts:1411 |

**Nota**: "Insights por evento" são gerados por heurísticas/regras locais do sistema (análise de risco de ausência, sobrecarga, subutilização). NÃO dependem de Inteligência Artificial. A funcionalidade AI Enhancer (OpenAI) foi adiada na Etapa 6 e não faz parte do fluxo ativo.

## CENTRAL DE AJUDA

| Funcionalidade | Frontend | Backend | Banco | Status | Arquivos |
|----------------|----------|---------|-------|--------|----------|
| Listar artigos | 🟢 | 🟢 | 🟢 | 🔵 | help-center.controller.ts:30 |
| Ver artigo por slug | 🟢 | 🟢 | 🟢 | 🔵 | help-center.controller.ts:37 |
| Criar artigo | 🟢 | 🟢 | 🟢 | 🔵 | help-center.controller.ts:44 |
| Editar artigo | 🟢 | 🟢 | 🟢 | 🔵 | help-center.controller.ts:51 |
| Excluir artigo | 🟢 | 🟢 | 🟢 | 🔵 | help-center.controller.ts:58 |
| Feedback | 🟢 | 🟢 | 🟢 | 🔵 | help-center.controller.ts:65 |
| Listar feedback | 🟢 | 🟢 | 🟢 | 🔵 | help-center.controller.ts:72 |
| Status feedback | 🟢 | 🟢 | 🟢 | 🔵 | help-center.controller.ts:79 |

## PRESENÇA

| Funcionalidade | Frontend | Backend | Banco | Status | Arquivos |
|----------------|----------|---------|-------|--------|----------|
| Minha presença | 🟢 | 🟢 | 🟢 | 🔵 | attendance.controller.ts:30 |
| Presença por evento | 🟢 | 🟢 | 🟢 | 🔵 | attendance.controller.ts:37 |
| Confirmar participação | 🟢 | 🟢 | 🟢 | 🔵 | attendance.controller.ts:44 |
| Check-in | 🟢 | 🟢 | 🟢 | 🔵 | attendance.controller.ts:51 |
| Marcar status | 🟢 | 🟢 | 🟢 | 🔵 | attendance.controller.ts:58 |

---

## RESUMO

| Status | Observação |
|--------|------------|
| 🟢 IMPLEMENTADO | Maioria das funcionalidades de autenticação, usuários, igrejas, ministérios, eventos, escalas, disponibilidade, trocas, notificações, relatórios, auditoria, smart scheduler, central de ajuda e presença |
| 🟡 PARCIAL | Onboarding igreja (restrito), recorrência de eventos (campo existe sem lógica) |
| 🔴 QUEBRADO | Nenhum |
| ⚪ NÃO IMPLEMENTADO | Google Calendar, AI Enhancer (adiado) |
| 🔵 NÃO TESTADO | Funcionalidades implementadas que ainda não foram validadas funcionalmente com testes automatizados (a maioria). Testes unitários cobrem 68 cenários no backend e 8 no frontend |
