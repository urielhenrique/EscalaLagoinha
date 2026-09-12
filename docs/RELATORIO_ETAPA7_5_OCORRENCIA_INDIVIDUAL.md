# Relatório Etapa 7.5 — Edição e Exclusão Individual de Ocorrência

## 1. Objetivo

Implementar e validar o comportamento de edição e exclusão **individual** de uma ocorrência pertencente a uma série recorrente, garantindo que:

- Cada ocorrência é um `Event` independente no banco
- Editar uma ocorrência não afeta as demais
- Excluir uma ocorrência não exclui as demais
- `recurrenceGroupId` e `recurrenceIndex` são preservados após edição
- Multi-tenancy e permissões existentes são mantidos

## 2. Estado Inicial (antes da Etapa 7.5)

### Backend
- `PATCH /events/:id` — edita qualquer Event individualmente (nome, descricao, dataInicio, dataFim, recorrencia)
- `DELETE /events/:id` — exclui qualquer Event individualmente
- `UpdateEventDto` **não inclui** `recurrenceGroupId`, `recurrenceType`, `recurrenceIndex`, `recurrenceDays`, `recurrenceStart`, `recurrenceEnd` — esses campos não podem ser manipulados via payload
- `remove()` já verifica `churchId` antes de excluir (multi-tenancy)
- `update()` já verifica `churchId` antes de atualizar (multi-tenancy)
- Regra de cascade: Prisma `Restrict` impede exclusão de Event com Schedules associados

### Frontend
- Botão de editar no card do evento → abre modal de edição → `updateEvent(id, payload)`
- Botão de excluir no card do evento → `window.confirm` → `deleteEvent(id)`
- `SeriesDetailModal` mostra lista de ocorrências e permite clicar para editar
- **Não existia**: botão de excluir dentro da série
- **Não existia**: mensagem de "somente esta ocorrência" para ações em série
- **Não existia**: refresh da série após edição/exclusão

## 3. Inspeção Backend

### Update (`PATCH /:id`)
- Valida `churchId` via `findFirst({ where: { id, churchId } })`
- Valida intervalo de datas: `dataFim > dataInicio`
- `UpdateEventDto` contém apenas: `nome`, `descricao`, `dataInicio`, `dataFim`, `recorrencia`
- Campos protegidos (não no DTO): `churchId`, `recurrenceGroupId`, `recurrenceType`, `recurrenceIndex`, `recurrenceDays`, `recurrenceStart`, `recurrenceEnd`
- **Conclusão**: Backend já correto. Nenhuma alteração necessária.

### Remove (`DELETE /:id`)
- Valida `churchId` via `findFirst({ where: { id, churchId } })`
- Exclui apenas o Event individual
- Se o Event possui Schedules associados, Prisma `Restrict` impede a exclusão (erro de integridade)
- **Conclusão**: Backend já correto. Nenhuma alteração necessária.

### Schema (Prisma)
```prisma
model Event {
  ...
  schedules        Schedule[]
  ...
}

model Schedule {
  event     Event    @relation(fields: [eventId], references: [id])
  ...
}
```
- Relação `Schedule → Event` não tem `onDelete` explícito → default `Restrict`
- Excluir um Event com schedules causa erro de constraint → comportamento desejável

## 4. Inspeção Frontend

### Fluxo existente de edição
1. Usuário clica no botão de editar (card ou dentro da série)
2. `openEditModal(event)` preenche o formulário com dados do evento
3. `handleSave()` chama `updateEvent(id, payload)` → recarrega lista

### Fluxo existente de exclusão
1. Usuário clica no botão de excluir (apenas no card principal)
2. `window.confirm()` pergunta confirmação
3. `handleDelete(event)` chama `deleteEvent(id)` → recarrega lista

### Gaps identificados
1. **Sem botão de excluir na série** — SeriesDetailModal não tinha opção de exclusão
2. **Sem refresh da série** — após editar uma ocorrência, o modal não atualizava os dados
3. **Mensagem genérica** — confirmação de exclusão não diferenciava evento normal de recorrente
4. **Mensagem de edição** — não informava que a alteração era apenas para aquela ocorrência

## 5. Comportamento Definido

### Edição Individual
- O usuário seleciona uma ocorrência na série → abre modal de edição
- Ao salvar, **somente aquela ocorrência** é alterada
- Mensagem de sucesso: "Esta alteração foi aplicada somente a esta ocorrência."
- A série é atualizada (refresh automático ao reabrir o modal)

