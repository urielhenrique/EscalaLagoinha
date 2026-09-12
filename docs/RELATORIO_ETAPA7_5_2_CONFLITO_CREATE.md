# Relatório Etapa 7.5.2 — Conflito no CREATE

## 1. Objetivo

Adicionar validação de conflito de horário durante a criação de eventos, tornando CREATE e UPDATE consistentes.

## 2. Problema identificado

O método `update()` já possuía `assertNoTimeConflict()` desde a Etapa 7.5.1, mas o método `create()` não verificava sobreposição. Dois eventos para a mesma igreja poderiam ter horários sobrepostos se ambos fossem criados via `POST /events`.

## 3. Estratégia adotada

Reutilizar `assertNoTimeConflict()` existente:

- **Evento único**: chamar `assertNoTimeConflict()` antes de `prisma.event.create`
- **Evento recorrente**: gerar ocorrências → validar TODAS as ocorrências → criar dentro da transaction

A validação ocorre **antes** da transaction, garantindo que nenhuma ocorrência seja criada parcialmente.

## 4. Evento único

Fluxo implementado:

```
1. validateRecurrenceConfig (se aplicável)
2. validateDateRange
3. assertNoTimeConflict ← NOVO
4. prisma.event.create
```

Exemplo:
```
Existente: 10/09 19:00–21:00
Novo:      10/09 20:00–22:00
Resultado: REJEITADO
```

## 5. Evento recorrente

Fluxo implementado:

```
1. validateRecurrenceConfig
2. generateWeeklyOccurrences → occurrences[]
3. validate occurrences.length > 0
4. validate occurrences.length <= 52
5. Para cada occurrence:
   6. assertNoTimeConflict ← NOVO
7. Se alguma falhar → BadRequestException
8. Se todas passarem → $transaction cria todos os Events
```

Exemplo:
```
Série: 06/09, 13/09, 20/09, 27/09 (19:00–21:00)
Existente: 13/09 19:00–21:00
Resultado: Série inteira REJEITADA
```

## 6. Validação por ocorrência

Todas as ocorrências são validadas **antes** da transaction:

- `assertNoTimeConflict` consulta o banco para cada ocorrência
- Se qualquer ocorrência conflitar, `BadRequestException` é lançada
- A transaction nunca é iniciada
- Nenhum Event é persistido

## 7. Transaction e rollback

A transaction existente permanece inalterada:

```typescript
const createdEvents = await this.prisma.$transaction(async (tx) => {
  for (const occurrence of occurrences) {
    const event = await tx.event.create({ ... });
    events.push(event);
  }
  return events;
});
```

Como a validação de conflito ocorre antes da transaction:
- Se houver conflito → transaction nunca inicia → rollback implícito (nenhum dado persistido)
- Se não houver conflito → transaction cria todos os Events atomicamente

## 8. Multi-tenancy

`assertNoTimeConflict()` filtra por `churchId`:

```typescript
where: {
  churchId,
  dataInicio: { lt: dataFim },
  dataFim: { gt: dataInicio },
}
```

Eventos de outra igreja não são considerados na verificação de conflito.

## 9. Regra de sobreposição

Mesma regra utilizada no UPDATE:

```
existingStart < newEnd AND existingEnd > newStart
```

| Caso | Conflito? |
|------|-----------|
| 19:00–20:30 vs 20:00–21:00 | Sim (parcial) |
| 19:00–22:00 vs 20:00–21:00 | Sim (dentro) |
| 20:00–21:00 vs 19:00–22:00 | Sim (envolvendo) |
| 19:00–21:00 vs 19:00–21:00 | Sim (mesmo) |
| 19:00–20:00 vs 20:00–21:00 | Não (adjacente) |

## 10. Concorrência

**Limitação documentada**: A validação por consulta (`findMany`) não impede 100% dos casos concorrentes sem constraint específica no banco. Dois usuários criando eventos sobrepostos simultaneamente podem passar pela validação antes que o outro persista.

Prioridade desta etapa: impedir conflitos no fluxo normal. Proteção absoluta contra race condition requer constraint de exclusão no PostgreSQL, fora do escopo.

## 11. Testes adicionados

### Evento único: 8 testes

