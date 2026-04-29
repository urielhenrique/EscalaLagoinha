import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Perfil,
  ScheduleStatus,
  SwapRequestStatus,
  type Event,
  type Ministry,
  type User,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SmartSchedulerAiEnhancerService } from "./smart-scheduler.ai-enhancer.service";

type AbsenceRisk = "BAIXO" | "MEDIO" | "ALTO";
type EngagementStatus = "ALTO" | "MODERADO" | "BAIXO" | "CRITICO";

type VolunteerScoreInput = {
  volunteer: Pick<User, "id" | "nome" | "email">;
  confirmedCount: number;
  cancelledCount: number;
  recentAssignments: number;
  pendingCount: number;
  recentSwapCancels: number;
  recentSwapRejects: number;
  conflictCount: number;
};

type VolunteerInsight = {
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

type MinistrySuggestion = {
  ministry: {
    id: string;
    nome: string;
  };
  suggestions: VolunteerInsight[];
};

type RankingItem = {
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

type RankingComputed = {
  ranking: RankingItem;
  insight: VolunteerInsight;
  monthlyConfirmed: Map<string, number>;
  monthlyAssigned: Map<string, number>;
  monthlyScore: Map<string, number>;
  byMinistry: Map<string, { confirmado: number; cancelado: number }>;
};

type VolunteerAccumulator = {
  volunteer: {
    id: string;
    nome: string;
    email: string;
    ministerios: string[];
  };
  confirmed: number;
  cancelled: number;
  pending: number;
  monthConfirmed: number;
  monthAssigned: number;
  recentAssignments: number;
  swapCancelsRecent: number;
  swapRejectsRecent: number;
  monthlyConfirmed: Map<string, number>;
  monthlyAssigned: Map<string, number>;
  monthlyScore: Map<string, number>;
  byMinistry: Map<string, { confirmado: number; cancelado: number }>;
};

@Injectable()
export class SmartSchedulerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiEnhancerService: SmartSchedulerAiEnhancerService,
  ) {}

  private getRangeStart(days: number) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  private getMonthStart(reference = new Date()) {
    return new Date(reference.getFullYear(), reference.getMonth(), 1, 0, 0, 0);
  }

  private getMonthEnd(reference = new Date()) {
    return new Date(
      reference.getFullYear(),
      reference.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
  }

  private getMonthKey(date: Date) {
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    return `${date.getFullYear()}-${month}`;
  }

  private parseMonthKey(key: string) {
    const [yearStr, monthStr] = key.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    return new Date(year, month - 1, 1);
  }

  private formatMonthLabel(monthKey: string) {
    const date = this.parseMonthKey(monthKey);
    return date.toLocaleDateString("pt-BR", {
      month: "short",
      year: "2-digit",
    });
  }

  private getLastMonthKeys(count: number, reference = new Date()) {
    const keys: string[] = [];
    const base = new Date(reference.getFullYear(), reference.getMonth(), 1);

    for (let index = count - 1; index >= 0; index -= 1) {
      const date = new Date(base);
      date.setMonth(base.getMonth() - index);
      keys.push(this.getMonthKey(date));
    }

    return keys;
  }

  private incMap(map: Map<string, number>, key: string, delta = 1) {
    map.set(key, (map.get(key) ?? 0) + delta);
  }

  private computeFrequencyBonus(recentAssignments: number): number {
    if (recentAssignments === 0) {
      return 3;
    }

    if (recentAssignments <= 2) {
      return 2;
    }

    if (recentAssignments <= 4) {
      return 1;
    }

    return 0;
  }

  private computePunctualityBonus(
    confirmedCount: number,
    faltas: number,
  ): number {
    const base = confirmedCount + faltas;
    if (base === 0) {
      return 0;
    }

    const ratio = confirmedCount / base;

    if (ratio >= 0.9) {
      return 3;
    }

    if (ratio >= 0.75) {
      return 2;
    }

    if (ratio >= 0.6) {
      return 1;
    }

    return 0;
  }

  private computeRisk(params: {
    faltas: number;
    recentAssignments: number;
    cancelSignals: number;
  }): AbsenceRisk {
    if (params.faltas >= 5 || params.cancelSignals >= 3) {
      return "ALTO";
    }

    if (params.faltas >= 2 || params.cancelSignals >= 1) {
      return "MEDIO";
    }

    if (params.recentAssignments === 0) {
      return "MEDIO";
    }

    return "BAIXO";
  }

  private buildReasons(input: {
    risk: AbsenceRisk;
    recentAssignments: number;
    confirmedCount: number;
    faltas: number;
  }) {
    const reasons: string[] = [];

    if (input.risk === "ALTO") {
      reasons.push("Historico recente com risco alto de ausencia.");
    } else if (input.risk === "MEDIO") {
      reasons.push("Risco moderado com base no comportamento recente.");
    } else {
      reasons.push("Historico estavel de participacao.");
    }

    if (input.recentAssignments >= 5) {
      reasons.push("Carga recente alta, considerar rodizio.");
    }

    if (input.recentAssignments === 0) {
      reasons.push("Pouco escalado recentemente: oportunidade de equilibrio.");
    }

    if (input.confirmedCount >= 6 && input.faltas <= 1) {
      reasons.push("Boa consistencia nas ultimas escalas.");
    }

    return reasons;
  }

  private scoreVolunteer(input: VolunteerScoreInput): VolunteerInsight {
    const faltas =
      input.cancelledCount +
      input.recentSwapCancels +
      Math.floor(input.recentSwapRejects / 2);

    const bonusFrequencia = this.computeFrequencyBonus(input.recentAssignments);
    const bonusPontualidade = this.computePunctualityBonus(
      input.confirmedCount,
      faltas,
    );

    const fairnessPenalty = Math.max(0, input.recentAssignments - 4);

    const score =
      input.confirmedCount * 2 -
      faltas +
      bonusFrequencia +
      bonusPontualidade -
      fairnessPenalty -
      input.conflictCount;

    const riscoAusencia = this.computeRisk({
      faltas,
      recentAssignments: input.recentAssignments,
      cancelSignals: input.recentSwapCancels + input.cancelledCount,
    });

    return {
      volunteerId: input.volunteer.id,
      nome: input.volunteer.nome,
      email: input.volunteer.email,
      score,
      riscoAusencia,
      scoreBreakdown: {
        presencas: input.confirmedCount,
        faltas,
        bonusFrequencia,
        bonusPontualidade,
      },
      stats: {
        escalasConfirmadas: input.confirmedCount,
        escalasPendentes: input.pendingCount,
        escalasCanceladas: input.cancelledCount,
        escalasRecentes: input.recentAssignments,
        trocasCanceladasRecentes: input.recentSwapCancels,
        trocasRecusadasRecentes: input.recentSwapRejects,
        conflitosDetectados: input.conflictCount,
      },
      reasons: this.buildReasons({
        risk: riscoAusencia,
        recentAssignments: input.recentAssignments,
        confirmedCount: input.confirmedCount,
        faltas,
      }),
    };
  }

  private getEngagementStatus(params: {
    score: number;
    taxaConfirmacao: number;
    risco: AbsenceRisk;
  }): EngagementStatus {
    if (params.risco === "ALTO" || params.taxaConfirmacao < 55) {
      return "CRITICO";
    }

    if (params.score >= 24 && params.taxaConfirmacao >= 85) {
      return "ALTO";
    }

    if (params.score >= 12 && params.taxaConfirmacao >= 65) {
      return "MODERADO";
    }

    return "BAIXO";
  }

  private getBadges(params: {
    rank: number;
    taxaConfirmacao: number;
    faltas: number;
    escalasRecentes: number;
    score: number;
  }) {
    const badges: string[] = [];

    if (params.taxaConfirmacao >= 85 && params.score >= 16) {
      badges.push("🔥 Fiel");
    }

    if (params.taxaConfirmacao >= 92 && params.faltas <= 1) {
      badges.push("🕐 Pontual");
    }

    if (params.escalasRecentes >= 4) {
      badges.push("💪 Ativo");
    }

    if (params.rank <= 3) {
      badges.push("⭐ Destaque do mes");
    }

    if (params.taxaConfirmacao < 60 || params.faltas >= 4) {
      badges.push("⚠️ Precisa melhorar");
    }

    return badges;
  }

  private async getEventOrThrow(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException("Evento nao encontrado.");
    }

    return event;
  }

  private async getTargetMinistries(event: Event, ministryIds?: string[]) {
    if (ministryIds?.length) {
      const ministries = await this.prisma.ministry.findMany({
        where: { id: { in: ministryIds } },
        orderBy: { nome: "asc" },
      });

      if (ministries.length !== ministryIds.length) {
        throw new BadRequestException(
          "Um ou mais ministerios informados nao foram encontrados.",
        );
      }

      return ministries;
    }

    const linkedMinistries = await this.prisma.ministry.findMany({
      where: {
        schedules: {
          some: {
            event: {
              OR: [
                {
                  dataInicio: {
                    gte: this.getRangeStart(180),
                  },
                },
                { id: event.id },
              ],
            },
          },
        },
      },
      orderBy: { nome: "asc" },
    });

    if (linkedMinistries.length > 0) {
      return linkedMinistries;
    }

    return this.prisma.ministry.findMany({ orderBy: { nome: "asc" } });
  }

  private async buildVolunteerInsightsForMinistry(params: {
    ministry: Ministry;
    event: Event;
    limit?: number;
  }): Promise<VolunteerInsight[]> {
    const recentWindow = this.getRangeStart(120);

    const members = await this.prisma.user.findMany({
      where: {
        ativo: true,
        perfil: Perfil.VOLUNTARIO,
        ministries: {
          some: { id: params.ministry.id },
        },
      },
      select: {
        id: true,
        nome: true,
        email: true,
      },
      orderBy: { nome: "asc" },
    });

    if (members.length === 0) {
      return [];
    }

    const memberIds = members.map((member) => member.id);

    const [schedules, swapRequests] = await Promise.all([
      this.prisma.schedule.findMany({
        where: {
          volunteerId: { in: memberIds },
        },
        select: {
          volunteerId: true,
          status: true,
          event: {
            select: {
              dataInicio: true,
              dataFim: true,
            },
          },
        },
      }),
      this.prisma.swapRequest.findMany({
        where: {
          OR: [
            { requesterId: { in: memberIds } },
            { requestedVolunteerId: { in: memberIds } },
          ],
          createdAt: { gte: recentWindow },
        },
        select: {
          requesterId: true,
          requestedVolunteerId: true,
          status: true,
        },
      }),
    ]);

    const byVolunteer = new Map<string, VolunteerScoreInput>();

    for (const member of members) {
      byVolunteer.set(member.id, {
        volunteer: member,
        confirmedCount: 0,
        cancelledCount: 0,
        recentAssignments: 0,
        pendingCount: 0,
        recentSwapCancels: 0,
        recentSwapRejects: 0,
        conflictCount: 0,
      });
    }

    for (const schedule of schedules) {
      const row = byVolunteer.get(schedule.volunteerId);
      if (!row) {
        continue;
      }

      if (schedule.status === ScheduleStatus.CONFIRMADO) {
        row.confirmedCount += 1;
      }

      if (schedule.status === ScheduleStatus.PENDENTE) {
        row.pendingCount += 1;
      }

      if (schedule.status === ScheduleStatus.CANCELADO) {
        row.cancelledCount += 1;
      }

      if (schedule.event.dataInicio >= recentWindow) {
        row.recentAssignments += 1;
      }

      const hasConflict =
        schedule.status !== ScheduleStatus.CANCELADO &&
        schedule.event.dataInicio < params.event.dataFim &&
        schedule.event.dataFim > params.event.dataInicio;

      if (hasConflict) {
        row.conflictCount += 1;
      }
    }

    for (const request of swapRequests) {
      const requester = byVolunteer.get(request.requesterId);
      if (requester && request.status === SwapRequestStatus.CANCELADO) {
        requester.recentSwapCancels += 1;
      }

      const requested = byVolunteer.get(request.requestedVolunteerId);
      if (requested && request.status === SwapRequestStatus.RECUSADO) {
        requested.recentSwapRejects += 1;
      }
    }

    const ranked = Array.from(byVolunteer.values())
      .map((row) => this.scoreVolunteer(row))
      .filter((row) => row.stats.conflitosDetectados === 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        if (a.riscoAusencia !== b.riscoAusencia) {
          const riskWeight: Record<AbsenceRisk, number> = {
            BAIXO: 0,
            MEDIO: 1,
            ALTO: 2,
          };

          return riskWeight[a.riscoAusencia] - riskWeight[b.riscoAusencia];
        }

        return a.nome.localeCompare(b.nome, "pt-BR");
      });

    if (params.limit) {
      return ranked.slice(0, params.limit);
    }

    return ranked;
  }

  private async buildRankingDataset() {
    const recentWindow = this.getRangeStart(120);
    const recentActivityWindow = this.getRangeStart(90);
    const monthStart = this.getMonthStart();
    const monthEnd = this.getMonthEnd();

    const volunteers = await this.prisma.user.findMany({
      where: {
        ativo: true,
        perfil: Perfil.VOLUNTARIO,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        ministries: {
          select: {
            nome: true,
          },
        },
      },
      orderBy: { nome: "asc" },
    });

    if (volunteers.length === 0) {
      return [] as RankingComputed[];
    }

    const volunteerIds = volunteers.map((volunteer) => volunteer.id);

    const [schedules, swapRequests] = await Promise.all([
      this.prisma.schedule.findMany({
        where: {
          volunteerId: { in: volunteerIds },
        },
        select: {
          volunteerId: true,
          status: true,
          event: {
            select: {
              dataInicio: true,
            },
          },
          ministry: {
            select: {
              nome: true,
            },
          },
        },
      }),
      this.prisma.swapRequest.findMany({
        where: {
          OR: [
            { requesterId: { in: volunteerIds } },
            { requestedVolunteerId: { in: volunteerIds } },
          ],
          createdAt: { gte: recentWindow },
        },
        select: {
          requesterId: true,
          requestedVolunteerId: true,
          status: true,
        },
      }),
    ]);

    const bucket = new Map<string, VolunteerAccumulator>();

    for (const volunteer of volunteers) {
      bucket.set(volunteer.id, {
        volunteer: {
          id: volunteer.id,
          nome: volunteer.nome,
          email: volunteer.email,
          ministerios: volunteer.ministries.map((item) => item.nome),
        },
        confirmed: 0,
        cancelled: 0,
        pending: 0,
        monthConfirmed: 0,
        monthAssigned: 0,
        recentAssignments: 0,
        swapCancelsRecent: 0,
        swapRejectsRecent: 0,
        monthlyConfirmed: new Map<string, number>(),
        monthlyAssigned: new Map<string, number>(),
        monthlyScore: new Map<string, number>(),
        byMinistry: new Map<
          string,
          { confirmado: number; cancelado: number }
        >(),
      });
    }

    for (const schedule of schedules) {
      const row = bucket.get(schedule.volunteerId);
      if (!row) {
        continue;
      }

      const monthKey = this.getMonthKey(schedule.event.dataInicio);

      if (schedule.status === ScheduleStatus.CONFIRMADO) {
        row.confirmed += 1;
        this.incMap(row.monthlyConfirmed, monthKey, 1);
        this.incMap(row.monthlyScore, monthKey, 2);
      }

      if (schedule.status === ScheduleStatus.CANCELADO) {
        row.cancelled += 1;
        this.incMap(row.monthlyScore, monthKey, -1);
      }

      if (schedule.status === ScheduleStatus.PENDENTE) {
        row.pending += 1;
      }

      if (schedule.status !== ScheduleStatus.CANCELADO) {
        this.incMap(row.monthlyAssigned, monthKey, 1);
      }

      if (
        schedule.event.dataInicio >= monthStart &&
        schedule.event.dataInicio <= monthEnd &&
        schedule.status !== ScheduleStatus.CANCELADO
      ) {
        row.monthAssigned += 1;
      }

      if (
        schedule.event.dataInicio >= monthStart &&
        schedule.event.dataInicio <= monthEnd &&
        schedule.status === ScheduleStatus.CONFIRMADO
      ) {
        row.monthConfirmed += 1;
      }

      if (
        schedule.event.dataInicio >= recentActivityWindow &&
        schedule.status !== ScheduleStatus.CANCELADO
      ) {
        row.recentAssignments += 1;
      }

      const ministryPresence = row.byMinistry.get(schedule.ministry.nome) ?? {
        confirmado: 0,
        cancelado: 0,
      };

      if (schedule.status === ScheduleStatus.CONFIRMADO) {
        ministryPresence.confirmado += 1;
      }

      if (schedule.status === ScheduleStatus.CANCELADO) {
        ministryPresence.cancelado += 1;
      }

      row.byMinistry.set(schedule.ministry.nome, ministryPresence);
    }

    for (const request of swapRequests) {
      const requester = bucket.get(request.requesterId);
      if (requester && request.status === SwapRequestStatus.CANCELADO) {
        requester.swapCancelsRecent += 1;
      }

      const requested = bucket.get(request.requestedVolunteerId);
      if (requested && request.status === SwapRequestStatus.RECUSADO) {
        requested.swapRejectsRecent += 1;
      }
    }

    const computed = Array.from(bucket.values()).map((row) => {
      const insight = this.scoreVolunteer({
        volunteer: {
          id: row.volunteer.id,
          nome: row.volunteer.nome,
          email: row.volunteer.email,
        },
        confirmedCount: row.confirmed,
        cancelledCount: row.cancelled,
        pendingCount: row.pending,
        recentAssignments: row.recentAssignments,
        recentSwapCancels: row.swapCancelsRecent,
        recentSwapRejects: row.swapRejectsRecent,
        conflictCount: 0,
      });

      const confirmationBase = row.confirmed + row.cancelled;
      const taxaConfirmacao =
        confirmationBase > 0
          ? Number(((row.confirmed / confirmationBase) * 100).toFixed(1))
          : 0;

      const frequenciaMensal =
        row.monthAssigned > 0
          ? Number(((row.monthConfirmed / row.monthAssigned) * 100).toFixed(1))
          : 0;

      return {
        ranking: {
          rank: 0,
          volunteerId: row.volunteer.id,
          nome: row.volunteer.nome,
          email: row.volunteer.email,
          ministerios: row.volunteer.ministerios,
          scoreGeral: insight.score,
          escalasCumpridas: row.confirmed,
          frequenciaMensal,
          taxaConfirmacao,
          historicoFaltas: insight.scoreBreakdown.faltas,
          statusEngajamento: this.getEngagementStatus({
            score: insight.score,
            taxaConfirmacao,
            risco: insight.riscoAusencia,
          }),
          badges: [] as string[],
          riscoAusencia: insight.riscoAusencia,
          escalasRecentes: row.recentAssignments,
        },
        insight,
        monthlyConfirmed: row.monthlyConfirmed,
        monthlyAssigned: row.monthlyAssigned,
        monthlyScore: row.monthlyScore,
        byMinistry: row.byMinistry,
      };
    });

    computed.sort((a, b) => {
      if (b.ranking.scoreGeral !== a.ranking.scoreGeral) {
        return b.ranking.scoreGeral - a.ranking.scoreGeral;
      }

      if (b.ranking.taxaConfirmacao !== a.ranking.taxaConfirmacao) {
        return b.ranking.taxaConfirmacao - a.ranking.taxaConfirmacao;
      }

      return a.ranking.nome.localeCompare(b.ranking.nome, "pt-BR");
    });

    computed.forEach((item, index) => {
      item.ranking.rank = index + 1;
      item.ranking.badges = this.getBadges({
        rank: item.ranking.rank,
        taxaConfirmacao: item.ranking.taxaConfirmacao,
        faltas: item.ranking.historicoFaltas,
        escalasRecentes: item.ranking.escalasRecentes,
        score: item.ranking.scoreGeral,
      });
    });

    return computed;
  }

  async getRanking(params?: { limit?: number; viewerId?: string }) {
    const ranking = await this.buildRankingDataset();
    const limit = params?.limit ? Math.max(1, Math.min(50, params.limit)) : 30;

    const items = ranking.slice(0, limit).map((item) => item.ranking);
    const myPosition = params?.viewerId
      ? ranking.find((item) => item.ranking.volunteerId === params.viewerId)
      : undefined;

    return {
      ranking: items,
      totalVoluntarios: ranking.length,
      myPosition: myPosition?.ranking ?? null,
      generatedAt: new Date(),
    };
  }

  async getAdminExecutiveDashboard() {
    const rankingComputed = await this.buildRankingDataset();
    const ranking = rankingComputed.map((item) => item.ranking);

    const monthStart = this.getMonthStart();
    const monthEnd = this.getMonthEnd();

    const [monthSchedules, pendingSwaps, upcomingEvent] = await Promise.all([
      this.prisma.schedule.findMany({
        where: {
          event: {
            dataInicio: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
        },
        select: {
          status: true,
          ministry: { select: { nome: true } },
        },
      }),
      this.prisma.swapRequest.count({
        where: { status: SwapRequestStatus.PENDENTE },
      }),
      this.prisma.event.findFirst({
        where: {
          dataInicio: { gte: new Date() },
        },
        orderBy: { dataInicio: "asc" },
        select: { id: true, nome: true },
      }),
    ]);

    const ministriesActivityMap = new Map<string, number>();
    const distribution = {
      confirmado: 0,
      pendente: 0,
      cancelado: 0,
    };

    for (const schedule of monthSchedules) {
      if (schedule.status === ScheduleStatus.CONFIRMADO) {
        distribution.confirmado += 1;
        ministriesActivityMap.set(
          schedule.ministry.nome,
          (ministriesActivityMap.get(schedule.ministry.nome) ?? 0) + 2,
        );
      }

      if (schedule.status === ScheduleStatus.PENDENTE) {
        distribution.pendente += 1;
        ministriesActivityMap.set(
          schedule.ministry.nome,
          (ministriesActivityMap.get(schedule.ministry.nome) ?? 0) + 1,
        );
      }

      if (schedule.status === ScheduleStatus.CANCELADO) {
        distribution.cancelado += 1;
      }
    }

    const ministriesAtivas = Array.from(ministriesActivityMap.entries())
      .map(([ministerio, atividade]) => ({ ministerio, atividade }))
      .sort((a, b) => b.atividade - a.atividade)
      .slice(0, 6);

    const riskHigh = ranking.filter((row) => row.riscoAusencia === "ALTO");
    const overloaded = ranking.filter((row) => row.escalasRecentes >= 5);
    const underutilized = ranking.filter((row) => row.escalasRecentes <= 1);

    const monthKeys = this.getLastMonthKeys(6);

    const frequenciaPorMes = monthKeys.map((monthKey) => ({
      mes: this.formatMonthLabel(monthKey),
      valor: rankingComputed.reduce(
        (sum, row) => sum + (row.monthlyConfirmed.get(monthKey) ?? 0),
        0,
      ),
    }));

    const presencaPorMinisterioMap = new Map<
      string,
      { confirmado: number; cancelado: number }
    >();

    for (const row of rankingComputed) {
      for (const [ministerio, values] of row.byMinistry.entries()) {
        const current = presencaPorMinisterioMap.get(ministerio) ?? {
          confirmado: 0,
          cancelado: 0,
        };

        current.confirmado += values.confirmado;
        current.cancelado += values.cancelado;

        presencaPorMinisterioMap.set(ministerio, current);
      }
    }

    const presencaPorMinisterio = Array.from(presencaPorMinisterioMap.entries())
      .map(([ministerio, values]) => ({
        ministerio,
        confirmado: values.confirmado,
        cancelado: values.cancelado,
      }))
      .sort((a, b) => b.confirmado - a.confirmado)
      .slice(0, 8);

    const evolucaoScore = rankingComputed.slice(0, 5).map((row) => ({
      volunteerId: row.ranking.volunteerId,
      nome: row.ranking.nome,
      pontos: monthKeys.map((monthKey) => ({
        mes: this.formatMonthLabel(monthKey),
        valor: row.monthlyScore.get(monthKey) ?? 0,
      })),
    }));

    const insightsAi = upcomingEvent
      ? await this.getInsights(upcomingEvent.id)
      : null;

    return {
      kpis: {
        totalVoluntariosAtivos: ranking.length,
        escalasDoMes: monthSchedules.length,
        solicitacoesPendentes: pendingSwaps,
      },
      ministriesAtivas,
      alertas: {
        riscoAusencia: riskHigh.slice(0, 8),
        sobrecarregados: overloaded.slice(0, 8),
        poucoEscalados: underutilized.slice(0, 8),
      },
      rankingGeral: ranking.slice(0, 12),
      insightsIa: insightsAi
        ? {
            evento: insightsAi.event,
            local: insightsAi.insights.local,
            ai: insightsAi.insights.ai,
          }
        : {
            evento: null,
            local: [
              "Sem evento futuro para gerar insight contextual de IA no momento.",
            ],
            ai: null,
          },
      graficos: {
        frequenciaPorMes,
        presencaPorMinisterio,
        distribuicaoEscalas: distribution,
        evolucaoScore,
      },
      generatedAt: new Date(),
    };
  }

  async getVolunteerDashboard(volunteerId: string) {
    const rankingComputed = await this.buildRankingDataset();
    const current = rankingComputed.find(
      (item) => item.ranking.volunteerId === volunteerId,
    );

    if (!current) {
      throw new NotFoundException("Voluntario nao encontrado no ranking.");
    }

    const [nextSchedule, history] = await Promise.all([
      this.prisma.schedule.findFirst({
        where: {
          volunteerId,
          status: { in: [ScheduleStatus.CONFIRMADO, ScheduleStatus.PENDENTE] },
          event: {
            dataInicio: { gte: new Date() },
          },
        },
        orderBy: { event: { dataInicio: "asc" } },
        select: {
          id: true,
          status: true,
          event: {
            select: {
              id: true,
              nome: true,
              dataInicio: true,
              dataFim: true,
            },
          },
          ministry: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
      }),
      this.prisma.schedule.findMany({
        where: { volunteerId },
        orderBy: [{ event: { dataInicio: "desc" } }],
        take: 8,
        select: {
          id: true,
          status: true,
          event: {
            select: {
              id: true,
              nome: true,
              dataInicio: true,
              dataFim: true,
            },
          },
          ministry: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
      }),
    ]);

    const monthKeys = this.getLastMonthKeys(6);

    const frequenciaPorMes = monthKeys.map((monthKey) => {
      const confirmed = current.monthlyConfirmed.get(monthKey) ?? 0;
      const assigned = current.monthlyAssigned.get(monthKey) ?? 0;
      return {
        mes: this.formatMonthLabel(monthKey),
        valor:
          assigned > 0 ? Number(((confirmed / assigned) * 100).toFixed(1)) : 0,
      };
    });

    const evolucaoScore = monthKeys.map((monthKey) => ({
      mes: this.formatMonthLabel(monthKey),
      valor: current.monthlyScore.get(monthKey) ?? 0,
    }));

    const presencaPorMinisterio = Array.from(current.byMinistry.entries())
      .map(([ministerio, values]) => ({
        ministerio,
        confirmado: values.confirmado,
        cancelado: values.cancelado,
      }))
      .sort((a, b) => b.confirmado - a.confirmado);

    const rankingList = rankingComputed.map((item) => item.ranking);
    const total = rankingList.length;

    const suggestions: string[] = [];

    if (current.ranking.rank <= 10) {
      suggestions.push("Voce esta entre os 10 mais ativos da igreja.");
    }

    if (current.ranking.riscoAusencia === "ALTO") {
      suggestions.push(
        "Seu risco de ausencia esta alto. Confirme escalas com antecedencia.",
      );
    }

    if (current.ranking.escalasRecentes >= 5) {
      suggestions.push(
        "Sua carga recente esta elevada. Avalie trocas planejadas para equilibrar.",
      );
    }

    if (current.ranking.escalasRecentes <= 1) {
      suggestions.push(
        "Voce foi pouco escalado recentemente. Fale com seu lider para ampliar participacao.",
      );
    }

    if (suggestions.length === 0) {
      suggestions.push(
        "Excelente equilibrio! Mantenha seu ritmo e consistencia.",
      );
    }

    const badgeAtual = current.ranking.badges[0] ?? "⚠️ Precisa melhorar";

    return {
      proximaEscala: nextSchedule,
      historicoRecente: history,
      scorePessoal: current.ranking,
      badgeAtual,
      rankingPessoal: {
        posicao: current.ranking.rank,
        total,
      },
      frequenciaMensal: current.ranking.frequenciaMensal,
      sugestoesIa: suggestions,
      graficos: {
        frequenciaPorMes,
        presencaPorMinisterio,
        distribuicaoEscalas: {
          confirmado: current.insight.stats.escalasConfirmadas,
          pendente: current.insight.stats.escalasPendentes,
          cancelado: current.insight.stats.escalasCanceladas,
        },
        evolucaoScore,
      },
      generatedAt: new Date(),
    };
  }

  async getManualSuggestions(params: {
    eventId: string;
    ministryId: string;
    limit?: number;
  }) {
    const [event, ministry] = await Promise.all([
      this.getEventOrThrow(params.eventId),
      this.prisma.ministry.findUnique({ where: { id: params.ministryId } }),
    ]);

    if (!ministry) {
      throw new NotFoundException("Ministerio nao encontrado.");
    }

    const suggestions = await this.buildVolunteerInsightsForMinistry({
      event,
      ministry,
      limit: params.limit ?? 5,
    });

    return {
      event: {
        id: event.id,
        nome: event.nome,
        dataInicio: event.dataInicio,
        dataFim: event.dataFim,
      },
      ministry: {
        id: ministry.id,
        nome: ministry.nome,
      },
      suggestions,
      generatedAt: new Date(),
    };
  }

  async generateSmartSchedule(params: {
    eventId: string;
    ministryIds?: string[];
    slotsPerMinistry?: number;
  }) {
    const slotsPerMinistry = params.slotsPerMinistry ?? 1;
    const event = await this.getEventOrThrow(params.eventId);
    const ministries = await this.getTargetMinistries(
      event,
      params.ministryIds,
    );

    const recommendations: MinistrySuggestion[] = [];
    const createdSchedules: Array<{
      id: string;
      eventId: string;
      ministryId: string;
      volunteerId: string;
      status: ScheduleStatus;
      volunteerName: string;
      ministryName: string;
    }> = [];
    const warnings: string[] = [];

    for (const ministry of ministries) {
      const suggestions = await this.buildVolunteerInsightsForMinistry({
        event,
        ministry,
        limit: Math.max(6, slotsPerMinistry * 2),
      });

      recommendations.push({
        ministry: { id: ministry.id, nome: ministry.nome },
        suggestions,
      });

      if (suggestions.length === 0) {
        warnings.push(
          `Sem candidatos aptos para ${ministry.nome} no evento ${event.nome}.`,
        );
        continue;
      }

      const existing = await this.prisma.schedule.findMany({
        where: {
          eventId: event.id,
          ministryId: ministry.id,
          status: { in: [ScheduleStatus.CONFIRMADO, ScheduleStatus.PENDENTE] },
        },
        select: { volunteerId: true },
      });

      const alreadySelected = new Set(existing.map((row) => row.volunteerId));
      let missingSlots = Math.max(0, slotsPerMinistry - alreadySelected.size);

      for (const candidate of suggestions) {
        if (missingSlots <= 0) {
          break;
        }

        if (alreadySelected.has(candidate.volunteerId)) {
          continue;
        }

        const created = await this.prisma.schedule.create({
          data: {
            eventId: event.id,
            ministryId: ministry.id,
            volunteerId: candidate.volunteerId,
            status: ScheduleStatus.PENDENTE,
          },
          select: {
            id: true,
            eventId: true,
            ministryId: true,
            volunteerId: true,
            status: true,
          },
        });

        createdSchedules.push({
          ...created,
          volunteerName: candidate.nome,
          ministryName: ministry.nome,
        });

        alreadySelected.add(candidate.volunteerId);
        missingSlots -= 1;
      }

      if (missingSlots > 0) {
        warnings.push(
          `Ministerio ${ministry.nome} ficou com ${missingSlots} vaga(s) sem preenchimento automatico.`,
        );
      }
    }

    return {
      event: {
        id: event.id,
        nome: event.nome,
        dataInicio: event.dataInicio,
        dataFim: event.dataFim,
      },
      slotsPerMinistry,
      createdCount: createdSchedules.length,
      createdSchedules,
      recommendations,
      warnings,
      generatedAt: new Date(),
    };
  }

  async getInsights(eventId: string) {
    const event = await this.getEventOrThrow(eventId);
    const ministries = await this.getTargetMinistries(event);

    const ministrySuggestions: MinistrySuggestion[] = [];
    const globalRanking: VolunteerInsight[] = [];
    const uniqueVolunteerMap = new Map<string, VolunteerInsight>();

    for (const ministry of ministries) {
      const suggestions = await this.buildVolunteerInsightsForMinistry({
        event,
        ministry,
        limit: 7,
      });

      ministrySuggestions.push({
        ministry: { id: ministry.id, nome: ministry.nome },
        suggestions,
      });

      for (const suggestion of suggestions) {
        const current = uniqueVolunteerMap.get(suggestion.volunteerId);
        if (!current || suggestion.score > current.score) {
          uniqueVolunteerMap.set(suggestion.volunteerId, suggestion);
        }
      }
    }

    globalRanking.push(...uniqueVolunteerMap.values());
    globalRanking.sort((a, b) => b.score - a.score);

    const highRisk = globalRanking.filter(
      (row) => row.riscoAusencia === "ALTO",
    );
    const mediumRisk = globalRanking.filter(
      (row) => row.riscoAusencia === "MEDIO",
    );
    const overloaded = globalRanking.filter(
      (row) => row.stats.escalasRecentes >= 5,
    );
    const underutilized = globalRanking.filter(
      (row) => row.stats.escalasRecentes === 0,
    );

    const localInsights = [
      highRisk.length > 0
        ? `${highRisk.length} voluntario(s) com risco ALTO de ausencia.`
        : "Nenhum voluntario em risco ALTO de ausencia.",
      overloaded.length > 0
        ? `${overloaded.length} voluntario(s) com potencial sobrecarga.`
        : "Carga equilibrada entre voluntarios com historico recente.",
      underutilized.length > 0
        ? `${underutilized.length} voluntario(s) pouco escalados para promover equilibrio.`
        : "Sem voluntarios subutilizados no recorte analisado.",
    ];

    const aiInsights =
      await this.aiEnhancerService.generateAdministrativeInsights({
        eventName: event.nome,
        ministryNames: ministries.map((ministry) => ministry.nome),
        highRiskCount: highRisk.length,
        overloadedCount: overloaded.length,
        underutilizedCount: underutilized.length,
      });

    return {
      event: {
        id: event.id,
        nome: event.nome,
        dataInicio: event.dataInicio,
        dataFim: event.dataFim,
      },
      ranking: globalRanking,
      suggestionsByMinistry: ministrySuggestions,
      alerts: {
        riscoAusencia: {
          baixo: globalRanking.length - highRisk.length - mediumRisk.length,
          medio: mediumRisk.length,
          alto: highRisk.length,
        },
        sobrecarga: overloaded.map((row) => ({
          volunteerId: row.volunteerId,
          nome: row.nome,
          escalasRecentes: row.stats.escalasRecentes,
        })),
        poucoEscalados: underutilized.map((row) => ({
          volunteerId: row.volunteerId,
          nome: row.nome,
          escalasRecentes: row.stats.escalasRecentes,
        })),
      },
      insights: {
        local: localInsights,
        ai: aiInsights,
      },
      generatedAt: new Date(),
    };
  }

  // ─── ETAPA 18 — Dashboard Estratégico ────────────────────────────────────

  async getStrategicDashboard(churchId?: string) {
    const now = new Date();
    const monthStart = this.getMonthStart(now);
    const prevMonthStart = this.getMonthStart(
      new Date(now.getFullYear(), now.getMonth() - 1, 1),
    );
    const prevMonthEnd = new Date(monthStart.getTime() - 1);
    const ninetyDaysAgo = this.getRangeStart(90);
    const sixtyDaysAgo = this.getRangeStart(60);
    const monthKeys = this.getLastMonthKeys(6);

    const churchFilter = churchId ? { churchId } : {};

    // ── Dados brutos paralelos ──────────────────────────────────────────────
    const [
      totalActiveVolunteers,
      newThisMonth,
      newLastMonth,
      ministries,
      recentSchedules,
      recentSwaps,
      pendingCount,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { ...churchFilter, ativo: true, perfil: Perfil.VOLUNTARIO },
      }),
      this.prisma.user.count({
        where: {
          ...churchFilter,
          perfil: Perfil.VOLUNTARIO,
          createdAt: { gte: monthStart },
        },
      }),
      this.prisma.user.count({
        where: {
          ...churchFilter,
          perfil: Perfil.VOLUNTARIO,
          createdAt: { gte: prevMonthStart, lte: prevMonthEnd },
        },
      }),
      this.prisma.ministry.findMany({
        where: { ...churchFilter },
        select: {
          id: true,
          nome: true,
          leaderId: true,
          leader: { select: { id: true, nome: true } },
          _count: { select: { members: true } },
        },
      }),
      this.prisma.schedule.findMany({
        where: {
          ...churchFilter,
          event: { dataInicio: { gte: ninetyDaysAgo } },
        },
        select: {
          id: true,
          volunteerId: true,
          ministryId: true,
          status: true,
          createdAt: true,
          event: { select: { id: true, nome: true, dataInicio: true } },
          ministry: { select: { id: true, nome: true } },
          volunteer: { select: { id: true, nome: true } },
          attendance: { select: { status: true } },
        },
      }),
      this.prisma.swapRequest.findMany({
        where: { createdAt: { gte: ninetyDaysAgo } },
        select: {
          id: true,
          requesterId: true,
          status: true,
          createdAt: true,
          requesterShift: {
            select: { ministry: { select: { id: true, nome: true } } },
          },
        },
      }),
      this.prisma.user.count({
        where: { ...churchFilter, status: "PENDENTE" },
      }),
    ]);

    // ── KPIs de crescimento ─────────────────────────────────────────────────
    const growthDelta =
      totalActiveVolunteers > 0
        ? Math.round(
            ((newThisMonth - newLastMonth) / Math.max(1, newLastMonth)) * 100,
          )
        : 0;

    // ── Métricas de presença por ministério ─────────────────────────────────
    const ministryMetrics = new Map<
      string,
      {
        id: string;
        nome: string;
        memberCount: number;
        leaderId: string | null;
        leaderName: string | null;
        schedules: number;
        confirmed: number;
        absent: number;
        swaps: number;
      }
    >();

    for (const m of ministries) {
      ministryMetrics.set(m.id, {
        id: m.id,
        nome: m.nome,
        memberCount: m._count.members,
        leaderId: m.leaderId,
        leaderName: m.leader?.nome ?? null,
        schedules: 0,
        confirmed: 0,
        absent: 0,
        swaps: 0,
      });
    }

    for (const s of recentSchedules) {
      const mm = ministryMetrics.get(s.ministryId);
      if (!mm) continue;
      mm.schedules++;
      if (s.status === "CONFIRMADO") mm.confirmed++;
      if (s.attendance?.status === "AUSENTE") mm.absent++;
    }

    for (const sw of recentSwaps) {
      const ministryId = sw.requesterShift.ministry.id;
      const mm = ministryMetrics.get(ministryId);
      if (mm) mm.swaps++;
    }

    // ── Score de saúde por ministério ───────────────────────────────────────
    const ministryHealth = Array.from(ministryMetrics.values()).map((mm) => {
      const attendanceRate =
        mm.schedules > 0
          ? Math.round(((mm.schedules - mm.absent) / mm.schedules) * 100)
          : 100;
      const swapRate =
        mm.schedules > 0 ? Math.round((mm.swaps / mm.schedules) * 100) : 0;
      const memberScore = mm.memberCount >= 4 ? 100 : mm.memberCount * 25;

      const healthScore = Math.round(
        attendanceRate * 0.5 +
          memberScore * 0.3 +
          (100 - Math.min(swapRate, 100)) * 0.2,
      );

      const riskLevel: "BAIXO" | "MEDIO" | "ALTO" =
        healthScore >= 75 ? "BAIXO" : healthScore >= 50 ? "MEDIO" : "ALTO";

      return {
        ...mm,
        attendanceRate,
        swapRate,
        healthScore,
        riskLevel,
      };
    });

    ministryHealth.sort((a, b) => a.healthScore - b.healthScore);

    // ── Saúde operacional geral ─────────────────────────────────────────────
    const avgMinistryHealth =
      ministryHealth.length > 0
        ? Math.round(
            ministryHealth.reduce((sum, m) => sum + m.healthScore, 0) /
              ministryHealth.length,
          )
        : 0;

    const totalSchedules = recentSchedules.length;
    const confirmedSchedules = recentSchedules.filter(
      (s) => s.status === "CONFIRMADO",
    ).length;
    const overallAttendanceRate =
      totalSchedules > 0
        ? Math.round((confirmedSchedules / totalSchedules) * 100)
        : 0;

    const operationalHealth = Math.round(
      avgMinistryHealth * 0.4 +
        overallAttendanceRate * 0.4 +
        Math.min(
          100,
          (totalActiveVolunteers / Math.max(1, ministries.length * 3)) * 100,
        ) *
          0.2,
    );

    // ── Voluntários ativos nos últimos 60 dias (retenção) ───────────────────
    const activeVolunteerIds = new Set(
      recentSchedules
        .filter((s) => s.event.dataInicio >= sixtyDaysAgo)
        .map((s) => s.volunteerId),
    );
    const retentionRate =
      totalActiveVolunteers > 0
        ? Math.round((activeVolunteerIds.size / totalActiveVolunteers) * 100)
        : 0;

    // ── Alertas preditivos ──────────────────────────────────────────────────
    const predictiveAlerts: Array<{
      type: "RISCO_ALTO" | "DEFICIT" | "SOBRECARGA" | "EVASAO" | "POSITIVO";
      titulo: string;
      descricao: string;
      ministryId?: string;
      ministryNome?: string;
    }> = [];

    for (const mm of ministryHealth) {
      if (mm.memberCount < 3) {
        predictiveAlerts.push({
          type: "DEFICIT",
          titulo: `Déficit em ${mm.nome}`,
          descricao: `Apenas ${mm.memberCount} voluntário(s). Recomenda-se mínimo de 3 por ministério.`,
          ministryId: mm.id,
          ministryNome: mm.nome,
        });
      }
      if (mm.swapRate > 30) {
        predictiveAlerts.push({
          type: "EVASAO",
          titulo: `Alta rotatividade em ${mm.nome}`,
          descricao: `Taxa de trocas de ${mm.swapRate}%. Pode indicar desmotivação ou sobrecarga.`,
          ministryId: mm.id,
          ministryNome: mm.nome,
        });
      }
      if (mm.attendanceRate < 70) {
        predictiveAlerts.push({
          type: "RISCO_ALTO",
          titulo: `Baixa presença em ${mm.nome}`,
          descricao: `Taxa de presença de ${mm.attendanceRate}%. Requer atenção imediata.`,
          ministryId: mm.id,
          ministryNome: mm.nome,
        });
      }
    }

    // Líderes sobrecarregados
    const leaderScheduleMap = new Map<
      string,
      { nome: string; count: number }
    >();
    for (const s of recentSchedules) {
      const ministry = ministryMetrics.get(s.ministryId);
      if (!ministry?.leaderId) continue;
      const existing = leaderScheduleMap.get(ministry.leaderId) ?? {
        nome: ministry.leaderName ?? "Líder",
        count: 0,
      };
      existing.count++;
      leaderScheduleMap.set(ministry.leaderId, existing);
    }

    const overloadedLeaders = Array.from(leaderScheduleMap.entries())
      .filter(([, v]) => v.count >= 8)
      .map(([id, v]) => ({
        leaderId: id,
        nome: v.nome,
        escalasGerenciadas: v.count,
      }));

    for (const leader of overloadedLeaders) {
      predictiveAlerts.push({
        type: "SOBRECARGA",
        titulo: `Líder ${leader.nome} sobrecarregado`,
        descricao: `Gerenciando ${leader.escalasGerenciadas} escalas nos últimos 90 dias. Considere redistribuição.`,
      });
    }

    if (retentionRate >= 80) {
      predictiveAlerts.push({
        type: "POSITIVO",
        titulo: "Alta retenção de voluntários",
        descricao: `${retentionRate}% dos voluntários estiveram ativos nos últimos 60 dias. Excelente engajamento!`,
      });
    }

    if (pendingCount > 5) {
      predictiveAlerts.push({
        type: "RISCO_ALTO",
        titulo: `${pendingCount} voluntários aguardando aprovação`,
        descricao: `Aprovar novos membros aumenta o pool disponível e reduz déficits.`,
      });
    }

    // ── Crescimento mensal (séries temporais) ───────────────────────────────
    const monthlyGrowthRaw = await this.prisma.user.groupBy({
      by: ["createdAt"],
      where: {
        ...churchFilter,
        perfil: Perfil.VOLUNTARIO,
        createdAt: { gte: this.getRangeStart(180) },
      },
      _count: { createdAt: true },
    });

    const growthByMonth = new Map<string, number>();
    for (const row of monthlyGrowthRaw) {
      const key = this.getMonthKey(row.createdAt);
      growthByMonth.set(
        key,
        (growthByMonth.get(key) ?? 0) + row._count.createdAt,
      );
    }

    const crescimentoMensal = monthKeys.map((key) => ({
      mes: this.formatMonthLabel(key),
      novos: growthByMonth.get(key) ?? 0,
    }));

    // ── Frequência mensal consolidada ───────────────────────────────────────
    const scheduledByMonth = new Map<string, number>();
    const confirmedByMonth = new Map<string, number>();

    for (const s of recentSchedules) {
      const key = this.getMonthKey(s.event.dataInicio);
      this.incMap(scheduledByMonth, key);
      if (s.status === "CONFIRMADO") this.incMap(confirmedByMonth, key);
    }

    const frequenciaMensal = monthKeys.map((key) => ({
      mes: this.formatMonthLabel(key),
      escaladas: scheduledByMonth.get(key) ?? 0,
      confirmadas: confirmedByMonth.get(key) ?? 0,
    }));

    // ── Recomendações estratégicas ──────────────────────────────────────────
    const recommendations: string[] = [];

    const criticalMinistries = ministryHealth.filter(
      (m) => m.riskLevel === "ALTO",
    );
    if (criticalMinistries.length > 0) {
      recommendations.push(
        `Recrutar voluntários para: ${criticalMinistries.map((m) => m.nome).join(", ")}.`,
      );
    }

    if (growthDelta < 0) {
      recommendations.push(
        "Crescimento negativo este mês. Intensifique campanhas de recrutamento.",
      );
    }

    if (retentionRate < 60) {
      recommendations.push(
        "Retenção abaixo de 60%. Investir em reconhecimento e engajamento dos voluntários.",
      );
    }

    if (overloadedLeaders.length > 0) {
      recommendations.push(
        "Redistribuir lideranças para equilibrar a carga entre os líderes.",
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "Operação estável. Continue monitorando indicadores mensalmente.",
      );
    }

    return {
      kpis: {
        operationalHealth,
        totalActiveVolunteers,
        retentionRate,
        overallAttendanceRate,
        newThisMonth,
        growthDelta,
        pendingApprovals: pendingCount,
        totalMinistries: ministries.length,
        avgMinistryHealth,
      },
      ministryHealth,
      predictiveAlerts: predictiveAlerts.slice(0, 10),
      overloadedLeaders,
      crescimentoMensal,
      frequenciaMensal,
      recommendations,
      generatedAt: new Date(),
    };
  }
}
