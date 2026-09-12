# Relatório Etapa 7.2 — Frontend de Recorrência de Eventos

## Objetivo

Implementar a interface de criação de eventos recorrentes no frontend.

## Estado anterior

- EventsPage com formulário de criação/edição de eventos únicos
- Campos: nome, descrição, data início, data fim
- Sem suporte a recorrência no frontend
- Backend já suportava recorrência semanal (Etapa 7.1)

## Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/types/domain.ts` | Adicionados tipos `RecurrenceType`, `RecurrenceDay`, `RecurrenceConfig`, `RecurrenceEventResponse`. Atualizados `EventItem` e `CreateEventPayload` |
| `src/services/eventsApi.ts` | Atualizado return type de `createEvent` para suportar `RecurrenceEventResponse`. Adicionada função `listRecurrenceGroup` |
| `src/pages/EventsPage.tsx` | Adicionado formulário de recorrência, pré-visualização, validações, badge na listagem |
| `src/pages/EventsPage.test.tsx` | Criado arquivo com 17 testes para recorrência |

## Componentes criados/alterados

### EventsPage.tsx (alterado)

- **Formulário de recorrência**: Checkbox "Evento recorrente" que revela campos de configuração
- **Seleção de dias da semana**: Botões toggle para Dom-Sex com estado visual
- **Datas da recorrência**: Campos date para data inicial e final
- **Pré-visualização**: Lista das ocorrências calculadas (máximo 10 visíveis)
- **Badge de recorrência**: Indicador visual "Recorrente" nos cards de evento
- **Validações**: 6 regras de validação antes do envio
- **Payload dinâmico**: Envia `recurrence` apenas quando checkbox marcado

## Fluxo da interface

1. Usuário clica "Novo evento"
2. Preenche nome, descrição, data início, data fim (campos existentes)
3. Marca "Evento recorrente" (opcional)
4. Seleciona dias da semana (1 ou mais)
5. Define data inicial e final da recorrência
6. Pré-visualização mostra datas calculadas em tempo real
7. Validação verifica: dias selecionados, datas válidas, máximo 52 ocorrências
8. Ao salvar, envia payload com campo `recurrence`
9. Mensagem de sucesso mostra total de eventos criados

## Payload enviado ao backend

### Evento único (inalterado)

```json
{
  "nome": "Conferência",
  "descricao": "...",
  "dataInicio": "2026-10-04T19:00:00.000Z",
  "dataFim": "2026-10-04T21:00:00.000Z"
}
```

### Evento recorrente (novo)

```json
{
  "nome": "Culto Domingo",
  "descricao": "...",
  "dataInicio": "2026-10-04T19:00:00.000Z",
  "dataFim": "2026-10-04T21:00:00.000Z",
  "recurrence": {
    "type": "WEEKLY",
    "startDate": "2026-10-01T00:00:00.000Z",
    "endDate": "2026-12-27T00:00:00.000Z",
    "daysOfWeek": ["DOMINGO"]
  }
}
```

## Validações frontend

| # | Validação | Mensagem |
|---|-----------|----------|
| 1 | Campos obrigatórios | "Preencha todos os campos obrigatórios para salvar o evento." |
| 2 | Datas inválidas | "Datas inválidas. Verifique os horários informados." |
| 3 | dataFim > dataInicio | "A data final deve ser posterior à data inicial." |
| 4 | Data recorrência obrigatória | "Informe a data inicial/final da recorrência." |
| 5 | Dias da semana | "Selecione pelo menos um dia da semana." |
| 6 | Máximo 52 ocorrências | "O período selecionado gera mais de 52 ocorrências." |
| 7 | Zero ocorrências | "Nenhuma ocorrência válida gerada para a configuração informada." |

## Pré-visualização

- Calcula ocorrências no frontend usando `calculateOccurrences`
- Mostra no máximo 10 datas na prévia
- Se houver mais, exibe "... e mais X ocorrências"
- Atualiza em tempo real ao alterar dias ou datas
- Aviso: "Serão criadas ocorrências individuais para cada data selecionada."
- Aviso: "Limite máximo: 52 ocorrências por série."

## Listagem de eventos

- Eventos recorrentes exibem badge "Recorrente" ao lado do nome
- Badge usa estilo visual consistente (brand-500/15, text-brand-200)
- Edição de eventos existentes não mostra seção de recorrência

## Testes adicionados

| # | Teste | Status |
|---|-------|--------|
| 1 | Página renderiza corretamente | PASS |
| 2 | Modal de criação abre com campos básicos | PASS |
| 3 | Checkbox de recorrência inicia desmarcado | PASS |
| 4 | Ao ativar recorrência, campos aparecem | PASS |
| 5 | Ao desativar recorrência, campos desaparecem | PASS |
| 6 | Seleção de dia da semana funciona (toggle) | PASS |
| 7 | Mensagens de aviso sobre recorrência são exibidas | PASS |
| 8 | Prévia calcula datas semanais | PASS |
| 9 | Validação exige dia da semana | PASS |
| 10 | Validação de data final da recorrência | PASS |
| 11 | Validação de campos obrigatórios (evento único) | PASS |
| 12 | Payload de evento único está correto | PASS |
| 13 | Payload recorrente possui recurrence correto | PASS |
| 14 | Sucesso de criação recorrente mostra total | PASS |
| 15 | Badge de recorrência aparece na listagem | PASS |
| 16 | Edição não mostra seção de recorrência | PASS |
| 17 | Prévia respeita múltiplos dias | PASS |

**Total: 17 testes passando**

## Resultado dos testes

```
Test Files  3 passed (3)
     Tests  25 passed (25)
```

- 8 testes existentes (AuthInput, AuthContext) - preservados
- 17 testes novos (EventsPage recorrência) - adicionados

## Resultado do build

```
✓ built in 1.93s
```

Build PASS. TypeScript compila sem erros.

## Resultado do lint

```
✖ 6 problems (0 errors, 6 warnings)
```

Lint PASS. 0 erros. 6 warnings preexistentes (React Hook dependencies em outros arquivos).

## Acessibilidade

- Checkbox com label associado
- Botões de dias da semana com `aria-pressed`
- Grupo de dias com `role="group"` e `aria-label`
- Inputs com labels associados
- Mensagens de erro inline

## Responsividade

- Formulário utiliza `grid-cols-1 md:grid-cols-2` para layouts de 2 colunas
- Dias da semana usam `flex-wrap` para telas pequenas
- Modal com `max-w-2xl` e scroll interno
- Pré-visualização com `max-h-40 overflow-y-auto`

## Limitações

- Somente recorrência semanal (WEEKLY)
- Edição de evento recorrente não permite alterar configuração de recorrência
- Sem edição em série ("editar todas as ocorrências")
- Sem exclusão em série
- Sem exceções da série
- Prévia calculada no frontend pode ter leve divergência de timezone em relação ao backend
