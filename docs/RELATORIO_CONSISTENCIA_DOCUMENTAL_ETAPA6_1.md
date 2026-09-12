# Relatório de Consistência Documental — Etapa 6.1

**Data**: 10/09/2026  
**Objetivo**: Alinhar a documentação ao estado real do projeto após a Etapa 6.

---

## Documentos revisados

| Documento | Alterado |
|-----------|----------|
| `docs/MATRIZ_FUNCIONALIDADES.md` | SIM |
| `docs/GUIA_DESENVOLVIMENTO.md` | SIM |
| `docs/ENDPOINT_SECURITY_MATRIX.md` | SIM |
| `docs/AUDITORIA_TECNICA.md` | SIM |
| `docs/RELATORIO_FINAL_AUDITORIA.md` | SIM |
| `docs/DIVERGENCIAS_DOCUMENTACAO.md` | SIM |
| `docs/RELATORIO_TESTES_FUNCIONAIS_ETAPA3.md` | SIM |

---

## Correções realizadas

### MATRIZ_FUNCIONALIDADES.md

1. **Data e etapa atualizadas** — De "09/09/2026 — Etapa 3" para "10/09/2026 — Etapa 6.1"
2. **Seção de testes adicionada** — Informação atualizada: Backend 68/68, Frontend 8/8
3. **Smart Scheduler renomeado** — Seção "IA / SMART SCHEDULER" → "SMART SCHEDULER (regras/heurísticas locais)"
4. **Insights por evento esclarecido** — Adicionada nota de que são heurísticas locais, NÃO IA
5. **Resumo atualizado** — De contagens numéricas (98/4/0/2/82) para descrição qualitativa com informações de testes

### GUIA_DESENVOLVIMENTO.md

1. **Seção de testes reescrita** — Removida afirmação "não possui testes automatizados"
2. **Status dos testes documentado** — Backend 68/68 (Jest), Frontend 8/8 (Vitest)
3. **Configuração de testes simplificada** — Instruções de instalação removidas (já configurado)

### ENDPOINT_SECURITY_MATRIX.md

1. **Smart Scheduler endpoints atualizados** — Todos 7 endpoints marcados como ✅ (corrigidos na Etapa 5.1)
2. **notifications/run-reminders atualizado** — De ⚠️ para ✅ (cron processa igrejas individualmente)
3. **help-center/feedback (GET) atualizado** — De ⚠️ para ✅ (filtra por churchId)
4. **audit-logs atualizado** — De ⚠️ para ✅ (churchId do JWT)
5. **reports endpoints atualizados** — De ⚠️ para ✅ (churchId do JWT)
6. **Resumo de vulnerabilidades expandido** — Inclui correções de ISO-001 a ISO-006 e VULN-1/VULN-2

### AUDITORIA_TECNICA.md

1. **Risco de testes atualizado** — De "Sem testes automatizados" para "Testes automatizados limitados (68 backend, 8 frontend)"
2. **Pendências atualizadas** — "Testes automatizados" → "Cobertura completa de testes automatizados"

### RELATORIO_FINAL_AUDITORIA.md

1. **Risco de testes atualizado** — De "Sem testes automatizados" para "Cobertura de testes limitada"

### DIVERGENCIAS_DOCUMENTACAO.md

1. **Contagem de testes atualizada** — De "Backend: 19 testes" para "Backend: 68 testes"

### RELATORIO_TESTES_FUNCIONAIS_ETAPA3.md

1. **Contagem backend atualizada** — De "66 testes" para "68 testes"
2. **AI enhancer atualizado** — De "requer API key OpenAI" para "adiado — não faz parte do fluxo ativo"

---

## Estado atual dos testes

| Área | Resultado |
|------|-----------|
| Backend (Jest) | 68/68 PASS (11 suites) |
| Frontend (Vitest) | 8/8 PASS (2 suites) |
| Build Backend | PASS |
| Build Frontend | PASS |
| Lint Backend | PASS (0 errors) |
| Lint Frontend | 6 warnings (react-hooks/exhaustive-deps — não bloqueante) |

---

## IA

| Item | Status |
|------|--------|
| AI Insights | ADIADA (Etapa 6) |
| AI Enhancer | Não ativo (desconectado do módulo) |
| OpenAI | Não necessária para funcionamento normal |
| OPENAI_API_KEY | Opcional/Futura (comentada no .env.example) |
| Smart Scheduler | Ativo e baseado em regras/heurísticas locais |
| Dashboard | Indicadores existentes preservados |

---

## Segurança

As correções ISO-001 a ISO-006 e VULN-1/VULN-2 da Etapa 5.1 estão concluídas e documentadas:

- ISO-001: `assertNoEventConflict` filtra por churchId ✅
- ISO-002: Cron de reminders processa igrejas individualmente ✅
- ISO-003: `assertNoTimeConflict` filtra por churchId ✅
- ISO-004: Duplicate reminder check inclui churchId ✅
- ISO-005: `getEventOrThrow` usa `findFirst` com churchId ✅
- ISO-006: Ministry lookup usa `findFirst` com churchId ✅
- VULN-1: `notifySwapAutoCompletedToLeader` usa `findFirst` com churchId ✅
- VULN-2: `updateFeedbackStatus` valida churchId ✅

---

## Alterações de código

**Nenhuma alteração de código foi realizada nesta etapa.**

Apenas documentos foram modificados para refletir o estado atual do projeto.

---

## Resultado final

A documentação está consistente com o estado atual do projeto após a Etapa 6.

Principais inconsistências corrigidas:
1. Afirmação de "sem testes automatizados" removida de 3 documentos
2. Contagens de testes atualizadas (66→68 backend) em 3 documentos
3. Smart Scheduler documentado como baseado em regras, não IA
4. Endpoints de segurança atualizados para refletir correções da Etapa 5.1
5. AI Enhancer documentado como adiado/não ativo

Inconsistências que permanecem (documentação histórica preservada):
- Relatórios de etapas anteriores (Etapa 3, 4, 5) mantêm informações históricas
- AUDITORIA_TECNICA.md mantém informações de auditoria original (com ressalva adicionada)
