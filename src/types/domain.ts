export type UserProfile =
  | "MASTER_PLATFORM_ADMIN"
  | "MASTER_ADMIN"
  | "ADMIN"
  | "VOLUNTARIO";
export type UserStatus = "PENDENTE" | "ATIVO" | "INATIVO";

export type ScheduleStatus = "CONFIRMADO" | "PENDENTE" | "CANCELADO";
export type SwapRequestStatus =
  | "PENDENTE"
  | "APROVADO"
  | "RECUSADO"
  | "CANCELADO";

export type NotificationType =
  | "SCALE_CREATED"
  | "REMINDER"
  | "SWAP_REQUEST"
  | "SWAP_APPROVED"
  | "SWAP_DECLINED"
  | "SCALE_CANCELLED"
  | "USER_APPROVED"
  | "USER_REJECTED"
  | "NEW_VOLUNTEER_PENDING";

export type AttendanceStatus =
  | "CONFIRMADO"
  | "PRESENTE"
  | "ATRASADO"
  | "AUSENTE"
  | "JUSTIFICADO";

export type AbsenceRisk = "BAIXO" | "MEDIO" | "ALTO";

export type EventItem = {
  id: string;
  nome: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  recorrencia: string | null;
  createdAt: string;
};

export type MinistryItem = {
  id: string;
  nome: string;
  descricao: string;
  leaderId: string | null;
};

export type UserItem = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  foto: string | null;
  perfil: UserProfile;
  status: UserStatus;
  ativo: boolean;
  churchId?: string | null;
  church?: {
    id: string;
    nome: string;
    slug: string;
  } | null;
  createdAt: string;
};

export type ChurchSettingsItem = {
  id: string;
  churchId: string;
  customChurchName: string | null;
  customPlatformName: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  defaultEmailFrom: string | null;
  approvalPolicy: "MANUAL" | "AUTO";
  reminderLeadMinutes: number;
  swapRules: Record<string, unknown> | null;
  defaultServiceDays: unknown;
  scoreRules: Record<string, unknown> | null;
  customDomain: string | null;
};

export type ChurchSubscriptionItem = {
  id: string;
  churchId: string;
  planName: string;
  status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  trialEndsAt: string | null;
  maxUsers: number | null;
  maxMinistries: number | null;
  maxEventsPerMonth: number | null;
  billingEmail: string | null;
};

export type ChurchItem = {
  id: string;
  nome: string;
  slug: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  logo: string | null;
  responsavelPrincipal: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  settings?: ChurchSettingsItem | null;
  subscription?: ChurchSubscriptionItem | null;
  _count?: {
    users: number;
    ministries: number;
    events: number;
    schedules: number;
  };
};

export type ScheduleItem = {
  id: string;
  eventId: string;
  ministryId: string;
  volunteerId: string;
  status: ScheduleStatus;
  createdAt: string;
  updatedAt: string;
  event: EventItem;
  ministry: MinistryItem;
  volunteer: UserItem;
};

export type SwapRequestItem = {
  id: string;
  requesterShiftId: string;
  requesterId: string;
  requestedShiftId: string;
  requestedVolunteerId: string;
  status: SwapRequestStatus;
  createdAt: string;
  requesterShift: ScheduleItem;
  requestedShift: ScheduleItem;
  requester: UserItem;
  requestedVolunteer: UserItem;
};

export type NotificationItem = {
  id: string;
  userId: string;
  titulo: string;
  mensagem: string;
  tipo: NotificationType;
  lida: boolean;
  createdAt: string;
};

export type AttendanceItem = {
  id: string;
  scheduleId: string;
  volunteerId: string;
  status: AttendanceStatus | null;
  note: string | null;
  confirmedAt: string | null;
  checkedInAt: string | null;
  markedById: string | null;
  createdAt: string;
  updatedAt: string;
  schedule: ScheduleItem;
};

