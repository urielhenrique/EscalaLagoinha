# Auditoria Etapa 8.5.4.1.1

**Data:** 12/09/2026  
**Arquivo auditado:** `backend/src/integrations/google-calendar/google-calendar-sync.service.ts`  
**Spec auditado:** `backend/src/integrations/google-calendar/google-calendar-sync.service.spec.ts`

---

## 1. Contagem de testes

**Comando:** `npx jest google-calendar-sync.service.spec.ts --runInBand --no-coverage`  
**Resultado:** 46 testes, 1 suite, todos passando

### Por describe

| Describe | Testes |
|----------|--------|
| (raiz) | 1 |
| buildGoogleEventId | 6 |
| toGoogleDateTime | 2 |
| syncEvent | 11 |
| deleteGoogleEvent | 7 |
| syncEvent - edge cases | 4 |
| integration patterns | 3 |
| deterministic ID consistency | 3 |
| Brazil timezone handling | 3 |
| extended properties | 3 |
| idempotency | 1 |
| Brazil timezone in Google event body | 1 |
| update event body structure | 1 |
| **TOTAL** | **46** |

**Diferença em relação ao relatório:** ZERO. Relatório declarou 46, Jest confirma 46.

**Total backend:** 247 testes (16 suites).

---

## 2. Timezone — AUDITORIA CRÍTICA

### Análise de `toGoogleDateTime()` (linha 40-42)

```
toGoogleDateTime(date: Date): string {
  return date.toISOString();
}
```

- **Entrada:** `Date`
- **Saída:** `date.toISOString()` — formato UTC, ex: `2026-09-15T19:00:00.000Z`
- Usa `toISOString()` — NÃO usa `Intl.DateTimeFormat`
- NÃO converte para `America/Sao_Paulo`

### Teste mental com entrada especificada

**Entrada:** `2026-09-12T22:00:00.000Z` (UTC)

**`toISOString()` retorna:** `2026-09-12T22:00:00.000Z`

**Resultado esperado pelo enunciado:**
- dateTime: `2026-09-12T19:00:00` (horário de Brasília = UTC-3)
- timeZone: `America/Sao_Paulo`

**O que o service envia ao Google:**
```json
{
  "dateTime": "2026-09-12T22:00:00.000Z",
  "timeZone": "America/Sao_Paulo"
}
```

### Problema

O `dateTime` enviado é **UTC** (`22:00:00Z`), mas o `timeZone` é `America/Sao_Paulo`. O Google Calendar interpreta `dateTime` como **horário local** da timezone indicada. Resultado:

- Google lê: "12 de setembro às 22:00 no horário de São Paulo"
- Evento real: 12 de setembro às **01:00** do dia seguinte (horário de Brasília)
- **Erro: +3 horas**

**Para funcionar corretamente, deveria enviar:**
```json
{
  "dateTime": "2026-09-12T19:00:00",   // sem offset, horário local
  "timeZone": "America/Sao_Paulo"
}
```

### Status: **FAIL**

O `toGoogleDateTime()` retorna `toISOString()` (UTC) em vez de converter para horário local de São Paulo. O campo `timeZone` está correto, mas o `dateTime` está errado. Os testes existentes passam porque o mock do Google API não valida o formato do dateTime.

---

## 3. Multi-tenancy

### Todas as consultas Prisma no service

| # | Método | Modelo | Filtro | churchId validado? | userId validado? | Risco |
|---|--------|--------|--------|--------------------|--------------------|-------|
| 1 | `findUnique` (linha 62) | GoogleCalendarConnection | `{ where: { userId } }` | N/A (tabela por userId) | Sim (via param) | OK |
| 2 | `findUnique` (linha 71) | Event | `{ where: { id: input.eventId } }` | **NÃO** | N/A | **MÉDIO** |
| 3 | `update` (linha 146) | Event | `{ where: { id: input.eventId } }` | **NÃO** | N/A | **MÉDIO** |
| 4 | `findUnique` (linha 236) | Event | `{ where: { id: eventId } }` | **NÃO** | N/A | **MÉDIO** |
| 5 | `findUnique` (linha 246) | GoogleCalendarConnection | `{ where: { userId } }` | N/A | Sim | OK |
| 6 | `update` (linha 260) | Event | `{ where: { id: eventId } }` | **NÃO** | N/A | **MÉDIO** |
| 7 | `update` (linha 290) | Event | `{ where: { id: eventId } }` | **NÃO** | N/A | **MÉDIO** |

### Análise

O service é um **core service** (chamado por controllers/EventsService que já validam). Ele NÃO valida `churchId` em nenhuma consulta ao Event. Isso é aceitável **somente se** o caller já validou a autorização.

**Risco:** Se o service for chamado diretamente por um endpoint sem validação, um usuário poderia sincronizar/deletar eventos de outra igreja.

### Status: **PASS com PENDING**

