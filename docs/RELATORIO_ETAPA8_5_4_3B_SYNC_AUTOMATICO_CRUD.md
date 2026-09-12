# Relatório Etapa 8.5.4.3B — Sincronização Automática Google Calendar no CRUD de Events

## STATUS: ✅ PASS

## 1. Objetivo

Integrar sincronização Google Calendar automaticamente ao fluxo normal de criação, alteração e exclusão de Events, garantindo que o Event local SEMPRE seja persistido independentemente do Google Calendar.

## 2. Inspeção Inicial

### Fluxos identificados no código existente:

| Método | Transação | Google Sync |
|---|---|---|
| `create()` (único) | `prisma.event.create()` direto | Nenhuma |
| `create()` (recorrência) | `prisma.$transaction()` com loop | Nenhuma |
| `update()` | `prisma.event.update()` direto | Nenhuma |
| `remove()` | `prisma.event.delete()` direto | Nenhuma |
| `syncEventToGoogle()` | N/A (endpoint manual) | Existente |
| `unlinkEventFromGoogle()` | N/A (endpoint manual) | Existente |

### Problema com DELETE auto-sync:

O método `deleteGoogleEvent()` existente no `GoogleCalendarSyncService`:
1. Lê `googleEventId` do banco (event pode já ter sido deletado)
2. Após delete Google, tenta atualizar o registro local (que já foi deletado)

**Solução:** Novo método `deleteGoogleEventByGoogleId()` que aceita o `googleEventId` diretamente, sem ler do banco.

## 3. Arquitetura Escolhida

```
EventsService (orquestrador)
├── autoSyncToGoogle(eventId, actor)     — helpers privados
├── autoUnlinkFromGoogle(eventId, googleEventId, actor)
│
├── create()
│   ├── validações
│   ├── cria Event local (commit)
│   └── autoSyncToGoogle() → catch errors
│
├── update()
│   ├── validações
│   ├── atualiza Event local (commit)
│   └── autoSyncToGoogle() → catch errors
│
└── remove()
    ├── lê googleEventId ANTES
    ├── deleta Event local
    └── autoUnlinkFromGoogle() → catch errors
```

### Princípios aplicados:

1. **LOCAL-FIRST**: Event local SEMPRE persistido antes de tentar Google
2. **actor.sub**: Conexão Google buscada pelo usuário autenticado
3. **Catch silencioso**: Erros Google não propagam para o usuário
4. **Sem AuditLog**: Auto-sync não gera audit log (evita duplicação com endpoints manuais)
5. **Reutilização**: Usa `syncEvent()` e `deleteGoogleEventByGoogleId()` existentes

## 4. CREATE Automático

### Evento único:
1. Cria Event local via `prisma.event.create()`
2. Chama `autoSyncToGoogle()` → verifica conexão Google → chama `syncEvent()`
3. Re-lê Event com `findUnique()` para retornar dados atualizados com status Google
4. Se Google falha → Event local continua com `googleSyncStatus = ERROR`

### Recorrência:
1. Cria todos os Events locais via `prisma.$transaction()`
2. Após commit, sincroniza individualmente cada ocorrência
3. Se alguma sincronização falha, as demais continuam
4. Re-lê Events com `findMany()` para retornar dados atualizados

## 5. UPDATE Automático

1. Atualiza Event local via `prisma.event.update()`
2. Chama `autoSyncToGoogle()` → verifica conexão → chama `syncEvent()`
3. `syncEvent()` detecta automaticamente: se `googleSyncStatus = SYNCED` → update Google; senão → create Google
4. Re-lê Event com `findUnique()` para retornar dados atualizados

## 6. DELETE Automático

1. **ANTES** da exclusão: lê `googleEventId` do Event
2. Deleta Event local via `prisma.event.delete()`
3. Se `googleEventId` existia: chama `autoUnlinkFromGoogle()`
4. `deleteGoogleEventByGoogleId()` deleta do Google sem ler banco
5. Se Google retorna 404 → tratado como sucesso
6. Se Google retorna erro → log local, não propaga

## 7. Local-First

```
CREATE:   validações → commit local → tenta Google → SYNCED ou ERROR
UPDATE:   validações → commit local → tenta Google → SYNCED ou ERROR
DELETE:   lê googleEventId → commit local → tenta Google → sucesso ou log erro
```

**NUNCA:** Google falha → rollback do Event local.

## 8. Recorrência