export type AuditLogItem = {
  id: string;
  userId: string | null;
  action: string;
  module: string;
  targetId: string | null;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
  user: {
    id: string;
    nome: string;
    email: string;
    perfil: UserProfile;
  } | null;
};

export type VolunteerReportRow = {
  volunteerId: string;
  volunteerName: string;
  ministryName: string;
  totalSchedules: number;
  confirmed: number;
  present: number;
  late: number;
  absent: number;
  justified: number;
  attendanceRate: number;
  operationalScore: number;
};

export type MinistryReportRow = {
  ministryId: string;
  ministryName: string;
  totalSchedules: number;
  confirmed: number;
  present: number;
  late: number;
  absent: number;
  justified: number;
  attendanceRate: number;
  operationalScore: number;
};

export type MonthlyRankingRow = {
  month: string;
  volunteerId: string;
  volunteerName: string;
  ministryName: string;
  totalSchedules: number;
  present: number;
  late: number;
  absent: number;
  operationalScore: number;
};

export type AttendanceExceptionRow = {
  volunteerId: string;
  volunteerName: string;
  ministryName: string;
  absent: number;
  late: number;
  justified: number;
  latestEventDate: string | null;
  riskLevel: "BAIXO" | "MEDIO" | "ALTO";
};

export type EventScheduleRow = {
  eventId: string;
  eventName: string;
  eventDate: string;
  totalSchedules: number;
  completedSchedules: number;
  confirmed: number;
  present: number;
  late: number;
  absent: number;
};

export type InactiveVolunteerRow = {
  volunteerId: string;
  volunteerName: string;
  email: string;
  totalSchedules: number;
  lastEventDate: string | null;
  status: "SEM_ESCALA" | "SEM_PRESENCA";
};

export type CancelledScheduleRow = {
  scheduleId: string;
  volunteerName: string;
  ministryName: string;
  eventName: string;
  eventDate: string;
  cancelledAt: string;
};

export type ReportsOverviewResponse = {
  filters: {
    from?: string;
    to?: string;
    ministryId?: string;
    volunteerId?: string;
  };
  totals: {
    schedules: number;
    volunteers: number;
    ministries: number;
    confirmed: number;
    present: number;
    late: number;
    absent: number;
    justified: number;
    cancelledSchedules: number;
    attendanceRate: number;
  };
  frequencyByVolunteer: VolunteerReportRow[];
  frequencyByMinistry: MinistryReportRow[];
  monthlyRanking: MonthlyRankingRow[];
  attendanceExceptions: AttendanceExceptionRow[];
  completedSchedules: EventScheduleRow[];
  mostActiveVolunteers: VolunteerReportRow[];
  inactiveVolunteers: InactiveVolunteerRow[];
  cancelledSchedules: CancelledScheduleRow[];
};

export type SmartVolunteerInsight = {
  volunteerId: string;
  nome: string;
  email: string;
  score: number;
  riscoAusencia: AbsenceRisk;
  scoreBreakdown: {
    presencas: number;
    faltas: number;
    bonusFrequencia: number;
    bonusPontualidade: number;
  };
  stats: {
    escalasConfirmadas: number;
    escalasPendentes: number;
    escalasCanceladas: number;
    escalasRecentes: number;
    trocasCanceladasRecentes: number;
    trocasRecusadasRecentes: number;
    conflitosDetectados: number;
  };
  reasons: string[];
};

export type ManualSmartSuggestions = {
  event: {
    id: string;
    nome: string;
    dataInicio: string;
    dataFim: string;
  };
  ministry: {
    id: string;
    nome: string;
  };
  suggestions: SmartVolunteerInsight[];
  generatedAt: string;
};

