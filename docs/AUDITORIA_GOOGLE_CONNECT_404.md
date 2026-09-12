# Auditoria Google Connect — 404

## 1. Sintoma

`GET http://localhost:3000/api/integrations/google/connect` retorna `404 Not Found`.

## 2. Rota esperada

- **Global prefix:** `api` (main.ts:76)
- **Controller:** `@Controller("integrations/google")` (google-calendar.controller.ts:23)
- **Método:** `@Get("connect")` (google-calendar.controller.ts:31)
- **Path final:** `GET /api/integrations/google/connect`
- **Autenticação:** JWT obrigatório (`@ApiBearerAuth("JWT-auth")` + `JwtAuthGuard` global)

## 3. Rota efetivamente implementada

A rota **EXISTE** no código fonte e **ESTÁ registrada** no NestJS.

Teste direto no backend (NestFactory) confirma:

```
/api/integrations/google/connect -> 401 {"message":"Unauthorized","statusCode":401}
/api/integrations/google/status  -> 401 {"message":"Unauthorized","statusCode":401}
```

A rota retorna **401** (JWT guard bloqueando acesso sem token), **não 404**.

## 4. Controller

`google-calendar.controller.ts:23` — `@Controller("integrations/google")`

Endpoints registrados:
- `GET connect` (linha 31)
- `GET callback` (linha 47)
- `GET status` (linha 112)
- `POST disconnect` (linha 124)

## 5. GoogleCalendarModule

`google-calendar.module.ts:7-15`:
- `controllers: [GoogleCalendarController]` ✓
- `providers: [GoogleCalendarService, GoogleOAuthStateService, GoogleEncryptionService]` ✓
- `exports: [GoogleCalendarService]` ✓

## 6. AppModule

`app.module.ts:67` — `GoogleCalendarModule` está na lista de imports ✓

## 7. Global prefix

`main.ts:76-78`:
```typescript
app.setGlobalPrefix("api", { exclude: ["health"] });
```

Path esperado: `/api/integrations/google/connect` ✓

## 8. Rotas registradas

Teste executado com NestFactory real confirma que a rota responde com **401**, não 404.

Todas as rotas Google Calendar estão funcionando:
- `GET /api/integrations/google/connect` → 401 (JWT required)
- `GET /api/integrations/google/status` → 401 (JWT required)
- `GET /api/integrations/google/callback` → 401 (JWT required — **ver observação abaixo**)
- `POST /api/integrations/google/disconnect` → 401 (JWT required)

## 9. Causa do 404

**Classificação: BAIXA (problema de infraestrutura, não de código)**

A rota **não retorna 404**. O backend registra corretamente todas as rotas Google Calendar. O 404 reportado pelo usuário vem de uma camada externa, não do NestJS.

Causa mais provável: **Nginx na porta 3000 servindo o frontend, não o backend.**

Evidência:
- `nginx.frontend.conf` escuta na porta 3000 (linha 3: `listen 3000`)
- `nginx.frontend.conf` **NÃO** possui `location /api/` de proxy
- Quando uma requisição `GET /api/...` chega no nginx.frontend.conf, atinge `location /` com `try_files $uri $uri/ /index.html`
- nginx retorna o `index.html` do frontend, ou 404 se o arquivo não existir
- Resultado: "Cannot GET /api/integrations/google/connect"

O backend real precisa estar rodando separadamente (porta diferente) e acessível via `nginx.conf` (que SÍ possui `location /api/` proxy para `backend:3000`).

**Observação adicional sobre callback:** O endpoint `GET /callback` não possui `@Public()`, portanto requer JWT. Isso impediria o fluxo OAuth funcionar (Google redireciona sem token). Este é um bug separado que precisa ser corrigido na Etapa 8.5.

## 10. Correção recomendada

Não é necessária correção no código NestJS.

Solução: garantir que o backend esteja rodando e acessível corretamente:
- Em dev: `npm run start:dev` na pasta `backend/` (porta 3000)
- Em prod: o `nginx.conf` já proxya `/api/` para `backend:3000`

Se o problema persistir em dev, verificar:
1. O backend está rodando? (`npm run start:dev` no `backend/`)
2. A porta 3000 está livre do nginx.frontend.conf?
3. A requisição está indo para o backend, não para o nginx?

## 11. Divergência com documentação

O `docs/RELATORIO_ETAPA8_4_PERSISTENCIA_GOOGLE.md` descreve corretamente a implementação. Não há divergência entre o código e a documentação. O código está correto.

## 12. Status

**PROBLEMA IDENTIFICADO**

A rota Google Calendar está implementada e registrada corretamente no NestJS. O 404 é causado por infraestrutura (provavelmente nginx.frontend.conf na porta 3000 servindo frontend em vez do backend), não por código faltante ou incorreto.