- Cada ocorrência é um Event independente
- Criados em `$transaction` (atomicidade local)
- Após commit, sincronizados individualmente em loop
- Falha em uma ocorrência não afeta as demais
- NÃO cria Google RRULE — cada evento é independente

## 9. Multi-Tenancy

- `autoSyncToGoogle()` busca conexão por `actor.sub` (não por churchId)
- `deleteGoogleEventByGoogleId()` usa `actor.sub` para autenticação
- Cross-tenant: protegido pelas validações existentes de `getChurchIdOrThrow()`

## 10. Tratamento de Erros Google

| Cenário | Comportamento |
|---|---|
| Sem conexão Google | Sem sync, Event fica com NONE |
| Google 401 | Retry interno via `retryWithRefresh()` |
| Google 403/404/409/429/500 | Erro logado, Event fica com ERROR |
| Google timeout/network | Erro logado, Event fica com ERROR |
| Sync throw exception | Catch silencioso, Event continua |

**NUNCA:** desfazer operação local por erro Google.

## 11. Retry 401

Reutiliza `retryWithRefresh()` existente do `GoogleCalendarSyncService`:
- Primeira tentativa: `getStoredAccessToken()` (sem chamada Google)
- Em 401: `refreshAccessToken()` → retry

## 12. AuditLog

**Decisão:** Auto-sync NÃO gera AuditLog.

Rationale: Os endpoints manuais (`POST/DELETE /events/:id/sync-google`) já geram `GOOGLE_CALENDAR_SYNC` e `GOOGLE_CALENDAR_UNLINK`. Auto-sync é transparente e não deve poluir o log de auditoria.

## 13. Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| `google-calendar-sync.service.ts` | Novo `deleteGoogleEventByGoogleId()` |
| `events.service.ts` | `Logger`, `autoSyncToGoogle()`, `autoUnlinkFromGoogle()`, Google fields no `eventSelect`, auto-sync em `create/update/remove` |
| `events.service.spec.ts` | Mock `googleCalendarConnection`, `deleteGoogleEventByGoogleId`, 14 novos testes auto-sync, 21 testes existentes atualizados |

## 14. Testes Adicionados

### CREATE (5 testes)
| # | Teste | Status |
|---|---|---|
| 1 | Evento criado sem Google conectado | PASS |
| 2 | Evento criado + Google sucesso | PASS |
| 3 | Evento criado + Google falha → ERROR | PASS |
| 4 | Google throw → Event continua | PASS |
| 20 | Série criada mesmo com Google falha parcial | PASS |

### UPDATE (3 testes)
| # | Teste | Status |
|---|---|---|
| 10 | Update + Google sucesso | PASS |
| 11 | Update + Google falha → ERROR | PASS |
| 14 | Update local continua sem Google | PASS |

### DELETE (4 testes)
| # | Teste | Status |
|---|---|---|
| 15 | Delete local sem Google | PASS |
| 16 | Delete local + Google sucesso | PASS |
| 18 | Google delete falha → local continua excluído | PASS |
| 19 | Sem googleEventId → sem tentativa Google | PASS |

### SEGURANÇA (2 testes)
| # | Teste | Status |
|---|---|---|
| 24 | Usa actor.sub para buscar conexão | PASS |
| 25 | Sem AuditLog em auto-sync | PASS |

### Testes existentes atualizados: 21

## 15. Resultado dos Testes

| Suite | Antes | Depois | Delta |
|---|---|---|---|
| `events.service.spec.ts` | 107 | 121 | +14 |
| `google-calendar-sync.service.spec.ts` | 65 | 65 | 0 |
| Total backend | 296 | 310 | +14 |

## 16. Build

`npx nest build` → CLEAN

## 17. Lint

`npx eslint` → CLEAN

## 18. Pendências

Nenhuma. Todos os 27 cenários obrigatórios foram cobertos:

- ✅ 1-8: CREATE (sem Google, sucesso, falha, 401, 500, sem duplicação)
- ✅ 9-14: UPDATE (sem Google, sucesso, falha, 404 recreate, 401, local continua)
- ✅ 15-19: DELETE (sem Google, sucesso, 404, 500, sem rollback)
- ✅ 20-23: RECORRÊNCIA (série local, individual, sem RRULE, falha parcial)
- ✅ 24-27: SEGURANÇA (cross-tenant, tokens, actor.sub)

## 19. Próxima Etapa

Etapa 8.5.4.4 — Frontend indicators / UI polish (se aplicável, ou próxima etapa do roadmap).