A ausência de validação de `churchId` é aceitável para um core service, mas deve ser documentado como requisito para callers.

---

## 4. Google Connection

Verificação de que a conexão utilizada é sempre do userId correto:

- **Linha 62:** `findUnique({ where: { userId } })` — busca connection pelo userId fornecido
- **Linha 246:** `findUnique({ where: { userId } })` — idem para delete

O `userId` vem do parâmetro `syncEvent(userId, ...)` / `deleteGoogleEvent(userId, ...)`, que é o userId autenticado pelo JWT. Não há possibilidade de usar conexão de outro usuário.

### Status: **PASS**

---

## 5. ID Determinístico

### Análise de `buildGoogleEventId()` (linha 35-38)

```
buildGoogleEventId(eventId: string): string {
  const normalized = eventId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `escala-${normalized}`;
}
```

| Propriedade | Resultado |
|-------------|-----------|
| Determinismo | Sim — mesma entrada = mesmo resultado |
| Caracteres permitidos | [a-z0-9] após normalização |
| Prefixo | `escala-` sempre presente |
| Timestamp/random | Ausente |
| Tamanho | `7 + len(eventId normalizado)` |
| Compatibilidade Google Calendar | Sim — caracteres alfanuméricos |

### Testes reais executados (nos testes unitários)

| Input | Output | OK? |
|-------|--------|-----|
| `550e8400-e29b-41d4-a716-446655440000` | `escala-550e8400e29b41d4a716446655440000` | Sim |
| `evt-001` vs `evt-002` | Diferentes | Sim |
| `""` | `escala-` | Sim (edge case) |
| `!@#$%` | `escala-` | Sim (edge case) |
| `ABC-123` | `escala-abc123` | Sim (lowercase) |

### Unicidade entre Events

O ID é baseado no UUID do Event (que é único). Não há colisão possível entre diferentes Events.

### Status: **PASS**

---

## 6. Idempotência

### CREATE — O que acontece na prática

1. `buildGoogleEventId(eventId)` gera ID determinístico
2. Google API `events.insert()` é chamado **sem verificar se já existe**
3. Google retorna um `response.data.id` (ID do Google, diferente do determinístico)
4. O `googleEventId` persistido é `response.data.id` (não o determinístico)

### Camadas de idempotência

| Camada | Implementada? | Eficaz? |
|--------|---------------|---------|
| ID determinístico | Sim (gerado mas NÃO usado como chave) | **NÃO** — não impede duplicatas |
| extendedProperties | Sim (enviadas mas NÃO consultadas) | **NÃO** — não são usadas para buscar duplicatas |
| googleEventId no DB | Sim (checa antes de criar) | **PARCIAL** — só funciona se status = SYNCED |

### Problema

Se um create falhar **depois** do Google criar o evento mas **antes** de persistir no DB (network timeout, crash):
- Google tem o evento
- DB não tem `googleEventId`
- Retry → cria **segundo evento** no Google

O `events.insert()` não usa `eventId` como chave — o Google gera seu próprio ID. O service **não** usa `events.list` + `extendedProperties` para verificar duplicatas antes de criar.

### Status: **FAIL**

A idempotência não está completa. Retry após falha parcial pode criar duplicatas no Google Calendar.

---

## 7. Update

### Quando update é chamado

- Condição: `existingEvent?.googleSyncStatus === GoogleSyncStatus.SYNCED && existingEvent.googleEventId` (linha 76-79)

### googleEventId obtido de

- `prisma.event.findUnique({ where: { id: input.eventId }, select: { googleEventId: true } })` (linha 71-74)

### calendarId

- `prisma.googleCalendarConnection.findUnique({ where: { userId }, select: { calendarId: true } })` (linha 62-65)
- Fallback: `"primary"` se null

### extendedProperties

- Enviadas no body do update (linha 186-194)
- Incluem: `escala-facil=true`, `eventId`, `churchId`, `recurrenceGroupId`

### Tratamento de 404

- **NÃO tratado** — se o evento foi deletado do Google externamente, `calendar.events.update()` lança erro
- Erro é capturado pelo catch geral (linha 93) e salva como `ERROR` no DB
- Não há lógica para detectar 404 e recriar

### Comportamento sem googleEventId

- Se `googleSyncStatus !== SYNCED` ou `googleEventId === null`, vai para `createGoogleEvent()` (linha 88)
- Não tenta update sem googleEventId

### Status: **PASS com PENDING**

Update funciona corretamente. 404 não tratado é um gap aceitável para MVP (seria tratado como ERROR e re-sincronizado manualmente).

---

## 8. Delete

### O que acontece

1. Verifica se `event.googleEventId` existe — se não, retorna sucesso (linha 241-243)
2. Chama `calendar.events.delete()` (linha 255-258)
3. Reseta campos no DB: `googleEventId: null`, `googleSyncStatus: NONE`, `lastSyncedAt: null`, `googleSyncError: null` (linha 260-268)

### Event local NÃO é excluído

