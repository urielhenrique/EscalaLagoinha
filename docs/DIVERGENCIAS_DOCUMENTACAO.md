# Divergências entre Documentação e Código

**Data**: 09/09/2026

| Documento | Descrição | Código | Divergência | Ação |
|-----------|-----------|--------|-------------|------|
| MANUAL_DO_USUARIO.md | Senha mínimo 6 caracteres | is-strong-password.validator.ts | Senha agora exige 8+ chars, maiúscula, número, especial | Documento desatualizado — registrar |
| MANUAL_DO_USUARIO.md | Google Calendar "quando disponível" | Nenhum código de integração | Google Calendar NÃO implementado | Documento incorreto — registrar |
| MANUAL_ADMINISTRADOR.md | Seed 5 ministérios | seed.ts:172-218 | ✅ Correto — Foto, Vídeo, Projeção, Iluminação, Transmissão | Nenhuma |
| MANUAL_ADMINISTRADOR.md | Seed 4 eventos | seed.ts:221-279 | ✅ Correto — Culto Domingo Manhã/Noite, Jovens, Ensaio | Nenhuma |
| MANUAL_ADMINISTRADOR.md | 8 tipos de notificação | schema.prisma:75-85 | ✅ Correto — 9 tipos (inclui NEW_VOLUNTEER_PENDING) | Nenhuma |
| GUIA_DESENVOLVIMENTO.md | npm test não funciona | Jest configurado na Etapa 2 | ✅ Corrigido na Etapa 2 | Nenhuma |
| AUDITORIA_TECNICA.md | Zero testes automatizados | Backend: 68 testes, Frontend: 8 testes | ✅ Corrigido — Etapa 6.1 atualizou documento | Nenhuma |
| RELATORIO_SEGURANCA_ETAPA2.md | JWT invalidation implementado | jwt.strategy.ts:34-47 | ✅ Correto | Nenhuma |
| MANUAL_DO_USUARIO.md | Disponibilidade: "se nenhuma configurada, disponível" | availability.service.ts:420-435 | ✅ Implementação confere | Nenhuma |
| MANUAL_ADMINISTRADOR.md | Aprovação MANUAL ou AUTO | ChurchSettings.approvalPolicy | Campo existe, mas auto-approval não implementado no código | PARCIAL — policy existe mas lógica não |
| MANUAL_ADMINISTRADOR.md | Lembrete configurável | REMINDERS_ENABLED, REMINDERS_HOURS_AHEAD | Funcional via endpoint manual | Nenhuma |
| AUDITORIA_TECNICA.md | Swagger documentação | swagger-config.ts | Configurado via ENABLE_SWAGGER | Nenhuma |

## Resumo

- **3 divergências** encontradas entre documentação e código
- **2 são desatualizações** da documentação (senha, Google Calendar)
- **1 é funcionalidade parcialmente implementada** (auto-approval)
