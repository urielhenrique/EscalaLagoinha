# Auditoria Técnica — Escala Fácil (Escala Lagoinha)

## Data da Auditoria

09/09/2026

## Versão/Commit Analisado

Branch: `main` | Último commit: limpo (`nothing to commit, working tree clean`)

## Stack Tecnológica

### Backend
- **Framework:** NestJS 11
- **Linguagem:** TypeScript 5.7
- **ORM:** Prisma 6.6
- **Banco:** PostgreSQL 16
- **Auth:** Passport + JWT (`@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`)
- **Email:** Resend API
- **Validação:** class-validator + class-transformer
- **Segurança:** Helmet, @nestjs/throttler (rate limiting)
- **Documentação:** Swagger (@nestjs/swagger)
- **Tarefas agendadas:** @nestjs/schedule
- **Relatórios:** ExcelJS, PDFKit
- **Runtime:** Node.js 22

### Frontend
- **Framework:** React 19 + TypeScript 6
- **Build:** Vite 8
- **Roteamento:** React Router DOM 7
- **HTTP Client:** Axios 1.15
- **State Management:** React Context (AuthContext + ToastContext)
- **UI:** Tailwind CSS 4, Lucide React (ícones)
- **Data Fetching:** @tanstack/react-query 5
- **PWA:** Service Worker customizado

### Infraestrutura
- **Containerização:** Docker + Docker Compose
- **Web Server:** Nginx 1.27 (frontend)
- **Produção:** docker-compose.prod.yml (multi-service)
- **HML:** docker-compose.hml.yml
- **Dev:** docker-compose.yml

## Arquitetura

### Geral
Arquitetura monorepo com frontend e backend separados:
```
/
├── backend/          → NestJS API (porta 3000)
├── src/              → React SPA (porta 5173 em dev)
├── docker-compose.yml
├── docker-compose.prod.yml
├── Dockerfile.frontend
└── nginx.conf / nginx.frontend.conf
```

