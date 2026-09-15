import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, RecurrenceType } from "@prisma/client";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { GoogleCalendarSyncService } from "../integrations/google-calendar/google-calendar-sync.service";
import {
  CreateEventDto,
  RecurrenceConfigDto,
  RecurrenceTypeDto,
} from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";

const MAX_RECURRENCE_EVENTS = 52;

const DAY_MAP: Record<string, number> = {
  DOMINGO: 0,
  SEGUNDA: 1,
  TERCA: 2,
  QUARTA: 3,
  QUINTA: 4,
  SEXTA: 5,
  SABADO: 6,
};

const eventSelect = {
  id: true,
  churchId: true,
  nome: true,
  descricao: true,
  dataInicio: true,
  dataFim: true,
  recorrencia: true,
  recurrenceGroupId: true,
  recurrenceType: true,
  recurrenceDays: true,
  recurrenceStart: true,
  recurrenceEnd: true,
  recurrenceIndex: true,
  createdAt: true,
  googleEventId: true,
  googleSyncStatus: true,
  lastSyncedAt: true,
  googleSyncError: true,
} as const;

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleCalendarSyncService: GoogleCalendarSyncService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private getChurchIdOrThrow(actor: JwtPayload) {
    if (!actor.churchId) {
      throw new ForbiddenException(
        "Acesso negado: usuário sem igreja vinculada.",
      );
    }

    return actor.churchId;
  }

  private validateDateRange(dataInicio: Date, dataFim: Date) {
    if (dataFim <= dataInicio) {
      throw new BadRequestException(
        "A dataFim precisa ser maior que a dataInicio.",
      );
    }
  }

  private async assertNoTimeConflict(
    dataInicio: Date,
    dataFim: Date,
    churchId: string,
    excludeEventId?: string,
  ) {
    const where: Prisma.EventWhereInput = {
      churchId,
      dataInicio: { lt: dataFim },
      dataFim: { gt: dataInicio },
    };

    if (excludeEventId) {
      where.id = { not: excludeEventId };
    }

    const conflicts = await this.prisma.event.findMany({
      where,
      select: { id: true, nome: true, dataInicio: true, dataFim: true },
    });

    if (conflicts.length > 0) {
      const conflict = conflicts[0];
      throw new BadRequestException(
        `Conflito de horário com o evento "${conflict.nome}" (${conflict.dataInicio.toISOString()} — ${conflict.dataFim.toISOString()}).`,
      );
    }
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getUTCFullYear() === b.getUTCFullYear() &&
      a.getUTCMonth() === b.getUTCMonth() &&
      a.getUTCDate() === b.getUTCDate()
    );
  }

  private validateRecurrenceConfig(config: RecurrenceConfigDto) {
    const startDate = new Date(config.startDate);
    const endDate = new Date(config.endDate);

    if (endDate < startDate) {
      throw new BadRequestException(
        "A data final da recorrência precisa ser maior ou igual à data inicial.",
      );
    }

    if (config.type === RecurrenceTypeDto.WEEKLY) {
      if (!config.daysOfWeek || config.daysOfWeek.length === 0) {
        throw new BadRequestException(
          "É obrigatório informar pelo menos um dia da semana para recorrência semanal.",
        );
      }

      for (const day of config.daysOfWeek) {
        if (!(day in DAY_MAP)) {
          throw new BadRequestException(
            `Dia da semana inválido: ${day}. Use: DOMINGO, SEGUNDA, TERCA, QUARTA, QUINTA, SEXTA, SABADO.`,
          );
        }
      }
    }
  }

  private generateWeeklyOccurrences(
    config: RecurrenceConfigDto,
    baseEvent: { dataInicio: Date; dataFim: Date },
  ): Array<{ dataInicio: Date; dataFim: Date; recurrenceIndex: number }> {
    const startDate = new Date(config.startDate);
    const endDate = new Date(config.endDate);
    const duration = baseEvent.dataFim.getTime() - baseEvent.dataInicio.getTime();
    const dayNumbers = config.daysOfWeek.map((day) => DAY_MAP[day]);

    const occurrences: Array<{
      dataInicio: Date;
      dataFim: Date;
      recurrenceIndex: number;
    }> = [];

    const current = new Date(startDate);
    let index = 0;

    while (current.getTime() <= endDate.getTime()) {
      if (dayNumbers.includes(current.getUTCDay())) {
        const eventStart = new Date(current);
        eventStart.setUTCHours(
          baseEvent.dataInicio.getUTCHours(),
          baseEvent.dataInicio.getUTCMinutes(),
          baseEvent.dataInicio.getUTCSeconds(),
          0,
        );

        const eventEnd = new Date(eventStart.getTime() + duration);

        if (eventEnd.getTime() <= endDate.getTime() || this.isSameDay(eventEnd, endDate)) {
          occurrences.push({
            dataInicio: eventStart,
            dataFim: eventEnd,
            recurrenceIndex: index,
          });
          index++;
        }
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return occurrences;
  }

  private async autoSyncAllEventSchedules(
    eventId: string,
  ): Promise<void> {
    try {
      await this.googleCalendarSyncService.syncAllEventSchedules(eventId);
    } catch (error) {
      this.logger.error(
        `Auto-sync all schedules failed for event ${eventId}: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  private async autoUnlinkAllEventSchedules(
    eventId: string,
  ): Promise<void> {
    try {
      await this.googleCalendarSyncService.unlinkAllEventSchedules(eventId);
    } catch (error) {
      this.logger.error(
        `Auto-unlink all schedules failed for event ${eventId}: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  async create(dto: CreateEventDto, actor: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(actor);
    const dataInicio = new Date(dto.dataInicio);
    const dataFim = new Date(dto.dataFim);

    this.validateDateRange(dataInicio, dataFim);

    if (dto.recurrence) {
      this.validateRecurrenceConfig(dto.recurrence);

      const occurrences = this.generateWeeklyOccurrences(dto.recurrence, {
        dataInicio,
        dataFim,
      });

      if (occurrences.length === 0) {
        throw new BadRequestException(
          "Nenhuma ocorrência válida gerada para a configuração de recorrência informada.",
        );
      }

      if (occurrences.length > MAX_RECURRENCE_EVENTS) {
        throw new BadRequestException(
          `Período de recorrência excede o limite máximo de ${MAX_RECURRENCE_EVENTS} ocorrências.`,
        );
      }

      for (const occurrence of occurrences) {
        await this.assertNoTimeConflict(
          occurrence.dataInicio,
          occurrence.dataFim,
          churchId,
        );
      }

      const recurrenceGroupId = crypto.randomUUID();
      const recurrence = dto.recurrence;

      const createdEvents = await this.prisma.$transaction(async (tx) => {
        const events = [];

        for (const occurrence of occurrences) {
          const event = await tx.event.create({
            data: {
              churchId,
              nome: dto.nome,
              descricao: dto.descricao,
              dataInicio: occurrence.dataInicio,
              dataFim: occurrence.dataFim,
              recorrencia: dto.recorrencia,
              recurrenceGroupId,
              recurrenceType: RecurrenceType.WEEKLY,
              recurrenceDays: recurrence.daysOfWeek,
              recurrenceStart: new Date(recurrence.startDate),
              recurrenceEnd: new Date(recurrence.endDate),
              recurrenceIndex: occurrence.recurrenceIndex,
            },
            select: eventSelect,
          });

          events.push(event);
        }

        return events;
      });

      for (const event of createdEvents) {
        await this.autoSyncAllEventSchedules(event.id);
      }

      const syncedEvents = await this.prisma.event.findMany({
        where: { recurrenceGroupId },
        orderBy: { recurrenceIndex: "asc" },
        select: eventSelect,
      });

      return {
        recurrenceGroupId,
        totalEvents: syncedEvents.length,
        events: syncedEvents,
      };
    }

    await this.assertNoTimeConflict(dataInicio, dataFim, churchId);

    const created = await this.prisma.event.create({
      data: {
        churchId,
        nome: dto.nome,
        descricao: dto.descricao,
        dataInicio,
        dataFim,
        recorrencia: dto.recorrencia,
      },
      select: eventSelect,
    });

    await this.autoSyncAllEventSchedules(created.id);

    return this.prisma.event.findUnique({
      where: { id: created.id },
      select: eventSelect,
    });
  }

  async findAll(actor: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(actor);

    return this.prisma.event.findMany({
      where: { churchId },
      orderBy: { dataInicio: "asc" },
      select: eventSelect,
    });
  }

  async findById(id: string, actor: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(actor);

    const event = await this.prisma.event.findFirst({
      where: { id, churchId },
      select: eventSelect,
    });

    if (!event) {
      throw new NotFoundException("Evento não encontrado.");
    }

    return event;
  }

  async findByRecurrenceGroup(
    recurrenceGroupId: string,
    actor: JwtPayload,
  ) {
    const churchId = this.getChurchIdOrThrow(actor);

    return this.prisma.event.findMany({
      where: { recurrenceGroupId, churchId },
      orderBy: { recurrenceIndex: "asc" },
      select: eventSelect,
    });
  }

  async update(id: string, dto: UpdateEventDto, actor: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(actor);

    const existing = await this.prisma.event.findFirst({
      where: { id, churchId },
      select: {
        id: true,
        dataInicio: true,
        dataFim: true,
        recurrenceGroupId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException("Evento não encontrado.");
    }

    const dataInicio = dto.dataInicio
      ? new Date(dto.dataInicio)
      : existing.dataInicio;
    const dataFim = dto.dataFim ? new Date(dto.dataFim) : existing.dataFim;

    this.validateDateRange(dataInicio, dataFim);

    await this.assertNoTimeConflict(dataInicio, dataFim, churchId, id);

    await this.prisma.event.update({
      where: { id },
      data: {
        nome: dto.nome,
        descricao: dto.descricao,
        dataInicio: dto.dataInicio ? new Date(dto.dataInicio) : undefined,
        dataFim: dto.dataFim ? new Date(dto.dataFim) : undefined,
        recorrencia: dto.recorrencia,
      },
      select: eventSelect,
    });

    await this.autoSyncAllEventSchedules(id);

    return this.prisma.event.findUnique({
      where: { id },
      select: eventSelect,
    });
  }

  async remove(id: string, actor: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(actor);

    const exists = await this.prisma.event.findFirst({
      where: { id, churchId },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException("Evento não encontrado.");
    }

    await this.autoUnlinkAllEventSchedules(id);

    try {
      const deleted = await this.prisma.event.delete({
        where: { id },
        select: eventSelect,
      });

      return deleted;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        throw new BadRequestException(
          "Não foi possível excluir esta ocorrência porque existem escalas vinculadas a ela.",
        );
      }

      if (
        error instanceof Prisma.PrismaClientUnknownRequestError &&
        error.message.includes("23001")
      ) {
        throw new BadRequestException(
          "Não foi possível excluir esta ocorrência porque existem escalas vinculadas a ela.",
        );
      }

      throw error;
    }
  }

  async syncEventToGoogle(eventId: string, actor: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(actor);

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, churchId },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException("Evento não encontrado.");
    }

    await this.googleCalendarSyncService.syncAllEventSchedules(event.id);

    const statuses =
      await this.googleCalendarSyncService.getEventSyncStatuses(event.id);

    await this.auditLogsService.log({
      userId: actor.sub,
      churchId: actor.churchId,
      action: "GOOGLE_CALENDAR_SYNC",
      module: "EVENTS",
      targetId: event.id,
      newValue: {
        schedulesCount: statuses.length,
      } as Prisma.InputJsonValue,
    });

    return {
      eventId: event.id,
      schedules: statuses,
    };
  }

  async unlinkEventFromGoogle(eventId: string, actor: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(actor);

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, churchId },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException("Evento não encontrado.");
    }

    const result =
      await this.googleCalendarSyncService.unlinkAllEventSchedules(event.id);

    await this.auditLogsService.log({
      userId: actor.sub,
      churchId: actor.churchId,
      action: "GOOGLE_CALENDAR_UNLINK",
      module: "EVENTS",
      targetId: event.id,
      newValue: {
        success: result.success,
      } as Prisma.InputJsonValue,
    });

    return {
      eventId: event.id,
      success: result.success,
      errors: result.errors,
    };
  }

  async getGoogleSyncStatus(eventId: string) {
    const statuses =
      await this.googleCalendarSyncService.getEventSyncStatuses(eventId);
    return {
      eventId,
      schedules: statuses,
    };
  }

  async seedInitialEvents(actor: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(actor);
    const now = new Date();
    const baseYear = now.getFullYear();
    const baseMonth = now.getMonth();

    const defaults = [
      {
        nome: "Culto Domingo Manhã",
        descricao: "Celebração dominical da manhã",
        dataInicio: new Date(baseYear, baseMonth, now.getDate() + 2, 9, 0, 0),
        dataFim: new Date(baseYear, baseMonth, now.getDate() + 2, 11, 0, 0),
        recorrencia: "SEMANAL",
      },
      {
        nome: "Culto Domingo Noite",
        descricao: "Celebração dominical da noite",
        dataInicio: new Date(baseYear, baseMonth, now.getDate() + 2, 19, 0, 0),
        dataFim: new Date(baseYear, baseMonth, now.getDate() + 2, 21, 0, 0),
        recorrencia: "SEMANAL",
      },
      {
        nome: "Culto de Jovens",
        descricao: "Culto de jovens aos sábados",
        dataInicio: new Date(baseYear, baseMonth, now.getDate() + 1, 19, 30, 0),
        dataFim: new Date(baseYear, baseMonth, now.getDate() + 1, 21, 30, 0),
        recorrencia: "SEMANAL",
      },
      {
        nome: "Ensaio Worship",
        descricao: "Ensaio da equipe de louvor",
        dataInicio: new Date(baseYear, baseMonth, now.getDate() + 3, 20, 0, 0),
        dataFim: new Date(baseYear, baseMonth, now.getDate() + 3, 22, 0, 0),
        recorrencia: "SEMANAL",
      },
      {
        nome: "Conferência Especial",
        descricao: "Evento especial da igreja",
        dataInicio: new Date(baseYear, baseMonth, now.getDate() + 7, 18, 0, 0),
        dataFim: new Date(baseYear, baseMonth, now.getDate() + 7, 22, 0, 0),
        recorrencia: null,
      },
    ];

    for (const event of defaults) {
      const exists = await this.prisma.event.findFirst({
        where: {
          churchId,
          nome: event.nome,
          dataInicio: event.dataInicio,
          dataFim: event.dataFim,
        },
        select: { id: true },
      });

      if (!exists) {
        await this.prisma.event.create({
          data: {
            ...event,
            churchId,
          },
        });
      }
    }

    return this.findAll(actor);
  }
}
