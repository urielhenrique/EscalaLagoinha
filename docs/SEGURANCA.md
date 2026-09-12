# Guia de Segurança - Escala Fácil

## Visão Gonal

Este documento documenta as medidas de segurança implementadas no projeto Escala Fácil.

## Autenticação e Autorização

### JWT
- Tokens são validados em todas as rotas protegidas
- JWT_SECRET deve ter no mínimo 32 caracteres
- Tokens expiram após 7 dias (configurável via `JWT_EXPIRES_IN`)
- **Invalidação pós-troca de senha**: Após resetar a senha, tokens antigos são rejeitados automaticamente via campo `passwordChangedAt`

### Roles
- `MASTER_PLATFORM_ADMIN`: Acesso total ao sistema
- `MASTER_ADMIN`: Admin de uma igreja específica
- `ADMIN`: Admin com permissões limitadas
- `VOLUNTARIO`: Voluntário com permissões básicas

### Rate Limiting
- **Login**: 5 tentativas por minuto
- **Registro**: 3 tentativas por minuto
- **Onboarding**: 1 tentativa por dia
- **Recuperação de senha**: 3 tentativas por minuto

## Validação de Senhas

Todas as senhas devem atender aos seguintes requisitos:
- Mínimo de 8 caracteres
- Pelo menos 1 letra maiúscula
- Pelo menos 1 número
- Pelo menos 1 caractere especial (!@#$%^&*...)

## Headers de Segurança (HTTP)

### CSP (Content-Security-Policy)
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: https:;
connect-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self'
```

### Outros Headers
- `X-Frame-Options: SAMEORIGIN` - Previne clickjacking
- `X-Content-Type-Options: nosniff` - Previne MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` - Controla referrer
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` - Desabilita APIs sensíveis

## Onboarding

- Quando a primeira igreja é criada, o onboarding público fica indisponível
- Novas igrejas devem ser criadas pelo `MASTER_PLATFORM_ADMIN` via Master Admin Dashboard
- Isso previne criação não autorizada de igrejas

## HTTPS

- Configurado via Coolify (reverse proxy externo)
- O nginx dentro do container recebe HTTP do Coolify
- Não configurar TLS dentro do container

## Rate Limiting no Gateway

Configurado globalmente no `app.module.ts`:
```typescript
ThrottlerModule.forRoot([
  { name: 'short', ttl: 1000, limit: 10 },    // 10 req/s
  { name: 'medium', ttl: 10000, limit: 20 },  // 20 req/10s
  { name: 'auth', ttl: 60000, limit: 5 },     // 5 req/min
])
```

## Ambiente

- Variáveis sensíveis em `.env` (nunca commitar)
- JWT_SECRET, DATABASE_URL, EMAIL_PASSWORD em variáveis de ambiente
- Validação de variáveis no startup via ConfigService

## Testes de Segurança

### Backend (Jest)
```bash
cd backend
npm test
```

### Frontend (Vitest)
```bash
npm run test
```

## Checklist de Deploy

1. [ ] Todas as variáveis de ambiente configuradas
2. [ ] JWT_SECRET com no mínimo 32 caracteres
3. [ ] Database migrada (`npx prisma migrate deploy`)
4. [ ] HTTPS habilitado via Coolify
5. [ ] CSP headers configurados no nginx
6. [ ] Rate limiting ativo
7. [ ] Testes passando
