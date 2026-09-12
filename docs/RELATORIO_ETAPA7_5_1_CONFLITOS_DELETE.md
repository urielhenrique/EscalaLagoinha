# Relatório Etapa 7.5.1 — Conflitos e Exclusão

## 1. Objetivo

Corrigir os dois pontos pendentes identificados na Etapa 7.5:

1. Validação de conflito de horário durante UPDATE de eventos
2. Tratamento adequado no frontend quando uma ocorrência com Schedule não pode ser excluída

## 2. Problemas encontrados

### 2.1 Conflito de horário

O método `update()` do `EventsService` não verificava sobreposição de horário com outros eventos da mesma igreja. Dois eventos para a mesma igreja poderiam ter horários idênticos ou sobrepostos sem nenhum警告.

### 2.2 Exclusão com Schedule associado

Quando `DELETE /events/:id` falhava devido à constraint `Restrict` do Prisma (Schedule associado), o erro retornado era uma `PrismaClientKnownRequestError` com código `P2003`, sem mensagem amigável para o usuário.

## 3. Implementação da validação de conflito

### Método `assertNoTimeConflict`

Adicionado método privado `assertNoTimeConflict` em `EventsService`:

```typescript
private async assertNoTimeConflict(
  dataInicio: Date,
  dataFim: Date,
  churchId: string,
  excludeEventId?: string,
): Promise<void> {
  const where: Prisma.EventWhereInput = {
    churchId,
    dataInicio: { lt: dataFim },
    dataFim: { gt: dataInicio },
  };

  if (excludeEventId) {
    where.id = { not: excludeEventId };
  }

  const conflicts = await this.prisma.event.findMany({
    where,
    select: { id: true, nome: true, dataInicio: true, dataFim: true },
  });

  if (conflicts.length > 0) {
    throw new BadRequestException(
      `Conflito de horário com o evento "${conflicts[0].nome}" (...)`,
    );
  }
}
```

### Regra de sobreposição

Utilizada a condição matemática padrão para detecção de sobreposição de intervalos:

```
existingStart < newEnd AND existingEnd > newStart
```

Esta regra:
- **Detecta** sobreposição parcial (19:00–20:30 vs 20:00–21:00)
- **Detecta** evento dentro de outro (19:00–22:00 vs 20:00–21:00)
- **Detecta** mesmo horário (19:00–21:00 vs 19:00–21:00)
- **Não detecta** limites adjacentes (19:00–20:00 vs 20:00–21:00) — comportamento correto

### Integração no update

Chamada adicionada após `validateDateRange` e antes de `prisma.event.update`:

```typescript
await this.assertNoTimeConflict(dataInicio, dataFim, churchId, id);
```

O `id` do evento sendo editado é excluído da consulta de conflito, evitando falso positivo.

## 4. Regra de exclusão com Schedule

### Comportamento preservado

- `Schedule → Event` mantém relação `Restrict` no Prisma
- Excluir um Event com Schedules associados causa erro `P2003`
- Nenhum cascade automático foi adicionado

### Tratamento do erro

No `remove()`, captura de `PrismaClientKnownRequestError` com código `P2003`:

```typescript
try {
  return await this.prisma.event.delete({ where: { id }, select: eventSelect });
} catch (error) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  ) {
    throw new BadRequestException(
      "Não foi possível excluir esta ocorrência porque existem escalas vinculadas a ela.",
    );
  }
  throw error;
}
```

## 5. Alterações backend

### `backend/src/events/events.service.ts`

| Alteração | Descrição |
|-----------|-----------|
| Import `Prisma` | Adicionado `Prisma` ao import de `@prisma/client` |
| `assertNoTimeConflict()` | Novo método privado para verificar sobreposição |
| `update()` | Chamada `assertNoTimeConflict` antes do update |
| `remove()` | Try-catch com tratamento de P2003 |

### `backend/src/events/events.service.spec.ts`

| Alteração | Descrição |
|-----------|-----------|
| Import `Prisma` | Adicionado para `PrismaClientKnownRequestError` |
| Default mock `findMany` | `beforeEach` agora retorna `[]` por padrão |
| 12 testes de conflito | Cenários de sobreposição, self-exclusion, multi-tenancy |
| 1 teste de Schedule | Verifica mensagem amigável no erro P2003 |

## 6. Alterações frontend

### Nenhuma alteração de código necessária

O frontend já tratava erros via `getErrorMessage(error, fallback)`, que extrai `ApiError.message` > `Error.message` > fallback. Como o backend agora retorna mensagem amigável, o frontend a exibe automaticamente.