export type SmartSchedulerInsights = {
  event: {
    id: string;
    nome: string;
    dataInicio: string;
    dataFim: string;
  };
  ranking: SmartVolunteerInsight[];
  suggestionsByMinistry: Array<{
    ministry: {
      id: string;
      nome: string;
    };
    suggestions: SmartVolunteerInsight[];
  }>;
  alerts: {
    riscoAusencia: {
      baixo: number;
      medio: number;
      alto: number;
    };
    sobrecarga: Array<{
      volunteerId: string;
      nome: string;
      escalasRecentes: number;
    }>;
    poucoEscalados: Array<{
      volunteerId: string;
      nome: string;
      escalasRecentes: number;
    }>;
  };
  insights: {
    local: string[];
    ai: string | null;
  };
  generatedAt: string;
};

export type SmartSchedulerGeneration = {
  event: {
    id: string;
    nome: string;
    dataInicio: string;
    dataFim: string;
  };
  slotsPerMinistry: number;
  createdCount: number;
  createdSchedules: Array<{
    id: string;
    eventId: string;
    ministryId: string;
    volunteerId: string;
    status: ScheduleStatus;
    volunteerName: string;
    ministryName: string;
  }>;
  recommendations: Array<{
    ministry: {
      id: string;
      nome: string;
    };
    suggestions: SmartVolunteerInsight[];
  }>;
  warnings: string[];
  generatedAt: string;
};

export type EngagementStatus = "ALTO" | "MODERADO" | "BAIXO" | "CRITICO";

export type AvailabilityDayOfWeek =
  | "SEGUNDA"
  | "TERCA"
  | "QUARTA"
  | "QUINTA"
  | "SEXTA"
  | "SABADO"
  | "DOMINGO";

export type AvailabilityPeriod = "MANHA" | "TARDE" | "NOITE";

export type AvailabilityPreference =
  | "DISPONIVEL"
  | "INDISPONIVEL"
  | "PREFERENCIAL";

export type MinistryPreferenceType = "PREFERENCIAL" | "INDISPONIVEL";

export type VolunteerAvailabilityItem = {
  id: string;
  volunteerId: string;
  dayOfWeek: AvailabilityDayOfWeek;
  period: AvailabilityPeriod;
  preference: AvailabilityPreference;
  createdAt: string;
  updatedAt: string;
};

export type BlockedDateItem = {
  id: string;
  volunteerId: string;
  date: string;
  reason: string;
  createdAt: string;
};

export type MinistryPreferenceItem = {
  id: string;
  volunteerId: string;
  ministryId: string;
  type: MinistryPreferenceType;
  createdAt: string;
};

export type RankingItem = {
  rank: number;
  volunteerId: string;
  nome: string;
  email: string;
  ministerios: string[];
  scoreGeral: number;
  escalasCumpridas: number;
  frequenciaMensal: number;
  taxaConfirmacao: number;
  historicoFaltas: number;
  statusEngajamento: EngagementStatus;
  badges: string[];
  riscoAusencia: AbsenceRisk;
  escalasRecentes: number;
};

export type RankingResponse = {
  ranking: RankingItem[];
  totalVoluntarios: number;
  myPosition: RankingItem | null;
  generatedAt: string;
};

export type AdminExecutiveDashboard = {
  kpis: {
    totalVoluntariosAtivos: number;
    escalasDoMes: number;
    solicitacoesPendentes: number;
  };
  ministriesAtivas: Array<{
    ministerio: string;
    atividade: number;
  }>;
  alertas: {
    riscoAusencia: RankingItem[];
    sobrecarregados: RankingItem[];
    poucoEscalados: RankingItem[];
  };
  rankingGeral: RankingItem[];
  insightsIa: {
    evento: {
      id: string;
      nome: string;
      dataInicio: string;
      dataFim: string;
    } | null;
    local: string[];
    ai: string | null;
  };
  graficos: {
    frequenciaPorMes: Array<{
      mes: string;
      valor: number;
    }>;
    presencaPorMinisterio: Array<{
      ministerio: string;
      confirmado: number;
      cancelado: number;
    }>;
    distribuicaoEscalas: {
      confirmado: number;
      pendente: number;
      cancelado: number;
    };
    evolucaoScore: Array<{
      volunteerId: string;
      nome: string;
      pontos: Array<{
        mes: string;
        valor: number;
      }>;
    }>;
  };
  generatedAt: string;
};

