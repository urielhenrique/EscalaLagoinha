# Decisão sobre IA

## Status

ADIADA

## Motivo

A aplicação não utilizará APIs de IA neste momento devido ao custo operacional associado a tokens/API.

## Funcionalidades adiadas

- AI Insights (análise textual por IA)
- AI Enhancer (geração de insights via OpenAI)
- Qualquer funcionalidade explicitamente dependente de API de IA

## Funcionalidades mantidas

- Métricas atuais do Dashboard (KPIs, gráficos, ranking)
- Relatórios
- Ranking de voluntários
- Smart Scheduler (geração automática de escalas baseada em regras)
- Sugestões de voluntários (heurística local)
- Notificações
- Demais funcionalidades existentes

## Dependência

A aplicação deve funcionar normalmente sem `OPENAI_API_KEY`.

Nenhum fluxo crítico (login, cadastro, escalas, notificações, relatórios) depende de IA.

## Arquivo de referência

O arquivo `smart-scheduler.ai-enhancer.service.ts` foi mantido no backend como referência futura, mas não é importado por nenhum módulo. Pode ser reativado quando a integração de IA for reavaliada.

## Futuro

A integração de IA poderá ser reavaliada posteriormente quando:
- O custo de tokens/API for compatível com o orçamento
- A funcionalidade agregar valor mensurável à operação
- Houver demanda dos usuários por insights automatizados
