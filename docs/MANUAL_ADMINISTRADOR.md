# Manual do Administrador — Escala Fácil

## Igreja Batista Lagoinha Jardim Atlântico

---

## 1. Visão Geral

Este manual é para **administradores** (MASTER_ADMIN e ADMIN) do sistema Escala Fácil. Ele cobre todas as funcionalidades de gerenciamento disponíveis para seu perfil.

### Hierarquia de Perfis

| Perfil | Descrição |
|--------|-----------|
| **MASTER_PLATFORM_ADMIN** | Administrador da plataforma SaaS. Gerencia todas as igrejas. |
| **MASTER_ADMIN** | Administrador master da igreja. Acesso total dentro da igreja. |
| **ADMIN / Líder** | Administrador ou líder de ministério. Gerencia escalas e voluntários. |
| **VOLUNTÁRIO** | Voluntário comum. Consulta escalas e gerencia disponibilidade. |

---

## 2. Gerenciamento de Líderes (MASTER_ADMIN)

### Criar Novo Líder/Administrador

1. Acesse **Master Admin** no menu lateral
2. Clique em **"Novo Usuário"** ou **"Criar Líder"**
3. Preencha os dados:
   - Nome completo
   - E-mail
   - Telefone
   - Perfil: **ADMIN** ou **MASTER_ADMIN**
   - Senha
4. Confirme a criação

**O sistema enviará automaticamente:**
- E-mail de boas-vindas ao novo líder
- Notificação para outros MASTER_ADMINs da igreja

### Alterar Perfil de um Usuário

1. Acesse **Master Admin**
2. Localize o usuário na lista
3. Clique em **"Editar"** ou no ícone de edição
4. Altere o perfil (ADMIN, MASTER_ADMIN ou VOLUNTÁRIO)
5. Confirme a alteração

**Restrições:**
- Você não pode remover seu próprio perfil de MASTER_ADMIN
- Apenas MASTER_PLATFORM_ADMIN pode conceder perfil MASTER_PLATFORM_ADMIN

### Desativar Usuário

1. Acesse **Master Admin**
2. Localize o usuário
3. Clique em **"Desativar"**
4. Confirme a ação

**O usuário desativado:**
- Não conseguirá mais fazer login
- Permanece no sistema (não é removido)
- Pode ser reativado posteriormente

---

## 3. Aprovação de Voluntários

### Visualizar Voluntários Pendentes

1. Acesse **Aprovação de Voluntários** no menu lateral
2. Veja a lista de voluntários aguardando aprovação
3. Para cada voluntário, veja:
   - Nome
   - E-mail
   - Telefone
   - Data do cadastro

### Aprovar Voluntário

1. Na lista de pendentes, localize o voluntário
2. Clique em **"Aprovar"**
3. Confirme a ação

**O voluntário receberá:**
- E-mail de confirmação da aprovação
- Notificação in-app
- Acesso ao sistema

### Rejeitar Voluntário

1. Na lista de pendentes, localize o voluntário
2. Clique em **"Rejeitar"**
3. Confirme a ação

**O voluntário receberá:**
- E-mail de notificação da rejeição
- Notificação in-app
- Sua conta será desativada

---

## 4. Gerenciamento de Ministérios

### Ministérios Padrão (Seed)

O sistema já possui 5 ministérios pré-configurados:
- **Foto**
- **Vídeo**
- **Projeção**
- **Iluminação**
- **Transmissão**

### Criar Novo Ministério

1. Acesse **Ministérios** no menu lateral
2. Clique em **"Novo Ministério"**
3. Preencha:
   - Nome
   - Descrição
   - Líder responsável (selecione um ADMIN ou MASTER_ADMIN)
4. Confirme

### Editar Ministério

1. Localize o ministério na lista
2. Clique em **"Editar"**
3. Altere os dados necessários
4. Confirme

### Associar Voluntários ao Ministério

1. Ao editar o ministério
2. Selecione os voluntários que farão parte
3. Confirme

---

## 5. Criação de Escalas

### Criar Nova Escala

1. Acesse **Gestão de Escalas** no menu lateral
2. Clique em **"Nova Escala"**
3. Preencha:
   - **Evento** — Selecione o evento (Culto, Ensaio, etc.)
   - **Ministério** — Selecione o ministério
   - **Voluntário** — Selecione o voluntário
   - **Status** — PENDENTE ou CONFIRMADO
4. Confirme

**O sistema verificará automaticamente:**
- Se o voluntário está ativo
- Se o voluntário está disponível na data do evento
- Se não há conflito de horário
- Se o voluntário não marcou o ministério como indisponível

**O voluntário receberá:**
- Notificação in-app
- E-mail de notificação

### Edição de Escala

1. Localize a escala na lista
2. Clique em **"Editar"**
3. Altere os campos necessários (evento, ministério, voluntário, status)
4. Confirme

**O sistema revalidará:**
- Disponibilidade do voluntário
- Conflitos de horário
- Regras de atribuição

### Cancelamento de Escala

1. Localize a escala
2. Clique em **"Cancelar"**
3. Confirme

**O voluntário receberá:**
- Notificação de cancelamento
- E-mail de notificação

---

