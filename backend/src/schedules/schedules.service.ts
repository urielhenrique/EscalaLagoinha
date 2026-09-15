import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, ScheduleStatus } from "@prisma/client";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { AvailabilityService } from "../availability/availability.service";
import {
  assertLeaderOfMinistry,
  getChurchIdOrThrow,
  isChurchAdmin,
  isLeader,
} from "../auth/helpers/role-helpers";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { toJsonValue } from "../common/utils/json";
import { GoogleCalendarSyncService } from "../integrations/google-calendar/google-calendar-sync.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { USER_PUBLIC_SELECT } from "../users/users.service";
import { CreateScheduleDto } from "./dto/create-schedule.dto";
import { UpdateScheduleDto } from "./dto/update-schedule.dto";

const scheduleSelect = {
  id: true,
  churchId: true,
  eventId: true,
  ministryId: true,
  volunteerId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  event: {
    select: {
      id: true,
      nome: true,
      descricao: true,
      dataInicio: true,
      dataFim: true,
      recorrencia: true,
      createdAt: true,
    },
  },
  ministry: {
    select: {
      id: true,
      nome: true,
      descricao: true,
      leaderId: true,
    },
  },
  volunteer: {
    select: USER_PUBLIC_SELECT,
  },
} as const;

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly availabilityService: AvailabilityService,
    private readonly auditLogsService: AuditLogsService,
    private readonly googleCalendarSyncService: GoogleCalendarSyncService,
  ) {}

  private async assertLeaderAccess(
    actor: JwtPayload,
    ministryId: string,
    churchId: string,
  ) {
    if (isLeader(actor)) {
      await assertLeaderOfMinistry(this.prisma, actor.sub, ministryId, churchId);
    }
  }

  private async ensureEntitiesExist(data: {
    eventId: string;
    ministryId: string;
    volunteerId: string;
    churchId: string;
  }) {
    const [event, ministry, volunteer] = await Promise.all([
      this.prisma.event.findUnique({
        where: { id: data.eventId },
        select: { id: true, churchId: true },
      }),
      this.prisma.ministry.findUnique({
        where: { id: data.ministryId },
        select: { id: true, churchId: true },
      }),
      this.prisma.user.findUnique({
        where: { id: data.volunteerId },
        select: { id: true, ativo: true, churchId: true },
      }),
    ]);

    if (!event) {
      throw new NotFoundException("Evento não encontrado.");
    }

    if (!ministry) {
      throw new NotFoundException("Ministério não encontrado.");
    }

    if (!volunteer || !volunteer.ativo) {
      throw new NotFoundException("Voluntário não encontrado ou inativo.");
    }

    if (
      event.churchId !== data.churchId ||
      ministry.churchId !== data.churchId ||
      volunteer.churchId !== data.churchId
    ) {
      throw new ForbiddenException(
        "As entidades informadas pertencem a outra igreja.",
      );
    }
  }

  private async assertNoTimeConflict(params: {
    eventId: string;
    volunteerId: string;
    churchId: string;
    excludingScheduleId?: string;
  }) {
    const targetEvent = await this.prisma.event.findUnique({
      where: { id: params.eventId },
      select: { id: true, nome: true, dataInicio: true, dataFim: true },
    });

    if (!targetEvent) {
      throw new NotFoundException("Evento não encontrado.");
    }

    const conflictingSchedule = await this.prisma.schedule.findFirst({
      where: {
        volunteerId: params.volunteerId,
        churchId: params.churchId,
        status: { in: [ScheduleStatus.CONFIRMADO, ScheduleStatus.PENDENTE] },
        id:
          params.excludingScheduleId !== undefined
            ? { not: params.excludingScheduleId }
            : undefined,
        event: {
          dataInicio: { lt: targetEvent.dataFim },
          dataFim: { gt: targetEvent.dataInicio },
        },
      },
      select: {
        id: true,
        event: {
          select: { nome: true, dataInicio: true, dataFim: true },
        },
      },
    });

    if (conflictingSchedule) {
      throw new ConflictException(
        `Conflito de escala: este voluntário já está escalado no evento "${conflictingSchedule.event.nome}" no mesmo horário.`,
      );
    }
  }

  private async syncScheduleToGoogle(scheduleId: string): Promise<void> {
    try {
      await this.googleCalendarSyncService.syncSchedule(scheduleId);
    } catch (error) {
      this.logger.error(
        `Google Calendar sync failed for schedule ${scheduleId}: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  private async unlinkScheduleFromGoogle(scheduleId: string): Promise<void> {
    try {
      await this.googleCalendarSyncService.deleteGoogleEvent(scheduleId);
    } catch (error) {
      this.logger.error(
        `Google Calendar unlink failed for schedule ${scheduleId}: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  async create(dto: CreateScheduleDto, actor: JwtPayload) {
    const churchId = getChurchIdOrThrow(actor);
    await this.assertLeaderAccess(actor, dto.ministryId, churchId);
    await this.ensureEntitiesExist({ ...dto, churchId });

    const targetEvent = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
      select: { dataInicio: true, dataFim: true, churchId: true },
    });

    if (!targetEvent) {
      throw new NotFoundException("Evento não encontrado.");
    }

    await this.availabilityService.assertVolunteerAvailable({
      volunteerId: dto.volunteerId,
      eventStart: targetEvent.dataInicio,
      eventEnd: targetEvent.dataFim,
      ministryId: dto.ministryId,
    });

    await this.assertNoTimeConflict({
      eventId: dto.eventId,
      volunteerId: dto.volunteerId,
      churchId,
    });

    try {
      const created = await this.prisma.schedule.create({
        data: {
          churchId,
          eventId: dto.eventId,
          ministryId: dto.ministryId,
          volunteerId: dto.volunteerId,
          status: dto.status ?? ScheduleStatus.PENDENTE,
        },
        select: scheduleSelect,
      });

      await this.notificationsService.notifyScaleCreated({
        volunteerId: created.volunteerId,
        churchId: created.churchId ?? undefined,
        eventName: created.event.nome,
        eventDateTimeLabel: created.event.dataInicio.toISOString(),
      });

      await this.auditLogsService.log({
        userId: actor.sub,
        action: "SCHEDULE_CREATED",
        module: "SCHEDULES",
        targetId: created.id,
        newValue: toJsonValue(created),
      });

      await this.syncScheduleToGoogle(created.id);

      return created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Esta escala já existe para o mesmo evento, ministério e voluntário.",
        );
      }

      throw error;
    }
  }

  async findAllVisible(
    user: JwtPayload,
    filters: { eventId?: string; ministryId?: string; volunteerId?: string },
  ) {
    const where: Prisma.ScheduleWhereInput = {
      churchId: getChurchIdOrThrow(user),
      eventId: filters.eventId,
      ministryId: filters.ministryId,
      volunteerId: filters.volunteerId,
    };

    if (isChurchAdmin(user)) {
      return this.prisma.schedule.findMany({
        where,
        orderBy: [{ event: { dataInicio: "asc" } }, { createdAt: "asc" }],
        select: scheduleSelect,
      });
    }

    if (filters.volunteerId && filters.volunteerId !== user.sub) {
      throw new ForbiddenException(
        "Você só pode consultar escalas do próprio usuário.",
      );
    }

    where.OR = [
      { volunteerId: user.sub },
      { ministry: { leaderId: user.sub } },
    ];

    return this.prisma.schedule.findMany({
      where,
      orderBy: [{ event: { dataInicio: "asc" } }, { createdAt: "asc" }],
      select: scheduleSelect,
    });
  }

  async findByIdVisible(id: string, user: JwtPayload) {
    const churchId = getChurchIdOrThrow(user);
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      select: scheduleSelect,
    });

    if (!schedule) {
      throw new NotFoundException("Escala não encontrada.");
    }

    if (schedule.churchId !== churchId) {
      throw new ForbiddenException("Você não possui acesso a esta escala.");
    }

    if (isChurchAdmin(user)) {
      return schedule;
    }

    if (
      schedule.volunteerId !== user.sub &&
      schedule.ministry.leaderId !== user.sub
    ) {
      throw new ForbiddenException("Você não possui acesso a esta escala.");
    }

    return schedule;
  }

  async update(id: string, dto: UpdateScheduleDto, actor: JwtPayload) {
    const churchId = getChurchIdOrThrow(actor);
    const existing = await this.prisma.schedule.findUnique({
      where: { id },
      select: scheduleSelect,
    });

    if (!existing) {
      throw new NotFoundException("Escala não encontrada.");
    }

    if (existing.churchId !== churchId) {
      throw new ForbiddenException("Acesso negado a escala de outra igreja.");
    }

    const ministryId = dto.ministryId ?? existing.ministryId;
    await this.assertLeaderAccess(actor, ministryId, churchId);

    const eventId = dto.eventId ?? existing.eventId;
    const volunteerId = dto.volunteerId ?? existing.volunteerId;

    await this.ensureEntitiesExist({
      eventId,
      ministryId,
      volunteerId,
      churchId,
    });

    const targetEvent = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { dataInicio: true, dataFim: true, churchId: true },
    });

    if (!targetEvent) {
      throw new NotFoundException("Evento não encontrado.");
    }

    const nextStatus = dto.status ?? existing.status;
    if (nextStatus !== ScheduleStatus.CANCELADO) {
      await this.availabilityService.assertVolunteerAvailable({
        volunteerId,
        eventStart: targetEvent.dataInicio,
        eventEnd: targetEvent.dataFim,
        ministryId,
      });

      await this.assertNoTimeConflict({
        eventId,
        volunteerId,
        churchId,
        excludingScheduleId: id,
      });
    }

    try {
      const updated = await this.prisma.schedule.update({
        where: { id },
        data: {
          eventId: dto.eventId,
          ministryId: dto.ministryId,
          volunteerId: dto.volunteerId,
          status: dto.status,
        },
        select: scheduleSelect,
      });

      await this.auditLogsService.log({
        userId: actor.sub,
        action: "SCHEDULE_UPDATED",
        module: "SCHEDULES",
        targetId: updated.id,
        oldValue: toJsonValue(existing),
        newValue: toJsonValue(updated),
      });

      const volunteerChanged =
        dto.volunteerId && dto.volunteerId !== existing.volunteerId;
      const statusChangedToCancelled =
        dto.status === ScheduleStatus.CANCELADO &&
        existing.status !== ScheduleStatus.CANCELADO;

      if (statusChangedToCancelled) {
        await this.unlinkScheduleFromGoogle(id);
      } else if (volunteerChanged) {
        await this.unlinkScheduleFromGoogle(id);
        await this.syncScheduleToGoogle(id);
      } else {
        await this.syncScheduleToGoogle(id);
      }

      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Esta escala já existe para o mesmo evento, ministério e voluntário.",
        );
      }

      throw error;
    }
  }

  async cancel(id: string, actor: JwtPayload) {
    const churchId = getChurchIdOrThrow(actor);
    const exists = await this.prisma.schedule.findUnique({
      where: { id },
      select: scheduleSelect,
    });

    if (!exists) {
      throw new NotFoundException("Escala não encontrada.");
    }

    if (exists.churchId !== churchId) {
      throw new ForbiddenException("Acesso negado a escala de outra igreja.");
    }

    await this.assertLeaderAccess(actor, exists.ministryId, churchId);

    const cancelled = await this.prisma.schedule.update({
      where: { id },
      data: { status: ScheduleStatus.CANCELADO },
      select: scheduleSelect,
    });

    await this.notificationsService.notifyScaleCancelled({
      volunteerId: cancelled.volunteerId,
      churchId: cancelled.churchId ?? undefined,
      eventName: cancelled.event.nome,
      eventDateTimeLabel: cancelled.event.dataInicio.toISOString(),
    });

    await this.auditLogsService.log({
      userId: actor.sub,
      action: "SCHEDULE_CANCELLED",
      module: "SCHEDULES",
      targetId: cancelled.id,
      oldValue: toJsonValue(exists),
      newValue: toJsonValue(cancelled),
    });

    await this.unlinkScheduleFromGoogle(id);

    return cancelled;
  }
}
