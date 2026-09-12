# Relatório Etapa 7.4 — Visualização e Identificação de Séries de Eventos

## Objetivo

Permitir que o usuário visualize ocorrências futuras e passadas de um evento recorrente (série), identificando a ocorrência atual dentro do grupo, navegando entre ocorrências e acessando o formulário de edição de qualquer ocorrência individual.

## Inspetção (ETAPA 1)

### Backend
- Endpoint `GET /events/recurrence-group/:groupId` já existia com filtro `churchId` (multi-tenancy) e ordenação `recurrenceIndex: "asc"`
- Service `findByRecurrenceGroup` já retornava eventos com todos os campos de recorrência
- **Nenhuma alteração necessária no backend**

### Frontend
- Função `listRecurrenceGroup` já existia em `eventsApi.ts`
- Badge "Recorrente" já existia nos cards de eventos recorrentes
- **Faltava**: componente de detalhe da série (modal com lista de ocorrências)

## Solução aplicada

### Componente: `src/components/ui/SeriesDetailModal.tsx`

Modal que exibe detalhes de uma série recorrente:

- **Informações da série**: frequência (semanal), dias da semana, horário, período
- **Lista de ocorrências**: todas as ocorrências da série ordenadas por `recurrenceIndex`
- **Destaque da ocorrência atual**: ocorrência com `id` igual ao evento clicado recebe destaque visual (borda + badge "● Ocorrência atual")
- **Navegação**: clicar em qualquer ocorrência fecha o modal de série e abre o modal de edição do evento
- **Estado de carregamento**: skeleton durante busca de ocorrências
- **Tratamento de erro**: mensagem de erro com fallback
- **Segurança**: verificação de `recurrenceGroupId` antes de renderizar

### Alterações no `EventsPage.tsx`

- Import do `SeriesDetailModal`
- Novos states: `isSeriesModalOpen`, `seriesEvent`
- Handler `openSeriesDetail(event)`: abre o modal da série
- Handler `handleSelectOccurrence(occurrence)`: fecha série e abre edição
- **Título do evento** (h2) clicável para eventos com `recurrenceGroupId`
- **Badge "Recorrente"** agora é botão que também abre detalhe da série

### Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ui/SeriesDetailModal.tsx` | **Novo**: componente modal de detalhe da série |
| `src/pages/EventsPage.tsx` | Adicionado modal, handlers, título clicável, badge como botão |
| `src/pages/EventsPage.test.tsx` | Adicionados 9 testes da seção "Série de Eventos" |

### Arquivos NÃO alterados
- `src/services/eventsApi.ts` — `listRecurrenceGroup` já existia
- `src/components/ui/Modal.tsx` — componente modal reutilizado sem alteração
- Backend — sem alteração

## Resultados dos testes

### Backend: 104 testes PASS

| Suite | Testes |
|-------|--------|
| Recorrência (existente) | 100 |
| findByRecurrenceGroup — novos | 4 |

Novos testes de backend (adicionados na Etapa 7.3, mantidos):
- `findByRecurrenceGroup` com grupo inexistente → array vazio
- `findByRecurrenceGroup` com uma única ocorrência
- `findByRecurrenceGroup` ordenação por `recurrenceIndex`
- `findByRecurrenceGroup` com múltiplas ocorrências

### Frontend: 57 testes PASS

| Suite | Testes |
|-------|--------|
| EventsPage — Recorrência (existente) | 17 |
| recurrence utility (Etapa 7.3) | 24 |
| AuthInput | 3 |
| AuthContext | 5 |
| **EventsPage — Série de Eventos (Etapa 7.4)** | **9** |

### Testes da Etapa 7.4 (9 testes)

| # | Teste | Descrição |
|---|-------|-----------|
| 1 | Badge em eventos recorrentes | Exibe badge "Recorrente" apenas em eventos com `recurrenceType === "WEEKLY"` |
| 2 | Abrir modal ao clicar no título | Clicar no título de evento recorrente abre o `SeriesDetailModal` |
| 3 | Informações da série | Modal exibe "Semanal", "Domingo", período correto |
| 4 | Lista de ocorrências | Modal exibe todas as ocorrências da série |
| 5 | Destaque da ocorrência atual | Ocorrência com mesmo `id` do evento é destacada com "● Ocorrência atual" |
| 6 | Selecionar outra ocorrência | Fecha modal de série, abre modal de edição da ocorrência selecionada |
| 7 | Badge não em evento normal | Evento sem recorrência não exibe badge |
| 8 | Erro ao carregar série | Mensagem de erro exibida quando `listRecurrenceGroup` falha |
| 9 | Resposta vazia da série | "Nenhuma ocorrência encontrada" exibido quando resposta é vazia |

### Build e Lint
- `npx vite build` (frontend): **PASS** (0 erros)
- `npx eslint src/pages/EventsPage.tsx`: **PASS** (0 erros)
- `npx eslint src/components/ui/SeriesDetailModal.tsx`: **PASS** (0 erros)
- `npx tsc --noEmit`: **PASS** (0 erros)