### Exclusão Individual
- Cada ocorrência na série possui um botão de exclusão (ícone Trash2)
- Confirmação: "Deseja excluir esta ocorrência? Esta ação excluirá somente esta ocorrência da série. Esta ação não pode ser desfeita."
- Após confirmar, a ocorrência é removida e a série é atualizada

### Preservação de dados
- `recurrenceGroupId` → preservado (não editável via DTO)
- `recurrenceIndex` → preservado (não editável via DTO)
- Demais ocorrências → intactas
- Série → continua íntegra

## 6. Alterações Backend

**NENHUMA alteração.**

O backend já implementa:
- Update individual com validação de `churchId`
- Delete individual com validação de `churchId`
- DTO que protege campos de recorrência
- Cascade `Restrict` via Prisma (impede exclusão com schedules)

## 7. Alterações Frontend

### `src/components/ui/SeriesDetailModal.tsx`
- Adicionado prop `refreshKey?: number` — incrementar para forçar reload
- Adicionado prop `onDeleteOccurrence: (event: EventItem) => void` — handler de exclusão
- Adicionado botão de exclusão (Trash2) em cada ocorrência da lista
- Adicionado `useEffect` que recarrega ocorrências quando `refreshKey` muda
- Layout ajustado: cada ocorrência agora é um `div` container com `button.flex-1` clicável (para edição) e `button` Trash2 (para exclusão)

### `src/pages/EventsPage.tsx`
- Novo state: `seriesRefreshKey` (number) — controla refresh da série
- Novo handler: `handleDeleteOccurrence` — delega para `handleDelete`
- `handleSave()`: incrementa `seriesRefreshKey` ao editar ocorrência recorrente
- `handleDelete()`: mensagem diferenciada para evento recorrente vs normal; incrementa `seriesRefreshKey` ao excluir
- Mensagem de sucesso para edição recorrente: "Esta alteração foi aplicada somente a esta ocorrência."
- Mensagem de sucesso para exclusão recorrente: "Ocorrência removida com sucesso."
- `SeriesDetailModal` recebe `refreshKey` e `onDeleteOccurrence`

## 8. Regras de Edição Individual

1. Editar uma ocorrência altera **apenas aquela ocorrência**
2. `recurrenceGroupId` permanece igual
3. `recurrenceIndex` permanece igual
4. `churchId` permanece igual
5. Não é possível alterar `recurrenceGroupId`, `recurrenceIndex`, `churchId` via DTO
6. Validação de `dataFim > dataInicio` continua ativa
7. A série é recarregada automaticamente após edição

## 9. Regras de Exclusão Individual

1. Excluir uma ocorrência remove **apenas aquela ocorrência**
2. As demais ocorrências permanecem intactas
3. `recurrenceGroupId` das demais não é alterado
4. `recurrenceIndex` das demais não é renumerado
5. Se a série tem apenas uma ocorrência, a exclusão funciona normalmente
6. Se a ocorrência possui schedules associados, a exclusão é bloqueada pelo Prisma `Restrict`

## 10. Multi-tenancy

- **UPDATE**: `findFirst({ where: { id, churchId } })` — só encontra evento da mesma igreja
- **DELETE**: `findFirst({ where: { id, churchId } })` — só encontra evento da mesma igreja
- Cross-tenant UPDATE retorna `NotFoundException`
- Cross-tenant DELETE retorna `NotFoundException`

## 11. Permissões

- `@Roles(Perfil.ADMIN)` no `PATCH /:id` e `DELETE /:id`
- MASTER_ADMIN, ADMIN e MASTER_PLATFORM_ADMIN podem editar/excluir
- VOLUNTARIO não pode editar/excluir (preservado)
- Nenhuma alteração na hierarquia de permissões

## 12. Conflito de Horário

- `update()` valida `dataFim > dataInicio` — retorna `BadRequestException` se violado
- Não há verificação de conflito com outros eventos no update (comportamento existente)
- Alterar data de uma ocorrência não verifica conflito com outras ocorrências da mesma série

## 13. Testes Adicionados

### Backend: 14 novos testes (118 total)

