# Guia de Desenvolvimento — Escala Fácil

## 1. Arquitetura do Projeto

### Estrutura de Pastas

```
EscalaLagoinha/
├── backend/                    → API NestJS (porta 3000)
│   ├── src/
│   │   ├── app.module.ts       → Módulo raiz
│   │   ├── main.ts             → Bootstrap da aplicação
│   │   ├── auth/               → Autenticação (login, registro, JWT)
│   │   ├── users/              → CRUD de usuários
│   │   ├── churches/           → Gerenciamento de igrejas
│   │   ├── ministries/         → CRUD de ministérios
│   │   ├── events/             → CRUD de eventos
│   │   ├── schedules/          → CRUD de escalas
│   │   ├── availability/       → Disponibilidade de voluntários
│   │   ├── swap-requests/      → Solicitações de troca
│   │   ├── notifications/      → Notificações
│   │   ├── email/              → Envio de emails (Resend)
│   │   ├── attendance/         → Registro de presença
│   │   ├── audit-logs/         → Logs de auditoria
│   │   ├── reports/            → Relatórios
│   │   ├── smart-scheduler/    → Agendamento inteligente (regras de negócio)
│   │   ├── help-center/        → Central de ajuda
│   │   ├── health/             → Health check
│   │   ├── prisma/             → Serviço Prisma
│   │   └── common/             → Filtros, interceptors, utilitários
│   ├── prisma/
│   │   ├── schema.prisma       → Schema do banco de dados
│   │   ├── seed.ts             → Dados iniciais
│   │   └── migrations/         → Migrações do banco
│   └── Dockerfile              → Multi-stage build
│
├── src/                        → Frontend React (porta 5173)
│   ├── App.tsx                 → Componente raiz
│   ├── main.tsx                → Entry point
│   ├── routes/                 → Roteamento e proteção
│   ├── pages/                  → 36 páginas (lazy-loaded)
│   ├── components/             → Componentes reutilizáveis
│   ├── services/               → 19 módulos de API
│   ├── context/                → AuthContext, ToastContext
│   ├── hooks/                  → useAuth
│   ├── types/                  → Definições TypeScript
│   └── utils/                  → calendar.ts, date.ts
│
├── docker-compose.yml          → Ambiente de desenvolvimento
├── docker-compose.prod.yml     → Ambiente de produção
├── docker-compose.hml.yml      → Ambiente de homologação
├── Dockerfile.frontend         → Build do frontend
├── nginx.conf                  → Configuração do nginx (proxy reverso)
└── nginx.frontend.conf         → Configuração do nginx (SPA)
```

## 2. Pré-requisitos

- **Node.js** 22+
- **npm** 10+
- **Docker** + Docker Compose (para banco de dados)
- **Git**

## 3. Instalação Local

### Clone o repositório

```bash
git clone <url-do-repositorio>
cd EscalaLagoinha
```

### Instale dependências

```bash
# Frontend
npm install

# Backend
cd backend
npm install
cd ..
```

### Variáveis de Ambiente

#### Backend (`backend/.env`)

Copie o exemplo e configure:

```bash
cp backend/.env.example backend/.env
```

Variáveis obrigatórias:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DATABASE_URL` | URL de conexão com PostgreSQL | `postgresql://postgres:senha@localhost:5435/escala_lagoinha?schema=public` |
| `JWT_SECRET` | Segredo JWT (mínimo 32 caracteres) | `seu-segredo-muito-seguro-com-mais-de-32-caracteres` |
| `JWT_EXPIRES_IN` | Tempo de expiração do token | `7d` |
| `FRONTEND_URL` | URL do frontend | `http://localhost:5173` |
| `APP_URL` | URL da aplicação (para emails) | `http://localhost:5173` |
| `CORS_ORIGINS` | Origens permitidas (separadas por vírgula) | `http://localhost:5173,http://localhost:5174` |
| `PORT` | Porta do backend | `3000` |
| `NODE_ENV` | Ambiente | `development` |

Variáveis opcionais:

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `AUTH_RATE_LIMIT` | Limite de requisições de auth | `5` |
| `ENABLE_SWAGGER` | Habilitar Swagger | `true` |
| `RESEND_API_KEY` | Chave da API Resend | (vazio = mock) |
| `RESEND_FROM` | E-mail remetente | `Escala Lagoinha <noreply@escalalagoinhabh.com>` |
| `RUN_PRISMA_SEED` | Executar seed ao iniciar | `false` |

**Nota sobre IA:** `OPENAI_API_KEY` e `OPENAI_MODEL` são OPCIONAIS e FUTURAS. Nenhuma funcionalidade critica depende delas. A aplicação funciona normalmente sem essas variáveis.

#### Frontend (raiz `.env`)

