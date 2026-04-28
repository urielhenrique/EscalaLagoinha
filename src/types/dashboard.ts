export type MenuItem = {
  key: string;
  label: string;
  path: string;
  icon:
    | "dashboard"
    | "minha-escala"
    | "minha-disponibilidade"
    | "gestao-escalas"
    | "aprovacao-voluntarios"
    | "master-admin"
    | "eventos"
    | "solicitar-troca"
    | "minhas-solicitacoes"
    | "solicitacoes-recebidas"
    | "historico-trocas"
    | "notificacoes"
    | "ranking"
    | "ia-insights"
    | "check-in"
    | "presenca"
    | "auditoria"
    | "relatorios"
    | "igrejas"
    | "config-igreja"
    | "branding"
    | "multi-unidade";
  allowedProfiles?: Array<
    "MASTER_PLATFORM_ADMIN" | "MASTER_ADMIN" | "ADMIN" | "VOLUNTARIO"
  >;
};

export type DashboardCard = {
  id: string;
  titulo: string;
  valor: string;
  descricao: string;
  detalhe: string;
  icone:
    | "proximaEscala"
    | "voluntariosHoje"
    | "proximosEventos"
    | "solicitacoes";
};