| # | Teste | Descrição |
|---|-------|-----------|
| 1 | update — evento único | Atualiza nome de evento individual |
| 2 | update — somente uma ocorrência | Edita apenas uma ocorrência, não a série inteira |
| 3 | update — preserva recurrenceGroupId | groupId permanece após edição |
| 4 | update — preserva recurrenceIndex | index permanece após edição |
| 5 | update — alterar data | Move ocorrência para nova data |
| 6 | update — NotFoundException | Evento inexistente retorna 404 |
| 7 | update — ForbiddenException | Usuário sem igreja retorna 403 |
| 8 | update — cross-tenant | Igreja B não edita evento da igreja A |
| 9 | update — recusa recurrenceGroupId | DTO não aceita recurrenceGroupId |
| 10 | update — dataFim <= dataInicio | Rejeita intervalo inválido |
| 11 | remove — exclusão individual | Exclui apenas uma ocorrência |
| 12 | remove — cross-tenant | Igreja B não exclui evento da igreja A |
| 13 | remove — série de uma ocorrência | Exclui sem erro |
| 14 | remove — preserva outras ocorrências | Após exclusão, demais permanecem |

### Frontend: 7 novos testes (64 total)

| # | Teste | Descrição |
|---|-------|-----------|
| 1 | Botão de exclusão na série | Cada ocorrência tem botão "Excluir esta ocorrência" |
| 2 | Confirmar e excluir | Confirmação → delete → mensagem de sucesso |
| 3 | Cancelar exclusão | Rejeitar confirmação → não exclui |
| 4 | Mensagem de exclusão recorrente | Confirmação contém "somente esta ocorrência" |
| 5 | Mensagem de edição recorrente | Sucesso contém "aplicada somente a esta ocorrência" |
| 6 | Confirmação para evento normal | Usa mensagem padrão sem "série" |
| 7 | Erro de exclusão | Mensagem de erro exibida quando exclusão falha |

## 14. Resultado dos Testes

### Backend: 118 testes PASS

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
| **update — evento individual (Etapa 7.5)** | **10** |
| **remove — ocorrência de série (Etapa 7.5)** | **4** |

### Frontend: 64 testes PASS

| Suite | Testes |
|-------|--------|
| EventsPage — Recorrência | 17 |
| recurrence utility | 24 |
| AuthInput | 3 |
| AuthContext | 5 |
| EventsPage — Série de Eventos | 9 |
| **EventsPage — Ocorrência Individual (Etapa 7.5)** | **7** (actually included in series) |

**Total**: 64 frontend + 118 backend = **182 testes PASS**

## 15. Build

- `npx vite build` (frontend): **PASS**
- `npx jest --coverage` (backend): **PASS**

## 16. Lint

- `npx eslint src/pages/EventsPage.tsx`: **PASS** (0 erros)
- `npx eslint src/components/ui/SeriesDetailModal.tsx`: **PASS** (0 erros)
- `npx eslint src/pages/EventsPage.test.tsx`: **PASS** (0 erros)
- `npx tsc --noEmit` (frontend): **PASS**
- `npx tsc --noEmit` (backend): **PASS**

## 17. TypeScript

- Frontend: **PASS** (0 erros)
- Backend: **PASS** (0 erros)

## 18. Compatibilidade com Séries Existentes

- Séries existentes no banco continuam funcionando normalmente
- `recurrenceGroupId` existente é preservado em todas as operações
- `recurrenceIndex` existente é preservado (não renumerado)
- Exclusão de uma ocorrência não afeta as demais
- Edição de uma ocorrência não afeta as demais
- Frontend carrega e exibe séries existentes corretamente

## 19. Limitações

1. **Sem conflito de horário no update**: O backend não verifica se uma ocorrência editada conflita com outro evento. Esta é uma limitação pré-existente.
2. **Sem renumeramento automático**: Ao excluir uma ocorrência, `recurrenceIndex` não é renumerado. A lacuna permanece (comportamento intencional).
3. **Prisma Restrict**: Exclusão de ocorrência com schedules associados é bloqueada pelo banco. Não há tratamento específico de UI para esta mensagem de erro.
4. **window.confirm**: Usa o diálogo nativo do navegador. Não há componente customizado de confirmação.

## 20. Conclusão

A Etapa 7.5 foi concluída com sucesso. O backend já implementava corretamente edição e exclusão individual de eventos, incluindo proteção multi-tenancy e preservação de campos de recorrência. As alterações foram concentradas no frontend, adicionando:

- Botão de exclusão em cada ocorrência da série
- Mensagens de UX diferenciadas para ações em séries recorrentes
- Refresh automático da série após edição ou exclusão
- 14 testes backend + 7 testes frontend cobrindo todos os cenários

---

**NÃO implementado (conforme especificado):**
- edição em massa
- exclusão em massa
- alteração da regra de recorrência da série
- exceções avançadas de RRULE
- Google Calendar
- IA
- alteração de timezone (estabilizada na Etapa 7.3)
- alteração da estrutura do banco
- deploy
- commit
