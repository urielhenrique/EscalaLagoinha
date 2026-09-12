# RELATÓRIO — ETAPA 8.5.4.1.2: Correção Timezone e Idempotência

**Data:** 12/09/2026  
**Status:** PASS

---

## 1. Problemas Corrigidos

### FAIL #1 — Timezone (corrigido)

**Problema:** `toGoogleDateTime()` usava `date.toISOString()` que retorna UTC. O Google Calendar recebia `dateTime` UTC com `timeZone: "America/Sao_Paulo"`, interpretando como horário local — deslocando eventos em -3h.

**Solução:** Substituído por `Intl.DateTimeFormat` com `timeZone: "America/Sao_Paulo"` e `formatToParts()`. O resultado é `YYYY-MM-DDTHH:mm:ss` no horário de Brasília, sem offset.

### FAIL #2 — Idempotência (corrigido)

**Problema:** `createGoogleEvent()` não enviava o `id` determinístico no `requestBody`. O Google gerava seu próprio ID, e retry após falha parcial criaria duplicatas com IDs diferentes.

**Solução:** Adicionado `id: googleEventId` no `requestBody` do `events.insert()`. O Google Calendar respeita o `id` enviado, garantindo que mesmo evento sempre produza o mesmo Google Event ID.

---

## 2. Implementação Timezone

### Antes

```typescript
toGoogleDateTime(date: Date): string {
  return date.toISOString();
}
// Resultado para 2026-09-12T22:00:00.000Z: "2026-09-12T22:00:00.000Z"
```

### Depois

```typescript
toGoogleDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIMEZONE,  // "America/Sao_Paulo"
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}
// Resultado para 2026-09-12T22:00:00.000Z: "2026-09-12T19:00:00"
```

### Propriedades

- `Intl.DateTimeFormat` — API nativa do Node.js, sem dependências externas
- `timeZone: "America/Sao_Paulo"` — hardcoded, não depende de timezone da máquina
- `en-CA` — locale que garante formato `YYYY-MM-DD`
- `hour12: false` — formato 24h
- Sem suffix `Z` ou offset — formato aceito pelo Google Calendar API

---

## 3. Implementação ID Determinístico

### Antes

```typescript
const eventBody: calendar_v3.Schema$Event = {
  summary: input.nome,
  // ... sem campo id
};
```

### Depois

```typescript
const googleEventId = this.buildGoogleEventId(input.eventId);

const eventBody: calendar_v3.Schema$Event = {
  id: googleEventId,  // ← ID determinístico enviado ao Google
  summary: input.nome,
  // ...
};
```

### Fluxo de Idempotência

1. `buildGoogleEventId(eventId)` gera `escala-{eventId normalizado}`
2. ID é enviado no `requestBody.id` do `events.insert()`
3. Google aceita o ID fornecido (se não conflitar)
4. `response.data.id` retorna o mesmo ID enviado
5. `googleEventId` persistido no DB = ID determinístico
6. Retry com mesmo Event → mesmo ID → Google rejeita 409 ou atualiza

---

## 4. Testes — Antes vs Depois

### Timezone

| Teste | Antes | Depois |
|-------|-------|--------|
| `toGoogleDateTime` — conversão | Verificava ISO string UTC | Verifica horário São Paulo |
| `toGoogleDateTime` — sem offset | Não existia | Verifica ausência de Z/offset |
| Caso obrigatório 1: `2026-09-12T22:00:00Z` | Não existia | Verifica `2026-09-12T19:00:00` |
| Caso obrigatório 2: `2026-01-15T15:00:00Z` | Não existia | Verifica `2026-01-15T12:00:00` |
| Body enviado ao Google | Verificava só `timeZone` | Verifica `dateTime` + `timeZone` |
| Body start/end | Não verificava `dateTime` | Verifica `dateTime` e `timeZone` em ambos |

### Idempotência

| Teste | Antes | Depois |
|-------|-------|--------|
| Não criar duplicata (SYNCED) | Existia | Mantido |
| `requestBody.id` = determinístico | Não existia | **Novo** |
| `response.data.id` persistido | Não verificava | **Novo** |
| Retry usa mesmo ID | Não existia | **Novo** |

---

## 5. Resultado dos Testes

### Sync service

```
npx jest google-calendar-sync.service.spec.ts --runInBand
Tests: 50 passed, 50 total (antes: 46)
```

**4 novos testes adicionados:**
1. `should send deterministic ID in requestBody.id on create`
2. `should persist response.data.id which equals the deterministic ID`
3. `should use same deterministic ID on retry (same event)`
4. `should send correct dateTime and timeZone in start/end` (substituiu teste anterior)

### Backend completo

```
npx jest --runInBand
Tests: 251 passed, 251 total (antes: 247)
```

### Build

```
npx nest build
(sem erros)
```

### Lint

```
npx eslint google-calendar-sync.service.ts google-calendar-sync.service.spec.ts
(sem erros)
```

---

## 6. Arquivos Alterados

| Arquivo | Alteração |
|---------|-----------|
| `backend/src/integrations/google-calendar/google-calendar-sync.service.ts` | `toGoogleDateTime()` reescrito; `id` adicionado ao `requestBody` no create |
| `backend/src/integrations/google-calendar/google-calendar-sync.service.spec.ts` | 3 testes de timezone reescritos; 4 novos testes (idempotência + body verification) |

---

## 7. Critérios de Aceite

### Timezone

- [x] UTC convertido para America/Sao_Paulo
- [x] dateTime correto (`YYYY-MM-DDTHH:mm:ss`)
- [x] timeZone correto (`America/Sao_Paulo`)
- [x] Testes verificam dateTime (não só timeZone)
- [x] Testes independem timezone da máquina (usam `Intl.DateTimeFormat` hardcoded)

### Idempotência

- [x] ID determinístico utilizado no Google insert (`requestBody.id`)
- [x] Mesmo Event gera mesmo ID
- [x] Events diferentes geram IDs diferentes
- [x] ExtendedProperties continuam presentes
- [x] Retry utiliza mesmo ID (testado)
- [x] `googleEventId` retornado corresponde ao ID determinístico

### Qualidade

- [x] Testes do service passam (50/50)
- [x] Todos os testes backend passam (251/251)
- [x] Build passa
- [x] Nenhum endpoint criado
- [x] EventsService não alterado
- [x] Frontend não alterado
- [x] Nenhum segredo/token exposto

---

## 8. Itens PENDING Não Tratados

| Item | Status | Etapa futura |
|------|--------|--------------|
| Multi-tenancy (churchId validation) | PENDING | 8.5.4.2+ |
| DELETE 404 como sucesso lógico | PENDING | 8.5.4.2+ |
| UPDATE 404 (recriar) | PENDING | 8.5.4.2+ |
| Token refresh retry | PENDING | 8.5.4.2+ |

---

## 9. Próxima Etapa

**Etapa 8.5.4.2:** Integração com EventsService + endpoints REST de sincronização.