```bash
cp .env.example .env
```

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `VITE_API_URL` | URL da API backend | `http://localhost:3000/api` |
| `VITE_APP_NAME` | Nome do aplicativo | `Escala Fácil` |

## 4. Banco de Dados

### Iniciar PostgreSQL (Docker)

```bash
docker compose up -d postgres
```

Ou para ambiente completo (banco + backend):

```bash
docker compose up -d
```

### Gerar Prisma Client

```bash
cd backend
npx prisma generate
```

### Executar Migrações

```bash
cd backend
npx prisma migrate dev
```

### Seed (Dados Iniciais)

```bash
cd backend
npx prisma db seed
```

A seed cria:
- 3 igrejas (Lagoinha Jardim Atlântico, Centro, Pampulha)
- 1 MASTER_ADMIN (master@lagoinha.com)
- 1 ADMIN (admin@schedulewell.com)
- 4 voluntários
- 5 ministérios (Foto, Vídeo, Projeção, Iluminação, Transmissão)
- 4 eventos (Culto Domingo Manhã/Noite, Culto Jovens, Ensaio Worship)

### Acessar o Banco

```bash
# Listar bancos
docker compose exec postgres psql -U postgres -l

# Conectar ao banco
docker compose exec postgres psql -U postgres -d escala_lagoinha
```

### Prisma Studio (GUI)

```bash
cd backend
npx prisma studio
```

Acesse http://localhost:5555

## 5. Iniciar o Projeto

### Modo Desenvolvimento (Recomendado)

**Terminal 1 — Backend:**

```bash
cd backend
npm run start:dev
```

Backend rodando em http://localhost:3000

**Terminal 2 — Frontend:**

```bash
npm run dev
```

Frontend rodando em http://localhost:5173

### Modo Docker (Completo)

```bash
docker compose up -d
```

Serviços:
- PostgreSQL: http://localhost:5435
- Backend: http://localhost:3000
- Frontend: http://localhost:5173

## 6. Comandos Disponíveis

### Frontend (raiz)

```bash
npm run dev          # Iniciar servidor de desenvolvimento
npm run build        # Build de produção
npm run lint         # Verificar código (ESLint)
npm run preview      # Pré-visualizar build de produção
```

### Backend (`cd backend`)

```bash
npm run start:dev    # Iniciar com hot-reload
npm run start        # Iniciar sem hot-reload
npm run build        # Build de produção
npm run start:prod   # Iniciar build de produção
npm run lint         # Verificar código (ESLint)
npm run prisma:generate  # Gerar Prisma Client
npm run prisma:migrate   # Executar migrações
npm run prisma:deploy    # Deploy de migrações (produção)
npm run prisma:seed      # Executar seed
```

## 7. Estrutura de um Módulo NestJS

Cada módulo segue o padrão:

```
modulo/
├── modulo.module.ts          → Definição do módulo
├── modulo.controller.ts      → Endpoints HTTP
├── modulo.service.ts         → Lógica de negócio
├── dto/                      → Data Transfer Objects
│   ├── create-modulo.dto.ts
│   └── update-modulo.dto.ts
└── (outros arquivos conforme necessário)
```

### Exemplo: Criar um novo módulo

1. Criar pasta `src/novo-modulo/`
2. Criar `novo-modulo.module.ts`
3. Criar `novo-modulo.controller.ts` com endpoints
4. Criar `novo-modulo.service.ts` com lógica
5. Criar DTOs com validações
6. Registrar no `app.module.ts`

## 8. Autenticação e Autorização

### Fluxo de Login

1. Frontend envia `POST /auth/login` com email + senha
2. Backend valida credenciais e retorna JWT
3. Frontend armazena token no localStorage
4. Requisições subsequentes incluem `Authorization: Bearer <token>`

### Guardas de Rota

- **JwtAuthGuard** — Global. Todas as rotas requerem JWT por padrão
- **@Public()** — Remove autenticação da rota
- **@Roles(Perfil.ADMIN)** — Requer perfil específico
- **RolesGuard** — MASTER_ADMIN e MASTER_PLATFORM_ADMIN sempre passam

### No Frontend

- `PrivateRoute` — Requer autenticação + opcionalmente perfil específico
- `PublicRoute` — Apenas para não autenticados (login, cadastro)

## 9. Testes

### Status Atual

O projeto possui testes automatizados configurados e funcionando:

**Backend (Jest):**
- 68 testes passando em 11 suites
- Comando: `cd backend && npm test`
- Configuração: `backend/jest.config.ts`

**Frontend (Vitest):**
- 8 testes passando em 2 suites
- Comando: `npm test`
- Configuração: `vite.config.ts` (seção `test`)
- Ambiente: jsdom
- Setup: `src/test/setup.ts`

### Comandos de Teste

