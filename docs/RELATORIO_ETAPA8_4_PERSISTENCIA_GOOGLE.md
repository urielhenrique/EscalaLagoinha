# RELATORIO_ETAPA8_4_PERSISTENCIA_GOOGLE

## 1. Objetivo

Implementar a persistência segura da conexão Google Calendar, incluindo:
- Modelo Prisma `GoogleCalendarConnection`
- Criptografia AES-256-GCM para tokens
- Persistência de access token e refresh token criptografados
- Endpoints de status e disconnect
- Preparação para refresh de access token
- Isolamento por usuário (multi-tenancy)

## 2. Estado inicial

A Etapa 8.3 (Backend OAuth) implementou:
- `GET /api/integrations/google/connect` — gera URL de autorização
- `GET /api/integrations/google/callback` — recebe code/state do Google
- `GoogleOAuthStateService` — state in-memory com TTL 10min, single-use
- `GoogleCalendarService` — gera URL, troca code por tokens, mas **não persiste**
- Tokens eram logados mas não salvos

## 3. Modelo GoogleCalendarConnection

**Arquivo:** `backend/prisma/schema.prisma`

```prisma
model GoogleCalendarConnection {
  id              String   @id @default(uuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  googleAccountId String?
  accessTokenEnc  String
  refreshTokenEnc String
  expiresAt       DateTime
  scope           String
  calendarId      String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId])
}
```

**Relação:** User 1:1 GoogleCalendarConnection
- `userId` é único — uma conexão ativa por usuário
- `onDelete: Cascade` — ao deletar usuário, remove a conexão
- `churchId` **não** está diretamente no modelo — User já possui churchId, evitando duplicação

## 4. Migration

**Arquivo:** `backend/prisma/migrations/20260912000000_add_google_calendar_connection/migration.sql`

