# ETAPA PRODUCAO 3 - Deploy Real + Homologacao Controlada

Este guia transforma o ScheduleWell em ambiente real de uso com controle de risco.

## 1. Arquitetura recomendada no Coolify

- Projeto 1: Banco PostgreSQL (gerenciado no Coolify)
- Projeto 2: Backend NestJS (Dockerfile em backend)
- Projeto 3: Frontend React (Dockerfile.frontend)

Ambientes separados:

- Homologacao: app-hml.seudominio.com e api-hml.seudominio.com
- Producao: app.seudominio.com e api.seudominio.com

Regra:

- Nunca compartilhar banco entre homologacao e producao.
- Nunca reutilizar JWT_SECRET entre ambientes.

## 2. Deploy real no Coolify

### 2.1 Backend

- Source: GitHub publico do repositorio
- Build context: backend
- Dockerfile: backend/Dockerfile
- Healthcheck URL: /api/health
- Restart policy: Always
- Auto deploy: habilitado em push na branch alvo

Variaveis obrigatorias (backend):

Backend (producao) - formato para colar no Coolify:

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

SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=sua_chave_resend
SMTP_FROM_NAME=Escala Lagoinha
SMTP_FROM_EMAIL=seu-remetente@seu-dominio.com
SMTP_FROM=Escala Lagoinha <seu-remetente@seu-dominio.com>
```

Observacao importante:

- O backend usa SMTP_FROM no envio real.
- SMTP_FROM_NAME e SMTP_FROM_EMAIL podem ficar no Coolify para organizacao e referencia.
- Mantenha SMTP_FROM preenchido no formato Nome <email>.

### 2.2 Frontend

- Source: GitHub publico do repositorio
- Build context: raiz do projeto
- Dockerfile: Dockerfile.frontend
- Build args:
  - VITE_API_URL=https://api.seudominio.com/api
  - VITE_APP_NAME=ScheduleWell
- Dominio: app.seudominio.com
- SSL: gerenciado pelo proxy do Coolify

Frontend (producao) - formato para colar no Coolify:

```env
VITE_API_URL=https://api.seu-dominio.com/api
VITE_APP_NAME=ScheduleWell
```

### 2.3 Banco PostgreSQL

- Instancia separada por ambiente
- Nao expor porta publica do banco
- Liberar acesso somente para backend via rede interna
- Usuario e senha diferentes entre ambientes

Banco (producao) - formato para colar no Coolify:

```env
POSTGRES_DB=schedulewell
POSTGRES_USER=postgres
POSTGRES_PASSWORD=SENHA_FORTE_UNICA
```

## 3. Dominio e SSL

- Criar registros DNS:
  - app.seudominio.com -> frontend Coolify
  - api.seudominio.com -> backend Coolify
  - app-hml.seudominio.com -> frontend hml
  - api-hml.seudominio.com -> backend hml
- No Coolify, associar dominio em cada servico e habilitar SSL automatico.
- Validar em navegador:
  - certificado valido
  - cadeado ativo
  - redirecionamento para HTTPS

## 4. Banco de producao: backup e restore

Scripts do projeto:

- scripts/backup.sh
- scripts/restore.sh

Exemplo de backup manual:

- POSTGRES_DB=schedulewell POSTGRES_USER=postgres POSTGRES_PASSWORD=senha COMPOSE_FILE=docker-compose.prod.yml DB_SERVICE=postgres ./scripts/backup.sh

Exemplo de restore:

- POSTGRES_DB=schedulewell POSTGRES_USER=postgres POSTGRES_PASSWORD=senha COMPOSE_FILE=docker-compose.prod.yml DB_SERVICE=postgres ./scripts/restore.sh ./backups/arquivo.sql.gz

Cron diario (servidor/self-host):

- 0 2 \* \* \* cd /caminho/EscalaLagoinha && POSTGRES_DB=schedulewell POSTGRES_USER=postgres POSTGRES_PASSWORD=senha COMPOSE_FILE=docker-compose.prod.yml DB_SERVICE=postgres ./scripts/backup.sh >> /var/log/schedulewell-backup.log 2>&1

Politica minima recomendada:

- Diario: 30 dias
- Semanal: 8 semanas
- Mensal: 6 meses
- Teste de restore: quinzenal

## 5. Prisma em producao (seguro)

- Deploy de schema: prisma migrate deploy no startup do backend
- Seed inicial: executar uma unica vez por ambiente
- Nunca rodar seed automatico em todo restart

Comando seed controlado (manual):

- docker compose -f docker-compose.prod.yml exec backend npm run prisma:seed

## 6. Logs e monitoramento

No Coolify:

- Habilitar retencao de logs
- Monitorar backend por /api/health
- Alertar quando health falhar consecutivamente

Pontos para acompanhar:

- taxa de erro HTTP 5xx
- falhas SMTP
- picos de login/forgot password
- tempo de resposta de /api/health

## 7. Plano de homologacao controlada

Escopo inicial:

- 1 MASTER_ADMIN
- 1 ou 2 lideres (ADMIN)
- 3 a 8 voluntarios
- 1 ministerio piloto (exemplo: Midia)

Roteiro funcional obrigatorio:

1. Cadastro de voluntario
2. Aprovacao pelo admin
3. Login e permissao por perfil
4. Criacao de escala
5. Solicitacao de troca
6. Aprovacao/recusa de troca
7. Disparo de emails
8. Recuperacao de senha fim a fim
9. Check-in
10. Integracao Google Calendar

Criterios de saida da homologacao:

- 0 bloqueadores de seguranca
- 0 falhas criticas de autenticacao
- 0 erro critico em fluxo de escala/troca
- backup e restore validados
- SSL e dominio estaveis por 7 dias

## 8. Checklist final obrigatorio

- [ ] Login funcionando
- [ ] Reset de senha funcionando
- [ ] Emails funcionando
- [ ] Escalas funcionando
- [ ] Trocas funcionando
- [ ] Disponibilidade funcionando
- [ ] Google Calendar funcionando
- [ ] Check-in funcionando
- [ ] Backup diario configurado
- [ ] Restore testado
- [ ] SSL ativo
- [ ] Dominio funcionando
- [ ] Health check real OK (/api/health)
- [ ] Logs acessiveis no Coolify
- [ ] MASTER_ADMIN com senha forte e MFA externo quando possivel
- [ ] Swagger desativado em producao
- [ ] CORS restrito a dominio oficial

## 9. Estrategia para GitHub publico com seguranca

- Nunca commitar .env real
- Segredos apenas no Coolify
- Branches recomendadas:
  - main: producao
  - hml: homologacao
- Auto deploy:
  - backend-prod: branch main
  - backend-hml: branch hml
  - frontend-prod: branch main
  - frontend-hml: branch hml

## 10. Erros comuns e como evitar

- Erro: usar mesmo banco para hml e prod
  - Evitar: criar DATABASE_URL distinta por ambiente
- Erro: CORS aberto com \*
  - Evitar: definir CORS_ORIGINS explicito
- Erro: esquecer test de restore
  - Evitar: agenda quinzenal obrigatoria
- Erro: SSL ativo no app e nao na API
  - Evitar: validar app/api simultaneamente
- Erro: seed repetindo em restart
  - Evitar: seed manual e controlado

## 11. Como liberar para producao oficial

Fase 1 (piloto): 1 ministerio por 1 a 2 semanas
Fase 2 (expansao): 2 a 3 ministerios
Fase 3 (full): toda igreja

Gate entre fases:

- sem incidentes criticos por 7 dias
- backup/restores em dia
- feedback positivo dos lideres
- indicadores de uso estaveis