## 6. Visualização de Escalas

### Filtros Disponíveis

- **Evento** — Filtrar por evento específico
- **Ministério** — Filtrar por ministério
- **Voluntário** — Filtrar por voluntário (apenas para ADMIN/MASTER_ADMIN)

### Informações Exibidas

Para cada escala:
- Evento (nome, data, hora)
- Ministério
- Voluntário (nome, e-mail)
- Status (Pendente, Confirmado, Cancelado)

---

## 7. Conflitos de Escala

### Verificação Automática

O sistema verifica automaticamente:
- **Conflito de horário** — Voluntário já escalado para evento no mesmo período
- **Indisponibilidade** — Voluntário marcou data como bloqueada
- **Preferência de ministério** — Voluntário marcou ministério como indisponível
- **Disponibilidade semanal** — Voluntário não está disponível no dia/período

### Como Resolver Conflitos

1. Identifique o conflito na mensagem de erro
2. Opções:
   - Escolha outro voluntário
   - Verifique a disponibilidade do voluntário
   - Remova o bloqueio de data (se aplicável)
   - Altere o horário do evento

---

## 8. Trocas de Escala

### Fluxo de Troca

1. **Voluntário solicita** — Seleciona sua escala e a escala de destino
2. **Voluntário de destino avalia** — Aprova ou recusa
3. **Sistema executa** — Troca os voluntários nas escalas
4. **Notificações** — Todos são notificados

### Regras de Troca

- Mesmo ministério
- Sem conflito de horário para ambos
- Ambos disponíveis nas novas datas
- Sem auto-troca
- Escalas não canceladas

### Aprovação/Rejeição

Os líderes e administradores podem visualizar todas as trocas pendentes:
1. Acesse **Trocas > Recebidas** (como voluntário) ou **Gestão de Escalas** (como admin)
2. Revise os detalhes da troca
3. Aprova ou rejeita

---

## 9. Notificações

### Notificações Automáticas

O sistema envia notificações automaticamente para:
- Novo voluntário pendente de aprovação
- Voluntário aprovado/rejeitado
- Nova escala criada
- Lembrete de escala (24h antes, configurável)
- Solicitação de troca recebida
- Troca aprovada/recusada
- Escala cancelada
- Novo líder criado

### Notificações In-App

- Acesse **Notificações** no menu lateral
- Visualize todas as notificações
- Marque como lidas individualmente ou todas de uma vez

---

## 10. Relatórios

### Acesso

1. Acesse **Relatórios** no menu lateral
2. Selecione o tipo de relatório
3. Configure filtros (período, ministério, voluntário)
4. Visualize ou exporte

### Tipos de Relatório

- **Visão Geral** — Resumo de escalas, voluntários, ministérios
- **Presença** — Registro de presença dos voluntários
- **Ranking** — Ranking de voluntários por performance
- **Exportação** — CSV, Excel (XLSX) ou PDF

---

## 11. Auditoria

### Acesso

1. Acesse **Auditoria** no menu lateral (apenas MASTER_ADMIN)
2. Visualize todas as ações realizadas no sistema

### Informações Registradas

- Usuário que realizou a ação
- Tipo de ação (criação, edição, exclusão, aprovação, etc.)
- Módulo afetado
- Dados anteriores e novos
- Data e hora

---

## 12. Configurações da Igreja

### Acesso (apenas MASTER_ADMIN)

1. Acesse **Igreja > Configurações**
2. Altere as configurações necessárias

### Configurações Disponíveis

- **Nome da igreja** — Nome exibido no sistema
- **Política de aprovação** — MANUAL (aprovacao manual) ou AUTO (aprovacao automatica)
- **Lembrete antecedência** — Minutos antes do evento para enviar lembrete
- **Cores** — Cores primária, secundária e destaque
- **Logo** — URL da logo da igreja

---

## 13. Boas Práticas

### Para Criação de Escalas

1. **Planeje com antecedência** — Crie escalas com pelo menos 1-2 semanas de antecedência
2. **Verifique a disponibilidade** — Consulte a disponibilidade dos voluntários antes de criar escalas
3. **Alterne voluntários** — Evite sobrecarregar sempre os mesmos voluntários
4. **Confirme antes do evento** — Marque as escalas como "Confirmado" próximo ao evento

### Para Aprovação de Voluntários

1. **Aprovação rápida** — Voluntários pendentes ficam sem acesso ao sistema
2. **Verifique o cadastro** — Confirme dados antes de aprovar
3. **Comunique-se** — Informe o voluntário sobre a aprovação ou rejeição

### Para Gerenciamento

1. **Mantenha dados atualizados** — telefone, e-mail, perfil dos voluntários
2. **Revise regularmente** — Acesse relatórios e ranking periodicamente
3. **Use a auditoria** — Monitore ações realizadas no sistema
4. **Capacite líderes** — Ensure que todos os ADMINs conhecem o sistema

---

## 14. Contato / Suporte

Em caso de dúvidas ou problemas técnicos:

- **Suporte técnico** — Contato do desenvolvedor do sistema
- **Documentação** — Este manual e a Central de Ajuda do sistema
- **Banco de dados** — Em último caso, entre em contato com o suporte técnico