### `src/pages/EventsPage.test.tsx`

| Alteração | Descrição |
|-----------|-----------|
| 1 novo teste | Verifica mensagem específica de Schedule ("escalas vinculadas") |

## 7. Multi-tenancy

A consulta de conflito filtra obrigatoriamente por `churchId`:

```typescript
where: {
  churchId,
  dataInicio: { lt: dataFim },
  dataFim: { gt: dataInicio },
}
```

Eventos de outra igreja não são considerados na verificação de conflito.

## 8. Testes backend

### Total: 131 testes PASS (era 118, +13 novos)

| Novo teste | Descrição |
|------------|-----------|
| update sem conflito → sucesso | Happy path sem sobreposição |
| update com sobreposição parcial | 19:00–20:30 vs 20:00–21:00 → rejeitado |
| update com evento dentro de outro | 19:00–22:00 vs 20:00–21:00 → rejeitado |
| update com mesmo horário | 19:00–21:00 vs 19:00–21:00 → rejeitado |
| update do próprio evento | Não gera falso conflito |
| conflito entre mesmos church | Filtrado por churchId |
| evento de outra church | Não gera conflito |
| ocorrência recorrente sem conflito | Atualização aceita |
| ocorrência recorrente com conflito | Rejeitada |
| dados intactos após rejeição | `prisma.event.update` não chamado |
| recurrenceGroupId preservado | groupId mantido após update |
| recurrenceIndex preservado | index mantido após update |
| erro de Schedule associado | BadRequestException com mensagem amigável |

## 9. Testes frontend

### Total: 65 testes PASS (era 64, +1 novo)

| Novo teste | Descrição |
|------------|-----------|
| Mensagem específica de Schedule | "escalas vinculadas" exibida na UI |

## 10. Resultado dos testes

### Backend: 131/131 PASS

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
| **update — conflito de horário (Etapa 7.5.1)** | **12** |
| **remove — erro de Schedule (Etapa 7.5.1)** | **1** |

### Frontend: 65/65 PASS

| Suite | Testes |
|-------|--------|
| AuthInput | 3 |
| AuthContext | 5 |
| EventsPage — Recorrência | 17 |
| recurrence utility | 24 |
| EventsPage — Série de Eventos | 16 |

## 11. Build

- **Backend** (`npx nest build`): PASS
- **Frontend** (`npx vite build`): PASS

## 12. Lint

- **Backend TypeScript** (`npx tsc --noEmit`): PASS (0 erros)
- **Frontend TypeScript** (`npx tsc --noEmit`): PASS (0 erros)
- **Frontend ESLint** (`npx eslint`): PASS (0 erros nos arquivos modificados)

## 13. TypeScript

- Backend: PASS
- Frontend: PASS

## 14. Regressão

| Check | Resultado |
|-------|-----------|
| Backend testes | 131/131 PASS |
| Backend TypeScript | PASS |
| Backend build | PASS |
| Frontend testes | 65/65 PASS |
| Frontend TypeScript | PASS |
| Frontend ESLint | PASS |
| Frontend build | PASS |

## 15. Limitações

1. **Sem verificação no CREATE**: A validação de conflito foi adicionada apenas no UPDATE. O CREATE não verifica sobreposição (comportamento pré-existente, fora do escopo desta etapa).
2. **Sem conflito entre recorrências**: A verificação considera cada Event individualmente. Duas séries recorrentes que geram ocorrências sobrepostas não são detectadas como conflito entre séries.
3. **Mensagem de conflito**: Exibe apenas o primeiro evento conflitante encontrado. Se houver múltiplos conflitos, apenas um é reportado.
4. **Prisma Restrict irreversível**: O erro de Schedule associado continua irreversível. Não há opção de "mover" ou "excluir" schedules automaticamente.

## 16. Conclusão

A Etapa 7.5.1 foi concluída com sucesso. Os dois pontos pendentes foram resolvidos:

1. **Validação de conflito no UPDATE**: Implementada com regra padrão de sobreposição de intervalos, exclusão do próprio evento, e filtragem por churchId.
2. **Tratamento de erro de Schedule**: Prisma P2003 agora retorna `BadRequestException` com mensagem amigável. Frontend exibe automaticamente a mensagem do backend.

---

**NÃO implementado (conforme especificado):**
- edição em massa
- exclusão em massa
- alteração da regra de recorrência da série
- exceções avançadas de RRULE
- Google Calendar
- IA
- alteração de timezone
- alteração de schema/migration
- deploy
- commit