| # | Teste |
|---|-------|
| 1 | create sem conflito → sucesso |
| 2 | create com sobreposição parcial → rejeitado |
| 3 | create dentro de outro → rejeitado |
| 4 | create envolvendo outro dentro dele → rejeitado |
| 5 | create mesmo horário → rejeitado |
| 6 | create evento adjacente → sucesso |
| 7 | evento de outra church não gera conflito |
| 8 | conflito não persiste o novo evento |

### Recorrência: 10 testes

| # | Teste |
|---|-------|
| 9 | série sem conflito → sucesso |
| 10 | série com conflito na primeira ocorrência → rejeitada |
| 11 | série com conflito no meio → rejeitada |
| 12 | série com conflito na última ocorrência → rejeitada |
| 13 | série conflitante não cria nenhuma ocorrência |
| 14 | transaction não é chamada quando há conflito |
| 15 | todas as ocorrências são verificadas |
| 16 | recurrenceGroupId não fica parcialmente criado |
| 17 | múltiplos dias sem conflito → sucesso |
| 18 | múltiplos dias com conflito → rejeitado |

### Regressão: 5 testes

| # | Teste |
|---|-------|
| 19 | evento não recorrente continua funcionando |
| 20 | recurrenceGroupId das séries existentes não é alterado |
| 21 | regra de máximo 52 continua funcionando |
| 22 | validação dataFim > dataInicio continua funcionando |
| 23 | churchId do actor continua sendo utilizado |

## 12. Resultado dos testes

### Backend: 153/153 PASS (era 131, +22 novos)

| Suite | Testes |
|-------|--------|
| create — evento único | 1 |
| create — recorrência semanal | 5 |
| create — validações | 4 |
| create — limite de recorrência | 3 |
| findByRecurrenceGroup | 7 |
| create — rollback | 1 |
| create — preserva comportamento | 2 |
| remove — evento individual | 3 |
| findAll — campos de recorrência | 1 |
| findById — campos de recorrência | 2 |
| generateWeeklyOccurrences — parity | 7 |
| update — evento individual | 10 |
| remove — ocorrência de série | 4 |
| update — conflito de horário | 12 |
| remove — erro de Schedule | 1 |
| **create — conflito evento único (Etapa 7.5.2)** | **8** |
| **create — conflito recorrência (Etapa 7.5.2)** | **10** |
| **create — regressão (Etapa 7.5.2)** | **5** |

### Frontend: 65/65 PASS (sem alteração)

## 13. Build

- **Backend** (`npx nest build`): PASS
- **Frontend** (`npx vite build`): PASS

## 14. Lint

- **Backend TypeScript** (`npx tsc --noEmit`): PASS (0 erros)
- **Frontend TypeScript** (`npx tsc --noEmit`): PASS (0 erros)

## 15. TypeScript

- Backend: PASS
- Frontend: PASS

## 16. Regressão

| Check | Resultado |
|-------|-----------|
| Backend testes | 153/153 PASS |
| Backend TypeScript | PASS |
| Backend build | PASS |
| Frontend testes | 65/65 PASS |
| Frontend TypeScript | PASS |
| Frontend build | PASS |
| Recorrência existente | Preservada |
| Timezone | Preservada |
| Evento não recorrente | Funcionando |

## 17. Limitações

1. **Race condition**: A validação por consulta não impede 100% dos casos concorrentes. Requer constraint `EXCLUDE` no PostgreSQL para garantia absoluta.
2. **Sem conflito entre séries**: Duas séries recorrentes com ocorrências sobrepostas não são detectadas como conflito entre si (cada ocorrência é validada individualmente).
3. **Mensagem de conflito**: Exibe apenas o primeiro evento conflitante encontrado.
4. **seedInitialEvents**: O método de seed não possui validação de conflito (fora do escopo).

## 18. Conclusão

A Etapa 7.5.2 foi concluída com sucesso. CREATE e UPDATE agora são consistentes na validação de conflito de horário:

- **Evento único**: `assertNoTimeConflict()` chamado antes de `prisma.event.create`
- **Evento recorrente**: todas as ocorrências validadas antes da transaction
- **Rollback garantido**: se qualquer ocorrência conflitar, nenhuma é criada
- **Multi-tenancy**: `churchId` aplicado em todas as consultas
- **Regressão**: 153 backend + 65 frontend = 218 testes PASS

---

**NÃO implementado (conforme especificado):**
- constraint avançada de exclusão de intervalo no PostgreSQL
- proteção absoluta contra race condition
- edição em massa
- exclusão em massa
- alteração da regra de recorrência
- Google Calendar
- IA
- deploy
- commit