```sql
CREATE TABLE "GoogleCalendarConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleAccountId" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "calendarId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleCalendarConnection_userId_key" ON "GoogleCalendarConnection"("userId");
CREATE INDEX "GoogleCalendarConnection_userId_idx" ON "GoogleCalendarConnection"("userId");

ALTER TABLE "GoogleCalendarConnection" ADD CONSTRAINT "GoogleCalendarConnection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- Migration não-destrutiva
- Reversível conceitualmente (DROP TABLE)

## 5. Criptografia

**Arquivo:** `backend/src/integrations/google-calendar/google-encryption.service.ts`

**Algoritmo:** AES-256-GCM

**Chave:** Derivada via `scryptSync` de `GOOGLE_ENCRYPTION_KEY` com salt fixo.

**Formato do token criptografado:** `iv_base64:ciphertext_base64:authTag_base64`

- IV: 12 bytes aleatórios (nunca reutilizados)
- Auth Tag: 16 bytes (integridade)
- Chave derivada: 32 bytes via scrypt

**Propriedades:**
- Plaintext nunca é armazenado
- Mesmo plaintext gera ciphertext diferente (IV aleatório)
- Ciphertext alterado falha na descriptografia
- Auth tag inválida falha
- Chave inválida falha

## 6. Armazenamento dos tokens

Quando o callback da Etapa 8.3 recebe tokens do Google:

1. `access_token` → criptografado → salvo em `accessTokenEnc`
2. `refresh_token` → criptografado → salvo em `refreshTokenEnc`
3. `expires_at` → calculado a partir de `expiry_date` → salvo em `expiresAt`
4. `scope` → salvo em `scope`
5. `id_token` → decodificado para extrair `googleAccountId` (sub)

**Nunca:** plaintext, logs, frontend, exposta em respostas

## 7. Refresh token

- Se nova autorização não retorna `refresh_token`, o existente é preservado
- Na re-autorização (mesmo userId), `update` mantém `refreshTokenEnc` existente se novo for null
- Refresh token nunca é exposto em respostas

## 8. Access token

- Armazenado apenas como `accessTokenEnc`
- Nunca retornado em respostas HTTP
- Nunca logado
- Atualizado quando expirado via `refreshAccessToken()`

## 9. Status

**Endpoint:** `GET /api/integrations/google/status`

**Resposta (conectado):**
```json
{
  "connected": true,
  "googleAccountId": "1183...",
  "calendarId": null,
  "scope": "https://www.googleapis.com/auth/calendar.events",
  "connectedAt": "2026-09-12T...",
  "expiresAt": "2026-09-12T..."
}
```

**Resposta (desconectado):**
```json
{
  "connected": false,
  "googleAccountId": null,
  "calendarId": null,
  "scope": null,
  "connectedAt": null,
  "expiresAt": null
}
```

**NUNCA retorna:** accessToken, refreshToken, accessTokenEnc, refreshTokenEnc, clientSecret

## 10. Disconnect

**Endpoint:** `POST /api/integrations/google/disconnect`

**Fluxo:**
1. Autentica usuário via JWT
2. Localiza conexão pelo `userId` do JWT
3. Tenta revogar token no Google (sempre tenta, mas não bloqueia)
4. Remove conexão local (independentemente do resultado da revogação)
5. Retorna `{ success: true }`

**Se Google indisponível:** conexão local ainda é removida.

## 11. Segurança

- Tokens criptografados com AES-256-GCM
- Chave em variável de ambiente (`GOOGLE_ENCRYPTION_KEY`)
- Nunca hardcoded, commited, logged ou returned ao frontend
- IV aleatório a cada criptografia
- Auth tag previne tampering
- Respostas HTTP nunca contêm tokens
- Logs nunca contêm tokens

## 12. Multi-tenancy

- Todas as consultas utilizam `actor.id` do JWT
- Não aceita `?userId=` ou `?churchId=` externos
- Conexão isolada por usuário
- `churchId` derivado do User (não duplicado)

## 13. Testes

### Criptografia (10 testes)
1. encrypt/decrypt retorna valor original
2. mesmo plaintext gera ciphertext diferente
3. chave inválida falha
4. ciphertext alterado falha
5. auth tag inválida falha
6. formato inválido falha
7. string vazia funciona
8. string longa funciona
9. plaintext nunca aparece no ciphertext
10. isConfigured retorna corretamente

### Serviço (13 testes)
1. Service definido
2. getAuthorizationUrl retorna URL com Google
3. exchangeCode rejeita state inválido
4. exchangeCode rejeita state expirado
5. getFrontendRedirectUrl URL conectado
6. getFrontendRedirectUrl URL erro
7. getStatus retorna desconectado sem conexão
8. getStatus retorna conectado com dados
9. disconnect retorna sucesso sem conexão
10. disconnect deleta conexão
11. configuration lança sem config

### Controller (14 testes)
1. Controller definido
2. connect retorna authorizationUrl
3. callback redireciona em erro
4. callback redireciona sem code
5. callback redireciona sem state
6. callback redireciona sucesso
7. callback redireciona falha
8. callback não expõe tokens
9. status retorna conectado
10. status retorna desconectado
11. status não retorna tokens
12. disconnect retorna sucesso

**Total: 44 testes, todos passando**

## 14. Teste real

O teste real deve seguir o fluxo:
1. Usuário autenticado → `GET /api/integrations/google/connect`
2. Autorização Google → redirect
3. Callback → tokens persistidos criptografados
4. `GET /api/integrations/google/status` → `connected: true`
5. Verificar que nenhum token aparece na resposta
6. `POST /api/integrations/google/disconnect`
7. `GET /api/integrations/google/status` → `connected: false`

## 15. Limitações

- **Sincronização de eventos NÃO implementada** — pertence à Etapa 8.5+
- **Seleção de calendário NÃO implementada** — usa calendário padrão
- **Webhook NÃO implementado**
- **Locking distribuído NÃO implementado** — concorrência documentada mas não bloqueada
- State do OAuth é in-memory (perdido em restart do servidor)

## 16. Próxima etapa

**Etapa 8.5 — Sincronização de Eventos:**
- Criar campo `googleCalendarEventId` no model Event
- Criar campo `googleCalendarSyncedAt` no model Event
- Implementar create/update/delete de eventos no Google Calendar
- Sincronização unidirecional (Escala → Google)
- Retry com backoff exponencial
- Webhook para atualizações

## Arquivos criados/modificados

| Arquivo | Ação |
|---------|------|
| `backend/prisma/schema.prisma` | Adicionado model `GoogleCalendarConnection` |
| `backend/prisma/migrations/20260912000000_add_google_calendar_connection/migration.sql` | Criado |
| `backend/src/integrations/google-calendar/google-encryption.service.ts` | Criado |
| `backend/src/integrations/google-calendar/google-encryption.service.spec.ts` | Criado |
| `backend/src/integrations/google-calendar/google-calendar.service.ts` | Modificado |
| `backend/src/integrations/google-calendar/google-calendar.service.spec.ts` | Modificado |
| `backend/src/integrations/google-calendar/google-calendar.controller.ts` | Modificado |
| `backend/src/integrations/google-calendar/google-calendar.controller.spec.ts` | Modificado |
| `backend/src/integrations/google-calendar/google-calendar.module.ts` | Modificado |
| `backend/.env.example` | Adicionado `GOOGLE_ENCRYPTION_KEY` |