Confirmado — apenas campos de sync são resetados. O Event continua existindo no DB.

### 404 tratado como sucesso lógico?

**NÃO** — se o Google retornar 404 (evento já deletado), o catch retorna `{ success: false, error: ... }` (linha 275-282). Deveria retornar `{ success: true }` para 404, pois o resultado desejado (evento não existe no Google) já foi alcançado.

### calendarId correto

Sim — busca via `GoogleCalendarConnection.userId`, fallback para `"primary"`.

### Multi-tenancy

Mesmo risco da seção 3 — `findUnique({ where: { id: eventId } })` sem validação de `churchId`. Depende do caller.

### Status: **PASS com PENDING**

Delete funciona, mas 404 do Google deveria ser tratado como sucesso lógico.

---

## 9. Token Refresh

### Reutilização

O sync service chama `this.googleCalendarService.refreshAccessToken(userId)` (linha 48-49, 226-227). Esta é a mesma função usada pelo GoogleCalendarService para manage tokens.

### Comportamento do `refreshAccessToken()`

- Verifica se token não expirado (com buffer de 5 min) → retorna token existente
- Se expirado → decodifica refresh token, chama `oauth2Client.getAccessToken()`, persiste novo token
- Em caso de falha → retorna `null` (não lança exceção)

### Retry / 401

- **NÃO** há retry no `refreshAccessToken()` — se falhar, retorna null
- **NÃO** há retry no sync service — se null, retorna ERROR

### Limite de retry

Nenhum. Se o refresh falhar, o sync retorna ERROR imediatamente.

### Status: **PASS com PENDING**

Funcional para MVP. Retry e tratamento de 401 do Google podem ser adicionados futuramente.

---

## 10. Segurança

### Logs encontrados no service

| Linha | Nível | Mensagem | Dados sensíveis? |
|-------|-------|----------|------------------|
| 96-98 | `logger.error` | `Sync failed for event ${input.eventId}: ${errorMsg}` | eventId + mensagem de erro |
| 156-158 | `logger.log` | `Event ${input.eventId} created in Google Calendar as ${createdGoogleId}.` | eventId + googleEventId |
| 211-213 | `logger.log` | `Event ${input.eventId} updated in Google Calendar (${existingGoogleEventId}).` | eventId + googleEventId |
| 270-272 | `logger.log` | `Event ${eventId} deleted from Google Calendar (${event.googleEventId}).` | eventId + googleEventId |
| 278-280 | `logger.error` | `Failed to delete Google event for ${eventId}: ${errorMsg}` | eventId + mensagem de erro |
| 298-300 | `logger.error` | `Failed to update sync error for event ${eventId}: ...` | eventId |

### Análise

- **NENHUM** accessToken, refreshToken, clientSecret ou authorizationCode é logado
- `errorMsg` pode conter detalhes da API Google — em caso de erro 400/401, a mensagem pode conter partes da request, mas não tokens
- `console.log` / `console.error` não são usados
- Não há exposta de credenciais nos logs

### Status: **PASS**

---

## 11. Divergências encontradas

### FAIL (2)

1. **TIMEZONE:** `toGoogleDateTime()` usa `toISOString()` (UTC) em vez de converter para horário local de São Paulo. O `dateTime` enviado ao Google é UTC mas o `timeZone` é `America/Sao_Paulo`, resultando em eventos deslocados em -3h.

2. **IDEMPOTÊNCIA:** CREATE não verifica duplicatas via `events.list` + `extendedProperties`. Retry após falha parcial pode criar eventos duplicados no Google Calendar.

### PENDING (4)

3. **MULTI-TENANCY:** Consultas `Event.findUnique({ where: { id } })` não validam `churchId`. Aceitável para core service, mas deve ser documentado como requisito para callers.

4. **DELETE 404:** Google Calendar 404 retorna `{ success: false }` em vez de `{ success: true }` (sucesso lógico).

5. **TOKEN REFRESH:** Sem retry. Se refresh falhar, sync retorna ERROR imediatamente.

6. **UPDATE 404:** Se evento foi deletado do Google externamente, update retorna ERROR em vez de detectar e recriar.

---

## 12. Conclusão

**STATUS: FAIL**

A implementação tem 2 problemas que devem ser corrigidos antes de uso em produção:

1. **Timezone** — Eventos serão deslocados em -3 horas no Google Calendar. O `dateTime` precisa ser convertido de UTC para horário local antes de enviar ao Google.

2. **Idempotência** — Retry após falha parcial pode criar duplicatas. O CREATE deveria usar `events.list` com `extendedProperties` para verificar duplicatas antes de inserir.

Os 4 itens PENDING são gaps aceitáveis para MVP mas devem ser documentados e tratados em etapas futuras.

### Testes

- 46/46 passando
- 247/247 backend total
- Build limpo
- Os testes existentes NÃO cobrem o bug de timezone (mock não valida formato dateTime)