```bash
# Backend
cd backend
npm run test         # Testes unitários
npm run test:cov     # Com cobertura
npm run test:e2e     # Testes E2E

# Frontend
npm run test         # Testes unitários
npm run test:ui      # Interface gráfica
```

## 10. Build e Deploy

### Build de Produção

```bash
# Frontend
npm run build

# Backend
cd backend
npm run build
```

### Docker Build

```bash
# Backend
docker build -t escala-backend ./backend

# Frontend
docker build -t escala-frontend -f Dockerfile.frontend .
```

### Deploy com Docker Compose (Produção)

```bash
# Configurar variáveis no .env de produção
cp .env.example .env.production

# Editar .env.production com valores reais
# NUNCA committar este arquivo

# Deploy
docker compose -f docker-compose.prod.yml up -d
```

### Deploy com Coolify

O projeto está configurado para deploy via Coolify:

1. Conecte o repositório no Coolify
2. Configure as variáveis de ambiente no painel
3. O Coolify detectará automaticamente:
   - `Dockerfile` para o backend
   - `Dockerfile.frontend` para o frontend
4. Configure os serviços:
   - Backend: porta 3000, healthcheck `/health`
   - Frontend: porta 80, proxy reverso

## 11. Variáveis de Ambiente Completa

### Backend

| Variável | Obrigatória | Uso | Segredo |
|----------|-------------|-----|---------|
| `DATABASE_URL` | Sim | Conexão PostgreSQL | Não |
| `JWT_SECRET` | Sim | Assinatura JWT | Sim |
| `JWT_EXPIRES_IN` | Não | Expiração do token (padrão: 7d) | Não |
| `PORT` | Não | Porta do servidor (padrão: 3000) | Não |
| `NODE_ENV` | Não | Ambiente (development/production) | Não |
| `FRONTEND_URL` | Sim | URL do frontend | Não |
| `APP_URL` | Sim | URL da aplicação | Não |
| `CORS_ORIGINS` | Sim | Origens permitidas | Não |
| `AUTH_RATE_LIMIT` | Não | Limite de auth (padrão: 5) | Não |
| `ENABLE_SWAGGER` | Não | Habilitar Swagger (padrão: false) | Não |
| `RESEND_API_KEY` | Não | Chave Resend (vazio = mock) | Sim |
| `RESEND_FROM` | Não | E-mail remetente | Não |
| `RUN_PRISMA_SEED` | Não | Executar seed (padrão: false) | Não |
| `OPENAI_API_KEY` | Não | Chave OpenAI (OPCIONAL — FUTURA, não necessária) | Sim |
| `OPENAI_MODEL` | Não | Modelo OpenAI (OPCIONAL — FUTURA, não necessária) | Não |
| `REMINDERS_ENABLED` | Não | Habilitar lembretes (padrão: true) | Não |
| `REMINDERS_HOURS_AHEAD` | Não | Horas antes do evento (padrão: 24) | Não |

### Frontend

| Variável | Obrigatória | Uso | Segredo |
|----------|-------------|-----|---------|
| `VITE_API_URL` | Sim (produção) | URL da API | Não |
| `VITE_APP_NAME` | Não | Nome do app | Não |

## 12. Troubleshooting

### Erros Comuns

**"VITE_API_URL não configurada"**
- Configure `VITE_API_URL` no `.env` do frontend

**"Erro de conexão com banco"**
- Verifique se o PostgreSQL está rodando: `docker compose ps`
- Verifique as credenciais no `.env` do backend

**"JWT_SECRET não definido"**
- Adicione `JWT_SECRET` ao `.env` do backend com mínimo 32 caracteres

**"CORS: origem não permitida"**
- Adicione a origem do frontend em `CORS_ORIGINS`

**Porta já em uso**
- Mude a porta no `.env` ou mate o processo na porta

### Logs

```bash
# Ver logs do Docker
docker compose logs -f backend
docker compose logs -f postgres

# Ver logs do NestJS (desenvolvimento)
# Os logs são exibidos no terminal do start:dev
```

### Reset do Banco (DESENVOLVIMENTO APENAS)

```bash
cd backend
npx prisma migrate reset
npx prisma db seed
```

**NÃO execute em produção.**

## 13. Boas Práticas

### Código

- Siga o padrão de módulos do NestJS
- Use DTOs com class-validator para validação
- Valide entrada no controller, lógica no service
- Use `@CurrentUser()` para obter o usuário autenticado
- Sempre filtre por `churchId` em queries

### Git

- Branch `main` é a branch de produção
- Crie branches para features: `feature/nome-da-feature`
- Crie branches para fixes: `fix/nome-do-fix`
- Commits em português ou inglês (seja consistente)

### Segurança

- NUNCA committar `.env`
- Use variáveis de ambiente para secrets
- Valide todos os inputs no backend
- Não confie em validações do frontend
- Use HTTPS em produção
- Mantenha dependências atualizadas
