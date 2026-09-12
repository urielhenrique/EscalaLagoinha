# RELATORIO_ETAPA8_5_3_1_AJUSTES_ARQUITETURA_GOOGLE

## 1. Documento revisado

`docs/ETAPA8_5_3_ARQUITETURA_SYNC_GOOGLE_CALENDAR.md`

## 2. Decisões adicionadas

Seção **19.1 — Ajustes arquiteturais pós-revisão** com 4 decisões:

| # | Decisão | Descrição |
|---|---------|-----------|
| 19.1.1 | ID determinístico | Google Event recebe `eventId` determinístico derivado de `Event.id` para evitar duplicação por retry |
| 19.1.2 | Extended Properties | Mantidas como camada de redundância, não substitui `googleEventId` nem ID determinístico |
| 19.1.3 | Timezone (revisão) | `dateTime` + `timeZone: "America/Sao_Paulo"` — decisão de representação, banco continua UTC |
| 19.1.4 | DELETE /sync-google (correção) | Remove vínculo local + tenta remover Google Event; best-effort; Event local preservado |

Seções adicionais:

| Seção | Conteúdo |
|-------|----------|
| 20 | Modelo de sincronização — local-first com execução assíncrona em memória, sem fila durável |
| 21 | Idempotência revisada — três camadas: ID determinístico, extendedProperties, googleEventId |
| 22 | Recorrência preservada — ocorrência independente, sem RRULE |
| 23 | API futura revisada — DELETE /sync-google com comportamento best-effort |
| 24 | Automação — decisão de MVP, sem infraestrutura de filas |
| 25 | Próxima etapa — 15 itens para Etapa 8.5.4 |

## 3. Alterações de índice

Seções anteriores 19 e 20 foram deslocadas para acomodar as novas seções:

| Antes | Depois |
|-------|--------|
| 19. Decisões arquiteturais | 19. Decisões arquiteturais (mantida) |
| — | 19.1. Ajustes arquiteturais pós-revisão (NOVA) |
| 20. Próxima etapa | 20-24. Seções adicionais (NOVAS) |
| — | 25. Próxima etapa (reescrita) |

## 4. Nenhuma alteração de código

- [x] Nenhuma alteração em código de produção
- [x] Nenhuma alteração no banco
- [x] Nenhuma migration criada
- [x] Nenhum endpoint criado
- [x] Nenhum arquivo TypeScript alterado

## 5. Riscos

| Risco | Mitigação |
|-------|-----------|
| ID determinístico pode violar restrições da Google Calendar API | Implementação deverá validar comprimento e caracteres |
| Fila em memória pode perder sync em crash | Resync manual permite recuperação |
| extendedProperties tem limite de 500 chars por propriedade | Valores são curtos (UUID, string fixa) |

## 6. Próxima etapa

**Etapa 8.5.4** — Implementação da sincronização backend (migration + service + endpoints + testes)

## Status

**PASS**
