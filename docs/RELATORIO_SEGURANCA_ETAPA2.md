# Relatório de Segurança - Etapa 2

**Data**: 09/09/2026  
**Status**: ✅ Implementado

## Resumo

Após a auditoria técnica completa (Etapa 1), foram implementadas correções de segurança para resolver problemas críticos e altos identificados.

## Problemas Corrigidos

### 1. Onboarding Restrito ✅
**Problema**: Onboarding público permitia criação de múltiplas igrejas  
**Solução**: Restrito quando igreja ativa existe  
**Arquivo**: `backend/src/auth/auth.service.ts:79-89`

### 2. Rate Limiting nos Endpoints Públicos ✅
**Problema**: Sem limite de tentativas em registro e onboarding  
**Solução**:
- Registro: 3 tentativas/minuto
- Onboarding: 1 tentativa/dia
- Recuperação de senha: 3 tentativas/minuto

**Arquivos**: `backend/src/auth/auth.controller.ts:47,55`

### 3. Senhas Fortes ✅
**Problema**: Senhas com mínimo de 6 caracteres  
**Solução**: Criador validator customizado com requisitos:
- Mínimo 8 caracteres
- 1 letra maiúscula
- 1 número
- 1 caractere especial

**Arquivo**: `backend/src/common/validators/is-strong-password.validator.ts`

### 4. CSP Headers ✅
**Problema**: Sem Content-Security-Policy  
**Solução**: Headers CSP adicionados em ambos nginx configs

**Arquivos**:
- `nginx.conf:20-21`
- `nginx.frontend.conf:28-29`

### 5. JWT Invalidation ✅
**Problema**: Tokens não eram invalidados após troca de senha  
**Solução**:
- Campo `passwordChangedAt` adicionado ao modelo User
- Migration não-destrutiva criada
- JWT Strategy verifica timestamp

**Arquivos**:
- `backend/prisma/schema.prisma:130`
- `backend/src/auth/strategies/jwt.strategy.ts:34-47`
- `backend/src/auth/password-reset.service.ts:100`

## Testes Implementados

### Backend (Jest)
- `auth.service.spec.ts` - Testes de onboarding restriction
- `jwt-auth.guard.spec.ts` - Testes de autenticação
- `roles.guard.spec.ts` - Testes de autorização
- `is-strong-password.validator.spec.ts` - Testes de validação de senha

**Total**: 19 testes passando

### Frontend (Vitest)
- `AuthContext.test.tsx` - Testes de contexto de autenticação
- `AuthInput.test.tsx` - Testes de componente

**Total**: 8 testes passando

## Documentação Criada

- `docs/SEGURANCA.md` - Guia completo de segurança
- `docs/CHECKLIST_PRODUCAO.md` - Checklist para deploy
- `docs/RELATORIO_SEGURANCA_ETAPA2.md` - Este documento

## Próximos Passos Recomendados

### Prioridade Alta
1. **Migração JWT para HttpOnly Cookies** (mínimo de esforço para mitigation)
   - Usar CSP para mitigar XSS sem migrar token

### Prioridade Média
2. Audit logs não implementados
3. Múltiplos refresh tokens não implementados

### Baixa Prioridade
4. HTTPS interno (já resolvido via Coolify)
5. Rate limiting no banco de dados

## Status dos Fixes Anteriores (Etapa 1)

Três fixes já aplicados permanecem não-commitados:
- `backend/src/common/filters/http-exception.filter.ts`
- `backend/src/main.ts`
- `backend/src/churches/churches.service.ts`

## Comandos para Verificação

```bash
# Backend
cd backend
npm test
npm run build
npm run lint

# Frontend
npm run test
npm run build
```
