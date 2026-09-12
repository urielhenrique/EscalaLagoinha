# Checklist de Produção - Escala Fácil

## Pré-Deploy

### Infraestrutura
- [ ] Coolify configurado com HTTPS habilitado
- [ ] PostgreSQL 16 acessível
- [ ] Variáveis de ambiente configuradas no Coolify
- [ ] DNS apontando para o servidor

### Variáveis de Ambiente
- [ ] `DATABASE_URL` - Conexão com PostgreSQL
- [ ] `JWT_SECRET` - Chave com no mínimo 32 caracteres
- [ ] `JWT_EXPIRES_IN` - Tempo de expiração (ex: "7d")
- [ ] `EMAIL_PROVIDER` - "gmail" ou "outlook"
- [ ] `EMAIL_USER` - E-mail do remetente
- [ ] `EMAIL_PASSWORD` - Senha de app do e-mail
- [ ] `NODE_ENV` - "production"

### Segurança
- [ ] Rate limiting configurado globalmente
- [ ] CSP headers no nginx
- [ ] Senhas com no mínimo 8 caracteres + maiúscula + número + especial
- [ ] Onboarding público restrito após primeira igreja
- [ ] JWT invalidação pós-troca de senha implementada

## Deploy

### Backend
1. [ ] `npx prisma migrate deploy` - Migrar banco de dados
2. [ ] `npx prisma generate` - Gerar Prisma Client
3. [ ] `npm run build` - Compilar TypeScript
4. [ ] Iniciar com `node dist/src/main.js`

### Frontend
1. [ ] `npm run build` - Gerar bundle de produção
2. [ ] Servir via nginx (Coolify)
3. [ ] Verificar CSP headers

## Pós-Deploy

### Verificação
- [ ] Login funcional
- [ ] Registro de voluntários funcional
- [ ] Onboarding de igreja funcional (se aplicável)
- [ ] Troca de escalas funcional
- [ ] Notificações chegando
- [ ] Relatórios carregando

### Monitoramento
- [ ] Logs acessíveis via Coolify
- [ ] Erros de banco de dados monitorados
- [ ] Performance verificada
- [ ] Uptime monitorado

## Rollback

Se algo falhar:

1. **Backend**: Reverta para a versão anterior do container
2. **Frontend**: Reverta para a versão anterior do build
3. **Banco**: Não execute rollback de migrations sem necessidade

## Comandos Úteis

```bash
# Verificar status do banco
npx prisma migrate status

# Gerar novo Prisma Client
npx prisma generate

# Rodar testes
cd backend && npm test
npm run test

# Verificar lint
cd backend && npm run lint
npm run lint
```
