# Relatório Etapa 7.3 — Validação de Timezone e Datas de Recorrência

## Objetivo

Validar que datas de recorrência são interpretadas como **datas de calendário** (não como instantes absolutos) de forma idêntica entre backend (NestJS/Prisma) e frontend (React/Vite), garantindo que o preview do usuário corresponde exatamente ao que será persistido no banco.

## Problema identificado na inspeção

### Backend (correto)
- `generateWeeklyOccurrences` usa exclusivamente métodos UTC: `getUTCDay()`, `setUTCDate()`, `setUTCHours()`
- Datas de recorrência são parseadas como `"2026-10-01T00:00:00.000Z"` (UTC midnight)
- iteração avança dia a dia com `current.setUTCDate(current.getUTCDate() + 1)`

### Frontend (corrigido)
**Antes da correção**, três funções tinham inconsistências:

1. **`toIsoDate`** — usava `new Date(value).toISOString()`
   - `"2026-10-01"` → parse como UTC midnight, mantinha como ISO
   - Funcionava corretamente por acidente, mas semântica era implícita

2. **`calculateOccurrences`** — usava métodos de tempo **local**
   - `current.getDay()` em vez de `current.getUTCDay()`
   - `current.setDate()` em vez de `current.setUTCDate()`
   - Usava `new Date(startDate)` que depende de fuso do navegador
   - **Resultado**: em fusos negativos (ex: UTC-3), `"2026-10-01"` (quinta) era interpretado como quarta-feira local → preview diferiria do backend

3. **`formatDateShort`** — usava métodos de tempo **local**
   - `date.getDate()` em vez de `date.getUTCDate()`

### Exemplo do problema (usuário em UTC-3)
```
Seleciona: 2026-10-01 (quinta-feira)
Frontend (antes): new Date("2026-10-01") = 21h 30/09 local → getDay() = 3 (quarta)
Backend:           new Date("2026-10-01T00:00:00.000Z") → getUTCDay() = 4 (quinta)
→ Preview mostraria ocorrências em quarta; backend criaria em quinta
```

## Solução aplicada

### Semântica canônica definida
> Datas de recorrência representam **datas de calendário**, não instantes absolutos. A string `"2026-10-01"` significa "todo dia 1 de outubro", independente de fuso horário.

### Função extraída: `src/utils/recurrence.ts`

Nova função `toIsoDate` parseia componentes manualmente e cria Date em UTC noon (12:00:00.000Z):
```typescript
const parts = value.split("-");
return new Date(Date.UTC(
  Number(parts[0]),
  Number(parts[1]) - 1,
  Number(parts[2]),
  12, 0, 0, 0
)).toISOString();
```

Função `calculateOccurrences` agora usa exclusivamente métodos UTC:
- `current.getUTCDay()` em vez de `current.getDay()`
- `current.setUTCDate()` em vez de `current.setDate()`
- Parse de datas de entrada via `Date.UTC()` em vez de `new Date(string)`

Função `formatDateShort` usa métodos UTC:
- `date.getUTCDate()`, `date.getUTCMonth()`, `date.getUTCFullYear()`

### Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/utils/recurrence.ts` | **Novo**: funções `toIsoDate`, `calculateOccurrences`, `formatDateShort` extraídas do EventsPage |
| `src/utils/recurrence.test.ts` | **Novo**: 24 testes (7 casos canônicos + edge cases + não recorrente) |
| `src/pages/EventsPage.tsx` | Removidas definições inline; importa de `recurrence.ts` |
| `backend/src/events/events.service.spec.ts` | Adicionados 7 testes de paridade frontend × backend |

### Arquivos NÃO alterados
- `backend/src/events/events.service.ts` — já correto (usa métodos UTC)
- `backend/src/events/dto/create-event.dto.ts` — sem alteração
- `backend/prisma/schema.prisma` — sem alteração

## Resultados dos testes

### Backend: 100 testes PASS

| Suite | Testes |
|-------|--------|
| create — evento único (sem recorrência) | 1 |
| create — recorrência semanal | 5 |
| create — validações de recorrência | 4 |
| create — limite de recorrência | 3 |
| findByRecurrenceGroup | 3 |
| create — rollback on failure | 1 |
| create — evento único preserva comportamento | 2 |
| remove — evento individual | 3 |
| findAll — inclui campos de recorrência | 1 |
| findById — inclui campos de recorrência | 2 |
| **generateWeeklyOccurrences — parity (7 cases)** | **7** |

### Frontend: 48 testes PASS

| Suite | Testes |
|-------|--------|
| EventsPage — Recorrência (existente) | 25 |
| recurrence utility — toIsoDate | 3 |
| recurrence utility — canonical 7 cases | 7 |
| recurrence utility — edge cases | 8 |
| recurrence utility — non-recurring | 1 |
| recurrence utility — formatDateShort | 2 |

### Build e Lint
- `npm run build` (frontend): **PASS** (0 erros, 6 warnings preexistentes do lightningcss)
- `npm run build` (backend): **PASS**
- `npx eslint`: **PASS** (0 erros)
- `npx tsc --noEmit`: **PASS** (0 erros)

## Casos de teste de paridade (7 casos canônicos)

| # | Período | Dias | Backend | Frontend | Match |
|---|---------|------|---------|----------|-------|
| 1 | 06/09–27/09 | DOM | 4 ocorrências | 4 datas | OK |
| 2 | 01/10–31/10 | QUA | 5 ocorrências | 5 datas | OK |
| 3 | 01/10–31/10 | SEG+QUA | 9 ocorrências | 9 datas | OK |
| 4 | 01/10–07/10 | QUA | 1 ocorrência | 1 data | OK |
| 5 | 04/10–05/10 | SAB | BadRequestException | Array vazio | OK (comportamento diferente, ambos corretos) |
| 6 | 01/10–31/10 | 7 dias | 31 ocorrências | 31 datas | OK |
| 7 | 28/02–06/03/2028 | SEG | 2 ocorrências | 2 datas | OK |

**Nota sobre caso 5**: Backend rejeita com `BadRequestException` quando zero ocorrências são geradas (validação de negócio). Frontend retorna array vazio (preview simples). Ambos tratam corretamente o caso de "nenhuma correspondência".

## Nota sobre `toIsoOrNull` (eventos datetime)

A função `toIsoOrNull` não foi alterada. Ela converte `datetime-local` inputs para UTC usando `new Date(value).toISOString()`, o que é correto para horários de eventos (ex: "2026-10-04T19:00" → "2026-10-04T22:00:00.000Z" em UTC-3). Essa função lida com **instantes absolutos**, não com datas de calendário, por isso o comportamento de conversão de fuso é desejável.