export type VolunteerExecutiveDashboard = {
  proximaEscala: {
    id: string;
    status: ScheduleStatus;
    event: {
      id: string;
      nome: string;
      dataInicio: string;
      dataFim: string;
    };
    ministry: {
      id: string;
      nome: string;
    };
  } | null;
  historicoRecente: Array<{
    id: string;
    status: ScheduleStatus;
    event: {
      id: string;
      nome: string;
      dataInicio: string;
      dataFim: string;
    };
    ministry: {
      id: string;
      nome: string;
    };
  }>;
  scorePessoal: RankingItem;
  badgeAtual: string;
  rankingPessoal: {
    posicao: number;
    total: number;
  };
  frequenciaMensal: number;
  sugestoesIa: string[];
  graficos: {
    frequenciaPorMes: Array<{
      mes: string;
      valor: number;
    }>;
    presencaPorMinisterio: Array<{
      ministerio: string;
      confirmado: number;
      cancelado: number;
    }>;
    distribuicaoEscalas: {
      confirmado: number;
      pendente: number;
      cancelado: number;
    };
    evolucaoScore: Array<{
      mes: string;
      valor: number;
    }>;
  };
  generatedAt: string;
};

export type CreateEventPayload = {
++ insert before
export type StrategicAlertType =
  | "RISCO_ALTO"
  | "DEFICIT"
  | "SOBRECARGA"
  | "EVASAO"
  | "POSITIVO";

export type MinistryHealthItem = {
  id: string;
  nome: string;
  memberCount: number;
  leaderId: string | null;
  leaderName: string | null;
  schedules: number;
  confirmed: number;
  absent: number;
  swaps: number;
  attendanceRate: number;
  swapRate: number;
  healthScore: number;
  riskLevel: "BAIXO" | "MEDIO" | "ALTO";
};

export type PredictiveAlert = {
  type: StrategicAlertType;
  titulo: string;
  descricao: string;
  ministryId?: string;
  ministryNome?: string;
};

export type StrategicDashboard = {
  kpis: {
    operationalHealth: number;
    totalActiveVolunteers: number;
    retentionRate: number;
    overallAttendanceRate: number;
    newThisMonth: number;
    growthDelta: number;
    pendingApprovals: number;
    totalMinistries: number;
    avgMinistryHealth: number;
  };
  ministryHealth: MinistryHealthItem[];
  predictiveAlerts: PredictiveAlert[];
  overloadedLeaders: Array<{
    leaderId: string;
    nome: string;
    escalasGerenciadas: number;
  }>;
  crescimentoMensal: Array<{ mes: string; novos: number }>;
  frequenciaMensal: Array<{
    mes: string;
    escaladas: number;
    confirmadas: number;
  }>;
  recommendations: string[];
  generatedAt: string;
};

  nome: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  recorrencia?: string;
};

export type UpdateEventPayload = Partial<CreateEventPayload>;

export type CreateSchedulePayload = {
  eventId: string;
  ministryId: string;
  volunteerId: string;
  status?: ScheduleStatus;
};

export type UpdateSchedulePayload = Partial<CreateSchedulePayload>;

export type SchedulesFilters = {
  eventId?: string;
  ministryId?: string;
  volunteerId?: string;
};

export type CreateSwapRequestPayload = {
  requesterShiftId: string;
  requestedShiftId: string;
  requestedVolunteerId: string;
};

export type SaveAvailabilityPayload = {
  slots: Array<{
    dayOfWeek: AvailabilityDayOfWeek;
    period: AvailabilityPeriod;
    preference: AvailabilityPreference;
  }>;
};

export type SaveMinistryPreferencesPayload = {
  preferredMinistryIds: string[];
  unavailableMinistryIds: string[];
};
