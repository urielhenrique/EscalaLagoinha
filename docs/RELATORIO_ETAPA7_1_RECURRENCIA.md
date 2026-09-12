# Relatório Etapa 7.1 — Recorrência de Eventos

## Objetivo

Implementar a primeira versão funcional de recorrência semanal de eventos no backend.

## Estado anterior

- Event model possuía campo `recorrencia` (String?) apenas como placeholder sem lógica implementada
- Eventos eram criados individualmente via `POST /events`
- Não existia geração automática de ocorrências recorrentes
- Backend: 68/68 testes passando

## Modelagem adotada

Campos adicionados diretamente ao model `Event` (sem novas tabelas):

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `recurrenceGroupId` | `String?` | UUID para agrupar ocorrências da mesma série |
| `recurrenceType` | `RecurrenceType` (enum: NONE, WEEKLY) | Tipo de recorrência |
| `recurrenceDays` | `String[]` | Dias da semana (ex: ["DOMINGO"]) |
| `recurrenceStart` | `DateTime?` | Data início da série |
| `recurrenceEnd` | `DateTime?` | Data fim da série |
| `recurrenceIndex` | `Int?` | Índice da ocorrência na série |

**Motivo**: Simplicidade. Cada ocorrência é um Event independente no banco, com sua própria identidade. O `recurrenceGroupId` permite agrupar visualmente, mas não cria dependência entre as ocorrências.

## Regras implementadas

1. Evento sem recorrência continua funcionando exatamente igual (compatibilidade total)
2. Evento recorrente exige:
   - data inicial válida
   - data final válida
   - data final >= data inicial
   - frequência WEEKLY
   - pelo menos um dia da semana válido
3. Limite de 52 ocorrências por série (documentado no código)
4. Ocorrências geradas somente dentro do intervalo informado
5. Todas as ocorrências pertencem ao mesmo `churchId` do evento de origem
6. Cada ocorrência possui `id` (UUID) independente
7. Cancelamento/remoção de uma ocorrência afeta apenas aquela ocorrência
8. Alteração de uma ocorrência não altera automaticamente as demais
9. Geração dentro de transação Prisma (rollback completo se qualquer ocorrência falhar)

## API

### POST /events (estendido)

Evento único — comportamento inalterado:
```json
{
  "nome": "Conferência Especial",
  "descricao": "...",
  "dataInicio": "2026-10-04T19:00:00.000Z",
  "dataFim": "2026-10-04T21:00:00.000Z"
}
```

Evento recorrente — novo campo `recurrence`:
```json
{
  "nome": "Culto Domingo",
  "descricao": "...",
  "dataInicio": "2026-10-04T19:00:00.000Z",
  "dataFim": "2026-10-04T21:00:00.000Z",
  "recurrence": {
    "type": "WEEKLY",
    "startDate": "2026-10-04T00:00:00.000Z",
    "endDate": "2026-12-27T00:00:00.000Z",
    "daysOfWeek": ["DOMINGO"]
  }
}
```

**Resposta para evento recorrente:**
```json
{
  "recurrenceGroupId": "uuid-da-serie",
  "totalEvents": 12,
  "events": [
    { "id": "...", "recurrenceIndex": 0, "dataInicio": "...", ... },
    { "id": "...", "recurrenceIndex": 1, "dataInicio": "...", ... }
  ]
}
```

### GET /events/recurrence-group/:groupId (novo)

Retorna todas as ocorrências de uma série, filtradas por `churchId`.

### GET /events/:id (estendido)

Agora retorna todos os campos de recorrência no response.

### GET /events (estendido)

Agora retorna todos os campos de recorrência no response.

### PATCH /events/:id e DELETE /events/:id

Comportamento inalterado — afetam apenas a ocorrência individual.

## Multi-tenancy

- `create`: `churchId` obtido do JWT, aplicado a todas as ocorrências geradas
- `findByRecurrenceGroup`: filtra por `churchId`
- `findAll` / `findById`: filtrados por `churchId` (já existente)
- `update` / `remove`: validação de `churchId` (já existente)
- Cross-tenant: impossível — `churchId` nunca é recebido do body, sempre do JWT

## Testes

| # | Teste | Status |
|---|-------|--------|
| 1 | Criar evento único (sem recorrência) | PASS |
| 2 | Criar evento semanal (4 domingos) | PASS |
| 3 | Gerar datas corretas para domingos de outubro | PASS |
| 4 | Respeitar churchId em todas as ocorrências | PASS |
| 5 | Rejeitar data final anterior à inicial | PASS |
| 6 | Rejeitar recorrência sem dia da semana | PASS |
| 7 | Rejeitar dia da semana inválido | PASS |
| 8 | Rejeitar recorrência sem igreja vinculada | PASS |
| 9 | 52 ocorrências permitidas | PASS |
| 10 | 53 ocorrências rejeitadas (BadRequestException) | PASS |
| 11 | Nenhuma criação parcial acima do limite | PASS |
| 12 | Consultar por recurrenceGroupId | PASS |
| 13 | Rollback completo em caso de erro | PASS |
| 14 | Evento único continua funcionando | PASS |
| 15 | Rejeitar dataFim <= dataInicio (evento único) | PASS |
| 16 | Criar evento único com churchId | PASS |
| 17 | Deletar apenas uma ocorrência | PASS |
| 18 | NotFoundException ao buscar evento inexistente | PASS |
| 19 | ForbiddenException ao deletar sem igreja | PASS |
| 20 | findAll retorna campos de recorrência | PASS |
| 21 | findById retorna campos de recorrência | PASS |
| 22 | ForbiddenException ao buscar por grupo sem igreja | PASS |
| 23 | Cross-tenant: usuário de outra igreja não vê séries alheias | PASS |
| 24 | Múltiplos dias da semana (DOMINGO + QUARTA) | PASS |
| 25 | Horário preservado em todas as ocorrências | PASS |
| 26 | Todos os testes existentes preservados | PASS |

