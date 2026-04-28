# Escala Lagoinha

Sistema web para gestão de voluntários, ministérios, eventos e escalas de culto — com PWA, autenticação JWT, notificações automáticas, troca de escalas e IA para sugestão de alocação.

## Stack

| Camada   | Tecnologia                                      |
| -------- | ----------------------------------------------- |
| Frontend | React 19 + TypeScript + Vite 8 + TailwindCSS v4 |
| Backend  | NestJS 11 + Prisma ORM                          |
| Banco    | PostgreSQL 16                                   |
| Auth     | JWT (Bearer)                                    |
| Deploy   | Docker Compose + Nginx                          |
| PWA      | Service Worker manual (Vite 8 compatible)       |

---

## Início rápido (desenvolvimento)

### Pré-requisitos

- [Docker Desktop](https://docs.docker.com/get-docker/) instalado e em execução
- Node.js 22+ (para dev local sem Docker)

### Subir com Docker (recomendado)

```bash
# 1. Clone o repositório
git clone <url-do-repositorio>
cd EscalaLagoinha

# 2. Copie e ajuste as variáveis de ambiente
cp backend/.env.example backend/.env
# Edite backend/.env com seus valores

# 3. Suba os containers (banco + backend)
docker compose up -d --build

# 4. Instale dependências do frontend e rode em dev
npm install
npm run dev
```

A API estará em `http://localhost:3000/api`.  
O frontend estará em `http://localhost:5173`.

### Desenvolvimento local (sem Docker)

```bash
# Backend
cd backend
npm install
# Configure DATABASE_URL no backend/.env apontando para um PostgreSQL local
npm run start:dev

# Frontend (outra aba)
cd ..
npm install
npm run dev
```

---

## Variáveis de ambiente

### Backend (`backend/.env`)

| Variável                | Obrigatória | Padrão        | Descrição                                 |
| ----------------------- | ----------- | ------------- | ----------------------------------------- |
| `DATABASE_URL`          | ✅          | —             | URL de conexão PostgreSQL                 |
| `JWT_SECRET`            | ✅          | —             | Segredo JWT (mín. 32 chars aleatórios)    |
| `JWT_EXPIRES_IN`        | —           | `7d`          | Validade do token                         |
| `PORT`                  | —           | `3000`        | Porta do servidor                         |
| `NODE_ENV`              | —           | `development` | `production` \| `development`             |
| `CORS_ORIGINS`          | ✅ prod     | localhost     | Origens permitidas, separadas por vírgula |
| `ENABLE_SWAGGER`        | —           | `true`        | Expor `/docs` em produção                 |
| `REMINDERS_ENABLED`     | —           | `true`        | Ativar lembretes automáticos              |
| `REMINDERS_HOURS_AHEAD` | —           | `24`          | Horas de antecedência dos lembretes       |
| `OPENAI_API_KEY`        | —           | —             | Chave para sugestões de IA (opcional)     |

### Frontend (`.env` na raiz)

| Variável       | Obrigatória | Descrição                                             |
| -------------- | ----------- | ----------------------------------------------------- |
| `VITE_API_URL` | ✅          | URL base da API, ex: `https://api.meudominio.com/api` |

> Gere um JWT_SECRET seguro:
>
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

---

## Seed inicial

```bash
cd backend
npm run prisma:seed
```

Cria automaticamente:

- **Admin**: `admin@schedulewell.com` / `admin123`
- Ministérios: Foto, Vídeo, Projeção, Iluminação, Transmissão
- Eventos padrão: Culto Domingo Manhã, Culto Domingo Noite, Culto de Jovens, Ensaio Worship
- Voluntários fictícios para testes

---

## Endpoints principais

| Método | Rota                 | Descrição                 |
| ------ | -------------------- | ------------------------- |
| `GET`  | `/api/health`        | Health check (público)    |
| `POST` | `/api/auth/register` | Cadastro                  |
| `POST` | `/api/auth/login`    | Login                     |
| `GET`  | `/api/auth/me`       | Perfil do usuário logado  |
| `GET`  | `/api/users`         | Listar usuários (ADMIN)   |
| `GET`  | `/api/ministries`    | Listar ministérios        |
| `GET`  | `/api/events`        | Listar eventos            |
| `GET`  | `/api/schedules`     | Listar escalas            |
| `GET`  | `/api/notifications` | Listar notificações       |
| `POST` | `/api/swap-requests` | Solicitar troca de escala |

Documentação completa: `http://localhost:3000/docs`

---

## Deploy em produção

Guia oficial da ETAPA PRODUCAO 3:

- docs/producao/ETAPA-3-DEPLOY-HOMOLOGACAO.md
- docs/producao/HOMOLOGACAO-CHECKLIST.csv
- scripts/validate-prod.sh
- docker-compose.hml.yml
- .env.hml.example

### Opção 1 — VPS com Docker (recomendado)

```bash
# 1. No servidor, clone o repositório
git clone <url-do-repositorio>
cd EscalaLagoinha

# 2. Configure as variáveis de produção
cp backend/.env.example backend/.env
nano backend/.env  # Defina JWT_SECRET, POSTGRES_PASSWORD, CORS_ORIGINS etc.

# 3. Faça o build do frontend
npm install
VITE_API_URL=https://seu.dominio.com/api npm run build
# Os arquivos ficam em ./dist/

# 4. Suba o ambiente de produção
docker compose -f docker-compose.prod.yml up -d --build

# 5. Verifique os containers
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

### Ambiente de homologação isolado

```bash
cp .env.hml.example .env.hml
# Ajuste os valores reais de homologacao no arquivo .env.hml

docker compose --env-file .env.hml -f docker-compose.hml.yml up -d --build
docker compose --env-file .env.hml -f docker-compose.hml.yml ps
```

#### TLS (HTTPS) com Let's Encrypt

```bash
# Instale certbot
sudo apt install certbot

# Gere o certificado
sudo certbot certonly --standalone -d seu.dominio.com

# Descomente o bloco HTTPS em nginx.conf e ajuste o domínio
# Suba o Nginx novamente
docker compose -f docker-compose.prod.yml restart nginx
```

### Validação rápida de produção/homologação

```bash
chmod +x scripts/validate-prod.sh
./scripts/validate-prod.sh \
  --frontend https://app.seu-dominio.com \
  --backend https://api.seu-dominio.com/api
```

### Opção 2 — Railway / Render (backend)

1. Aponte o repositório para Railway/Render
2. Configure `Root Directory` como `backend`
3. Defina as variáveis de ambiente no painel
4. A plataforma detecta o `Dockerfile` automaticamente

O health check em `/api/health` é usado pela plataforma para verificar disponibilidade.

### Opção 3 — Vercel / Netlify (frontend)

**Vercel:**

```bash
npm i -g vercel
vercel --prod
# Configure VITE_API_URL nas Environment Variables do projeto
```

**Netlify:**

```bash
npm run build
# Arraste a pasta dist/ para o painel do Netlify
# Ou conecte o repositório e configure:
#   Build command: npm run build
#   Publish directory: dist
#   Environment: VITE_API_URL=https://sua-api.com/api
```

Crie `netlify.toml` na raiz para SPA routing:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## Backup e restauração

### Fazer backup manual

```bash
chmod +x scripts/backup.sh
./scripts/backup.sh
# Arquivo criado em ./backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

### Agendar backup automático (cron)

```bash
# Edite o crontab
crontab -e

# Adicione (backup diário às 2h, retenção de 30 dias)
0 2 * * * /caminho/para/EscalaLagoinha/scripts/backup.sh >> /var/log/escala-backup.log 2>&1
```

### Restaurar backup

```bash
chmod +x scripts/restore.sh
./scripts/restore.sh ./backups/backup_20260501_020000.sql.gz
```

---

## Checklist de produção

Antes de colocar em produção, verifique:

- [ ] `JWT_SECRET` é um valor aleatório longo e único (≥ 64 chars)
- [ ] `POSTGRES_PASSWORD` é uma senha forte e única
- [ ] `NODE_ENV=production` definido no backend
- [ ] `CORS_ORIGINS` contém apenas o(s) domínio(s) do frontend
- [ ] `ENABLE_SWAGGER=false` (ou protegido por auth)
- [ ] HTTPS configurado (TLS via Let's Encrypt ou proxy do PaaS)
- [ ] Backup automático agendado e testado
- [ ] Health check respondendo em `/api/health`
- [ ] Logs monitorados (ex.: `docker compose logs -f backend`)
- [ ] Variáveis de ambiente não commitadas no git (`.env` no `.gitignore`)

---

## Estrutura do projeto

```
EscalaLagoinha/
├── backend/               # API NestJS
│   ├── prisma/            # Schema, migrations e seed
│   ├── src/
│   │   ├── auth/          # JWT + Guards
│   │   ├── health/        # Health check endpoint
│   │   ├── users/         # Gestão de usuários
│   │   ├── ministries/    # Gestão de ministérios
│   │   ├── events/        # Gestão de eventos
│   │   ├── schedules/     # Escalas e confirmações
│   │   ├── swap-requests/ # Solicitações de troca
│   │   ├── notifications/ # Notificações automáticas
│   │   └── smart-scheduler/ # Sugestões via IA
│   └── Dockerfile
├── src/                   # Frontend React
│   ├── components/        # UI, layout, auth
│   ├── pages/             # Rotas/páginas
│   ├── services/          # Chamadas de API
│   └── context/           # Auth, Toast
├── public/                # SW, manifest, offline.html
├── scripts/               # backup.sh, restore.sh
├── docker-compose.yml     # Ambiente de desenvolvimento
├── docker-compose.prod.yml # Ambiente de produção
└── nginx.conf             # Configuração Nginx (produção)
```

---

## Licença

Projeto privado — Comunidade Lagoinha. Todos os direitos reservados.
