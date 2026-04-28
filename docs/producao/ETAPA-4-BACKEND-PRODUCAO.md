# ETAPA PRODUCAO 4 - Backend pronto para deploy real

Foco exclusivo: backend NestJS + Prisma pronto para deploy estavel no Coolify.

## 1. O que foi preparado no backend

- Dockerfile multi-stage com runtime seguro e leve
- Processo de startup com retry de migration
- Seed controlada por variavel de ambiente (nao automatica por padrao)
- Health endpoint em GET /health
- Retry de conexao Prisma no bootstrap do modulo
- Shutdown hooks para encerramento limpo
- Variaveis de resiliencia para producao

Arquivos principais:

- backend/Dockerfile
- backend/scripts/start-prod.sh
- backend/src/main.ts
- backend/src/prisma/prisma.service.ts
- backend/src/health/health.service.ts

## 2. Variaveis de backend no Coolify (producao)

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://postgres:SENHA_FORTE@postgres:5432/schedulewell?schema=public

JWT_SECRET=COLOQUE_AQUI_UM_SEGREDO_BEM_LONGO_64_PLUS
JWT_EXPIRES_IN=7d

FRONTEND_URL=https://app.seu-dominio.com
APP_URL=https://app.seu-dominio.com
CORS_ORIGINS=https://app.seu-dominio.com

AUTH_RATE_LIMIT=5
ENABLE_SWAGGER=false

PRISMA_CONNECT_MAX_RETRIES=10
PRISMA_CONNECT_RETRY_DELAY_MS=5000
PRISMA_MIGRATE_MAX_RETRIES=10
PRISMA_MIGRATE_RETRY_DELAY_SECONDS=5
RUN_PRISMA_SEED=false

SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=sua_chave_resend
SMTP_FROM=Escala Lagoinha <seu-remetente@seu-dominio.com>
```

## 3. Estrategia segura de migration e seed

Migrations:

- Executadas no startup via backend/scripts/start-prod.sh
- Com retry configuravel para evitar falha em corrida de inicializacao

Seed:

- Nao roda automaticamente por padrao (RUN_PRISMA_SEED=false)
- Para seed controlada:
  - Definir RUN_PRISMA_SEED=true apenas no deploy desejado
  - Executar deploy
  - Voltar RUN_PRISMA_SEED=false em seguida

Opcao recomendada (mais segura):

- Manter RUN_PRISMA_SEED=false sempre
- Rodar seed manual uma unica vez:
  - docker compose -f docker-compose.prod.yml exec backend npm run prisma:seed

## 4. Health check no Coolify

Endpoint oficial:

- GET /health

Resposta esperada:

- status: ok
- database: connected
- timestamp: ISO

Exemplo de validacao:

- curl -i https://api.seu-dominio.com/health

## 5. Logs de producao

Ja registrados:

- inicializacao do app
- tentativas/falhas de conexao do Prisma
- falhas de envio de email
- falhas de autenticacao
- erros 5xx no filtro global
- acoes administrativas sensiveis

Diretriz:

- logs orientados a operacao, sem vazar stack ao cliente final

## 6. Como usar no Coolify (backend)

1. Conectar repositório GitHub publico
2. Build context: backend
3. Dockerfile: backend/Dockerfile
4. Command: padrao da imagem (nao sobrescrever)
5. Healthcheck path: /health
6. Restart policy: Always
7. Definir todas as env vars no painel
8. Deploy pela branch de producao

## 7. Checklist antes do primeiro deploy

- [ ] DATABASE_URL aponta para banco de producao correto
- [ ] JWT_SECRET unico e forte
- [ ] CORS_ORIGINS restrito ao frontend oficial
- [ ] ENABLE_SWAGGER=false em producao
- [ ] RUN_PRISMA_SEED=false
- [ ] SMTP validado
- [ ] Healthcheck configurado em /health
- [ ] Logs visiveis no Coolify
- [ ] Backup e restore testados

## 8. Checklist pos deploy

- [ ] GET /health retorna 200 e database=connected
- [ ] Login do MASTER_ADMIN funciona
- [ ] Reset de senha envia email
- [ ] Criacao de escala dispara notificacao
- [ ] Nao ha loop de restart no backend
- [ ] Nenhum erro critico continuo em logs