### Backend (NestJS)
Módulos organizados por domínio:
- **auth/** — Autenticação, registro, login, recuperação de senha, JWT
- **users/** — CRUD de usuários, aprovação/rejeição
- **churches/** — Gerenciamento de igrejas, configurações, branding
- **ministries/** — CRUD de ministérios
- **events/** — CRUD de eventos
- **schedules/** — CRUD de escalas, verificação de conflitos
- **availability/** — Disponibilidade semanal, bloqueios, preferências
- **swap-requests/** — Solicitações de troca entre voluntários
- **notifications/** — Notificações in-app e lembretes agendados
- **email/** — Envio de emails via Resend
- **attendance/** — Registro de presença
- **audit-logs/** — Logs de auditoria
- **reports/** — Relatórios e exportações
- **smart-scheduler/** — Agendamento inteligente com IA
- **help-center/** — Central de ajuda e feedback
- **health/** — Health check
- **prisma/** — Serviço Prisma

### Frontend (React)
- **pages/** — 36 páginas (lazy-loaded)
- **components/** — Componentes reutilizáveis (auth, layout, pwa, ui)
- **services/** — 19 módulos de API (Axios)
- **context/** — AuthContext, ToastContext
- **hooks/** — useAuth
- **types/** — Definições de tipo (auth, domain, dashboard)
- **routes/** — Roteamento com proteção por perfil
- **utils/** — calendar.ts, date.ts

### Banco de Dados (Prisma)
17 models:
- User, Ministry, Event, Schedule, SwapRequest
- Notification, PasswordResetToken, VolunteerAvailability
- BlockedDate, VolunteerMinistryPreference, AttendanceRecord
- AuditLog, Church, ChurchSettings, ChurchSubscription
- PlatformBranding, HelpArticle, UserFeedback

## Resultado dos Testes

### Comandos Executados

```bash
# Frontend
npm run lint        → PASS (6 warnings, 0 errors)
npm run build       → PASS (built in 3.13s)

# Backend
npm run lint        → PASS (0 errors)
npm run build       → PASS
```

### Observações
- **Não existem testes unitários, de integração ou E2E** no projeto (nenhum arquivo `.spec.ts` ou `.test.ts` encontrado).
- O único script de teste é `test:etapa13:smoke` (script de smoke test manual).
- **Não há test runner configurado** (Jest, Vitest, etc.) no backend.

## Problemas Encontrados

| Severidade | Problema | Arquivo | Linha | Status |
|------------|----------|---------|-------|--------|
| CRÍTICO | Endpoint público cria MASTER_ADMIN sem autorização prévia | `auth/auth.controller.ts` | 47 | Documentado |
| CRÍTICO | Token JWT armazenado em localStorage (vulnerabilidade XSS) | `src/services/authStorage.ts` | 11 | Documentado |
| CRÍTICO | HTTPS não habilitado no nginx (trafego em plaintext) | `nginx.conf` | 11 | Documentado |
| CRÍTICO | Sem Content-Security-Policy header | `nginx.conf` / `nginx.frontend.conf` | — | Documentado |
| ALTO | Rate limiting ausente em register e onboarding | `auth/auth.controller.ts` | 37, 47 | Documentado |
| ALTO | JWT não invalidado após reset de senha | `auth/password-reset.service.ts` | 96 | Documentado |
| ALTO | Senhas com requisitos fracos (min 6, sem complexidade) | `auth/dto/register.dto.ts` | — | Documentado |
| ALTO | `listChurchAdmins` retornava VOLUNTÁRIOS junto | `churches/churches.service.ts` | 265 | **CORRIGIDO** |
| MÉDIO | `path` vazado em respostas de erro em produção | `common/filters/http-exception.filter.ts` | 68 | **CORRIGIDO** |
| MÉDIO | CORS aceita origem `null` em produção | `main.ts` | 49 | **CORRIGIDO** |
| MÉDIO | Help center artigos não marcados como @Public() | `help-center.controller.ts` | 28 | Documentado |
| MÉDIO | Service Worker registrado em modo dev | `src/pwa/sw-controller.ts` | 27 | Documentado |
| MÉDIO | Token de reset em query parameter (visível em logs) | `email/email.service.ts` | 151 | Documentado |
| BAIXO | 6 warnings de useEffect missing dependency | Diversos | — | Documentado |
| BAIXO | Console.error pode vazar dados sensíveis em produção | Diversos frontend | — | Documentado |
| BAIXO | Sem 401 auto-logout no interceptor Axios | `src/services/api.ts` | 53 | Documentado |
| BAIXO | Sem.headers de segurança: HSTS, X-XSS-Protection | `nginx.conf` | — | Documentado |
| INFO | Seed com senha hardcoded `admin123` (aceitável para dev) | `backend/prisma/seed.ts` | 66 | Documentado |
| INFO | Test script com credenciais hardcoded | `backend/scripts/test-etapa13-smoke.ts` | 57 | Documentado |

## Correções Realizadas

### 1. Path leak em responses de erro (MÉDIO → CORRIGIDO)
**Arquivo:** `backend/src/common/filters/http-exception.filter.ts`
**Mudança:** Campo `path` agora só é incluído em respostas de erro quando `NODE_ENV !== "production"`.

### 2. CORS aceitando origem null em produção (MÉDIO → CORRIGIDO)
**Arquivo:** `backend/src/main.ts`
**Mudança:** Requests sem `Origin` header só são permitidos em modo desenvolvimento. Em produção, requests sem origem são rejeitados.

### 3. listChurchAdmins retornava VOLUNTÁRIOS (ALTO → CORRIGIDO)
**Arquivo:** `backend/src/churches/churches.service.ts`
**Mudança:** O filtro de perfil foi corrigido para incluir apenas `ADMIN` e `MASTER_ADMIN`, removendo `VOLUNTARIO` da lista.

## Problemas Pendentes (requerem intervenção manual)

### CRÍTICO
1. **Endpoint de onboarding público** — Recomendado: adicionar rate limiting, proteger com token de convite, ou restringir a_MASTER_PLATFORM_ADMIN.
2. **JWT em localStorage** — Recomendado: migrar para httpOnly cookies para mitigar XSS.
3. **HTTPS não habilitado** — Descomentar bloco HTTPS no `nginx.conf` e configurar certificado TLS.
4. **Sem CSP header** — Adicionar header Content-Security-Policy ao nginx.

### ALTO
5. **Rate limiting em register/onboarding** — Adicionar `@Throttle()` nos endpoints.
6. **JWT não invalidado após reset** — Adicionar campo `passwordChangedAt` ao User model e validar no JWT strategy.
7. **Requisitos de senha fracos** — Adicionar complexidade mínima (maiuscula, numero, especial).

### MÉDIO
8. **Help center artigos não públicos** — Adicionar `@Public()` nos endpoints de leitura.
9. **Service Worker em dev** — Alterar para registrar apenas em produção.
10. **Token de reset em query** — Considerar usar fragmento de URL (#) ou fluxo POST.

## Riscos Conhecidos

1. **Produção sem HTTPS** — Todos os dados trafegam em plaintext. Risco de interceptação.
2. **Onboarding aberto** — Qualquer pessoa pode criar igreja e MASTER_ADMIN.
3. **Sem invalidação de JWT** — Após reset de senha, tokens antigos permanecem válidos por até 7 dias.
4. **Testes automatizados limitados** — Backend: 68 testes (Jest), Frontend: 8 testes (Vitest). Cobertura parcial.

## Segurança

### Implementado corretamente
- Hash de senhas com bcrypt (salt rounds 10)
- Senhas nunca expostas em respostas da API
- Validação de entrada com class-validator (whitelist, transform, forbidNonWhitelisted)
- Rate limiting nos endpoints de auth (login: 5/60s, forgot: 3/60s, reset: 5/60s)
- CORS configurável via variáveis de ambiente
- Helmet para headers HTTP de segurança
- Token de reset com hash SHA-256 e expiração de 1 hora
- Anti-enumeração no forgot-password (resposta neutra)
- Escopo por churchId em todas as queries
- Audit logs em operações sensíveis
- Usuário não-root no container Docker

### Não implementado / pendente
- Migrar JWT de localStorage para httpOnly cookies
- Invalidação de JWT após reset de senha
- CSP header
- HTTPS/HSTS
- Cobertura completa de testes automatizados
- Proteção contra brute-force além de rate limiting básico

## Performance

### Observações
- Lazy loading implementado em todas as páginas do frontend
- Gzip habilitado no nginx
- Cache de assets estáticos (1 ano com immutable)
- Service Worker com cache de navegação
- Queries Prisma com `select` explícito (sem overscrolling)
- Paginação não implementada em several endpoints (findAll sem limite)

### Recomendações
- Adicionar paginação a `GET /schedules`, `GET /swap-requests`, `GET /users`
- Monitorar queries N+1 em listagens com relações

## Dependências

### Backend
Todas as dependências estão em versões recentes e ativas. Nenhuma vulnerabilidade conhecida nas versões listadas.

### Frontend
Todas as dependências estão em versões recentes (React 19, Vite 8, TypeScript 6).

### Pendências
- Não executado `npm audit` (requer instalação de dependências de dev)
- Não executado `npm outdated`

## Produção

### Docker
- Backend: Multi-stage build, usuário não-root (nestjs:1001), healthcheck via `/health`
- Frontend: Multi-stage build com Nginx, healthcheck via HTTP root
- PostgreSQL: 16-alpine, healthcheck via pg_isready
- docker-compose.prod.yml: variáveis obrigatórias via `${VAR:?error}`

### Deploy
- Configuração via Coolify (inferido pela estrutura de arquivos)
- Variáveis de ambiente injetadas via Coolify/Docker

## Recomendações

### Imediatas (antes da próxima release)
1. Habilitar HTTPS em produção
2. Adicionar CSP header
3. Proteger endpoint de onboarding
4. Adicionar rate limiting a register e onboarding
5. Configurar invalidação de JWT pós-reset

### Curto prazo (1-2 semanas)
6. Migrar JWT para httpOnly cookies
7. Aumentar requisitos de senha
8. Adicionar paginação em endpoints de listagem
9. Marcar help center artigos como públicos
10. Configurar test runner e testes críticos

### Médio prazo (1-2 meses)
11. Implementar testes E2E com Playwright
12. Adicionar monitoramento de erros (Sentry ou similar)
13. Configurar CI/CD com testes automatizados
14. Implementar refresh token
15. Adicionar 2FA para contas admin