**Resultado: 93/93 testes passando (25 novos + 68 existentes)**

## Limite de geração

- Máximo: **52 ocorrências** por série (constante `MAX_RECURRENCE_EVENTS`)
- Motivo: prevenir criação acidental de milhares de eventos
- Comportamento: se o intervalo + frequência resultar em mais de 52, a operação é **rejeitada** com `BadRequestException` antes da criação de qualquer evento
- Nenhuma ocorrência é criada quando o limite é excedido

## Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `prisma/schema.prisma` | Adicionados campos de recorrência ao model Event |
| `prisma/migrations/20260910150000_add_event_recurrence/migration.sql` | Migration criada |
| `src/events/dto/create-event.dto.ts` | Adicionado `RecurrenceConfigDto` e campo `recurrence` |
| `src/events/events.service.ts` | Lógica de geração de recorrência, validação, transaction |
| `src/events/events.controller.ts` | Endpoint `GET /events/recurrence-group/:groupId` |
| `src/events/events.service.spec.ts` | 25 novos testes para recorrência |

## Limitações atuais

- Somente recorrência semanal (WEEKLY)
- Sem RRULE completo (RFC 5545)
- Sem edição em série ("editar todas as ocorrências")
- Sem recorrência mensal
- Sem recorrência anual
- Sem sincronização Google Calendar
- Sem IA
- Duplicação de séries idênticas não possui proteção específica nesta versão

## Resultado final

- **Backend**: 93/93 testes passando (era 68)
- **Build**: PASS
- **Lint**: 0 erros
- **Migration**: criada (prisma migrate deploy necessário em produção)
- **Frontend**: não alterado nesta etapa

---

## Validação 7.1.1

### Diferença na contagem de testes

A Etapa 7.1 informou "88 testes (21 novos + 67 existentes)". Investigação revelou:

- **Testes existentes**: 68 (inalterados)
- **Testes novos**: 25 (relatório da Etapa 7.1 estava incorreto: informou 21)
- **Total real**: 93 (era 88 porque a Etapa 7.1 esqueceu de contar 4 testes que já existiam)

Nenhum teste foi removido ou consolidado. A diferença é exclusivamente de contagem no relatório.

### Comportamento do limite de 52

**Antes (Etapa 7.1)**: truncava silenciosamente a série em 52 ocorrências.
**Após (7.1.1)**: rejeita a operação com `BadRequestException` antes de criar qualquer evento.

Mensagem: "Período de recorrência excede o limite máximo de 52 ocorrências."

### Validação de timezone/data/hora

- Iteração utiliza `setUTCDate` / `getUTCDay` (consistente UTC)
- Horário do evento preservado via `setUTCHours` com valores originais
- Duração calculada por diferença de timestamps (inválida por timezone)
- Teste "should preserve event time across all occurrences" verifica que 19:30→21:30 é preservado

### Deduplicação

Duplicação de séries idênticas não possui proteção específica nesta versão. Dois POST idênticos criarão duas séries independentes com `recurrenceGroupId` diferente. Não é tratado como vulnerabilidade — é uma limitação documentada.

### recurrenceGroupId

- Todas as ocorrências de uma série possuem o mesmo `recurrenceGroupId`
- Cada ocorrência possui `id` (UUID) próprio
- `recurrenceIndex` é único dentro da série (começa em 0)
- `GET /events/recurrence-group/:groupId` filtra por `churchId`

### Multi-tenancy

- `churchId` sempre obtido do JWT, nunca do body
- `findByRecurrenceGroup` filtra por `churchId` do usuário
- Teste cross-tenant verifica que usuário da Igreja B não vê séries da Igreja A

### Transaction/rollback

- Todas as ocorrências criadas dentro de `prisma.$transaction`
- Qualquer erro provoca rollback completo
- Teste "should rollback all events if one creation fails" verifica comportamento

### Schema/Migration

- `RecurrenceType` enum: NONE, WEEKLY
- Todos os campos novos são nullable ou possuem default seguro
- Eventos existentes continuam válidos (recurrenceType = NONE por default)
- Migration não destrutiva (apenas ADD COLUMN com defaults)

### Compatibilidade

- `seed.ts` não referencia novos campos (continua funcionando)
- Schedules existentes não são afetados
- Smart Scheduler não é afetado
- Todos os 68 testes existentes continuam passando
