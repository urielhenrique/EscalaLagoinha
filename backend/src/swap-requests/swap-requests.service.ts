import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, ScheduleStatus, SwapRequestStatus } from "@prisma/client";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { AvailabilityService } from "../availability/availability.service";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { toJsonValue } from "../common/utils/json";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { USER_PUBLIC_SELECT } from "../users/users.service";
import { CreateSwapRequestDto } from "./dto/create-swap-request.dto";

const scheduleWithRelationsSelect = {
  id: true,
  churchId: true,
  eventId: true,
  ministryId: true,
  volunteerId: true,
  status: true,
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

const swapRequestSelect = {
  id: true,
  requesterShiftId: true,
  requesterId: true,
  requestedShiftId: true,
  requestedVolunteerId: true,
  status: true,
  createdAt: true,
  requesterShift: { select: scheduleWithRelationsSelect },
  requestedShift: { select: scheduleWithRelationsSelect },
  requester: { select: USER_PUBLIC_SELECT },
  requestedVolunteer: { select: USER_PUBLIC_SELECT },
} as const;

@Injectable()
export class SwapRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly availabilityService: AvailabilityService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private getChurchIdOrThrow(user: JwtPayload) {
    if (!user.churchId) {
      throw new ForbiddenException(
        "Acesso negado: usuário sem igreja vinculada.",
      );
    }

    return user.churchId;
  }

  private async findScheduleOrThrow(id: string, churchId: string) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      select: scheduleWithRelationsSelect,
    });

    if (!schedule) {
      throw new NotFoundException("Escala não encontrada.");
    }

    if (schedule.churchId !== churchId) {
      throw new ForbiddenException("Acesso negado a escala de outra igreja.");
    }

    return schedule;
  }

  private async assertNoEventConflict(params: {
    volunteerId: string;
    targetEvent: {
      dataInicio: Date;
      dataFim: Date;
    };
    excludeScheduleIds: string[];
  }) {
    const conflict = await this.prisma.schedule.findFirst({
      where: {
        volunteerId: params.volunteerId,
        status: { in: [ScheduleStatus.CONFIRMADO, ScheduleStatus.PENDENTE] },
        id: { notIn: params.excludeScheduleIds },
        event: {
          dataInicio: { lt: params.targetEvent.dataFim },
          dataFim: { gt: params.targetEvent.dataInicio },
        },
      },
      select: {
        id: true,
        event: {
          select: { nome: true },
        },
      },
    });

    if (conflict) {
      throw new ConflictException(
        `Conflito de horário: o voluntário já possui escala no evento "${conflict.event.nome}" nesse período.`,
      );
    }
  }

  private async findSwapOrThrow(id: string, churchId: string) {
    const request = await this.prisma.swapRequest.findFirst({
      where: { id, requesterShift: { is: { churchId } } },
      select: swapRequestSelect,
    });

    if (!request) {
      throw new NotFoundException("Solicitação de troca não encontrada.");
    }

    return request;
  }

  async listEligibleCandidates(requesterShiftId: string, user: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(user);
    const requesterShift = await this.findScheduleOrThrow(
      requesterShiftId,
      churchId,
    );

    if (requesterShift.volunteerId !== user.sub) {
      throw new ForbiddenException(
        "Você só pode solicitar troca para uma escala própria.",
      );
    }

    if (requesterShift.status === ScheduleStatus.CANCELADO) {
      throw new BadRequestException(
        "Não é possível trocar uma escala cancelada.",
      );
    }

    const candidates = await this.prisma.schedule.findMany({
      where: {
        churchId,
        ministryId: requesterShift.ministryId,
        status: { in: [ScheduleStatus.CONFIRMADO, ScheduleStatus.PENDENTE] },
        volunteerId: { not: user.sub },
        volunteer: { ativo: true },
        event: {
          NOT: {
            dataInicio: { lt: requesterShift.event.dataFim },
            dataFim: { gt: requesterShift.event.dataInicio },
          },
        },
      },
      orderBy: { event: { dataInicio: "asc" } },
      select: scheduleWithRelationsSelect,
    });

    const eligibleByAvailability: typeof candidates = [];

    for (const candidate of candidates) {
      try {
        await this.availabilityService.assertVolunteerAvailable({
          volunteerId: candidate.volunteerId,
          eventStart: requesterShift.event.dataInicio,
          eventEnd: requesterShift.event.dataFim,
          ministryId: requesterShift.ministryId,
        });

        await this.availabilityService.assertVolunteerAvailable({
          volunteerId: requesterShift.volunteerId,
          eventStart: candidate.event.dataInicio,
          eventEnd: candidate.event.dataFim,
          ministryId: candidate.ministryId,
        });

        eligibleByAvailability.push(candidate);
      } catch {
        continue;
      }
    }

    return eligibleByAvailability;
  }

  async create(dto: CreateSwapRequestDto, user: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(user);
    if (dto.requesterShiftId === dto.requestedShiftId) {
      throw new BadRequestException(
        "A troca precisa envolver escalas diferentes.",
      );
    }

    const [requesterShift, requestedShift] = await Promise.all([
      this.findScheduleOrThrow(dto.requesterShiftId, churchId),
      this.findScheduleOrThrow(dto.requestedShiftId, churchId),
    ]);

    if (requesterShift.volunteerId !== user.sub) {
      throw new ForbiddenException("A escala de origem deve ser sua.");
    }

    if (requestedShift.volunteerId !== dto.requestedVolunteerId) {
      throw new BadRequestException(
        "A escala escolhida não pertence ao voluntário solicitado.",
      );
    }

    if (dto.requestedVolunteerId === user.sub) {
      throw new BadRequestException(
        "Não é permitido solicitar troca para você mesmo.",
      );
    }

    if (requesterShift.ministryId !== requestedShift.ministryId) {
      throw new BadRequestException(
        "A troca só pode ocorrer entre voluntários do mesmo ministério.",
      );
    }

    if (
      requesterShift.status === ScheduleStatus.CANCELADO ||
      requestedShift.status === ScheduleStatus.CANCELADO
    ) {
      throw new BadRequestException(
        "Não é possível trocar escalas canceladas.",
      );
    }

    const requestedVolunteer = await this.prisma.user.findUnique({
      where: { id: dto.requestedVolunteerId },
      select: { id: true, ativo: true, churchId: true },
    });

    if (
      !requestedVolunteer ||
      !requestedVolunteer.ativo ||
      requestedVolunteer.churchId !== churchId
    ) {
      throw new BadRequestException(
        "O voluntário solicitado está inativo ou não foi encontrado.",
      );
    }

    const duplicated = await this.prisma.swapRequest.findFirst({
      where: {
        requesterShift: { is: { churchId } },
        status: SwapRequestStatus.PENDENTE,
        OR: [
          {
            requesterShiftId: dto.requesterShiftId,
            requestedShiftId: dto.requestedShiftId,
          },
          {
            requesterShiftId: dto.requestedShiftId,
            requestedShiftId: dto.requesterShiftId,
          },
        ],
      },
      select: { id: true },
    });

    if (duplicated) {
      throw new ConflictException(
        "Já existe uma solicitação pendente entre essas escalas.",
      );
    }

    const created = await this.prisma.swapRequest.create({
      data: {
        requesterShiftId: dto.requesterShiftId,
        requesterId: user.sub,
        requestedShiftId: dto.requestedShiftId,
        requestedVolunteerId: dto.requestedVolunteerId,
        status: SwapRequestStatus.PENDENTE,
      },
      select: swapRequestSelect,
    });

    await this.notificationsService.notifySwapRequest({
      requestedVolunteerId: dto.requestedVolunteerId,
      churchId,
      requesterName: requesterShift.volunteer.nome,
      eventName: requesterShift.event.nome,
    });

    await this.auditLogsService.log({
      userId: user.sub,
      action: "SWAP_REQUEST_CREATED",
      module: "SWAP_REQUESTS",
      targetId: created.id,
      newValue: toJsonValue(created),
    });

    return created;
  }

  async findMyRequests(user: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(user);
    return this.prisma.swapRequest.findMany({
      where: {
        requesterId: user.sub,
        requesterShift: { is: { churchId } },
      },
      orderBy: [{ createdAt: "desc" }],
      select: swapRequestSelect,
    });
  }

  async findReceivedRequests(user: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(user);
    return this.prisma.swapRequest.findMany({
      where: {
        requestedVolunteerId: user.sub,
        requesterShift: { is: { churchId } },
      },
      orderBy: [{ createdAt: "desc" }],
      select: swapRequestSelect,
    });
  }

  async findHistory(user: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(user);
    return this.prisma.swapRequest.findMany({
      where: {
        requesterShift: { is: { churchId } },
        OR: [{ requesterId: user.sub }, { requestedVolunteerId: user.sub }],
      },
      orderBy: [{ createdAt: "desc" }],
      select: swapRequestSelect,
    });
  }

  async approve(id: string, user: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(user);
    const request = await this.findSwapOrThrow(id, churchId);

    if (request.status !== SwapRequestStatus.PENDENTE) {
      throw new BadRequestException(
        "Somente solicitações pendentes podem ser aprovadas.",
      );
    }

    if (request.requestedVolunteerId !== user.sub) {
      throw new ForbiddenException(
        "Apenas o voluntário solicitado pode aprovar.",
      );
    }

    const requesterShift = await this.findScheduleOrThrow(
      request.requesterShiftId,
      churchId,
    );
    const requestedShift = await this.findScheduleOrThrow(
      request.requestedShiftId,
      churchId,
    );

    if (
      requesterShift.volunteerId !== request.requesterId ||
      requestedShift.volunteerId !== request.requestedVolunteerId
    ) {
      throw new ConflictException(
        "As escalas envolvidas foram alteradas e a troca não pode ser concluída.",
      );
    }

    await this.assertNoEventConflict({
      volunteerId: request.requestedVolunteerId,
      targetEvent: requesterShift.event,
      excludeScheduleIds: [request.requestedShiftId, request.requesterShiftId],
    });

    await this.availabilityService.assertVolunteerAvailable({
      volunteerId: request.requestedVolunteerId,
      eventStart: requesterShift.event.dataInicio,
      eventEnd: requesterShift.event.dataFim,
      ministryId: requesterShift.ministryId,
    });

    await this.assertNoEventConflict({
      volunteerId: request.requesterId,
      targetEvent: requestedShift.event,
      excludeScheduleIds: [request.requestedShiftId, request.requesterShiftId],
    });

    await this.availabilityService.assertVolunteerAvailable({
      volunteerId: request.requesterId,
      eventStart: requestedShift.event.dataInicio,
      eventEnd: requestedShift.event.dataFim,
      ministryId: requestedShift.ministryId,
    });

    try {
      const approved = await this.prisma.$transaction(async (tx) => {
        await tx.schedule.update({
          where: { id: request.requesterShiftId },
          data: { volunteerId: request.requestedVolunteerId },
        });

        await tx.schedule.update({
          where: { id: request.requestedShiftId },
          data: { volunteerId: request.requesterId },
        });

        return tx.swapRequest.update({
          where: { id: request.id },
          data: { status: SwapRequestStatus.APROVADO },
          select: swapRequestSelect,
        });
      });

      await this.notificationsService.notifySwapApproved({
        requesterId: request.requesterId,
        churchId,
        requestedVolunteerName: request.requestedVolunteer.nome,
      });

      await this.notificationsService.notifySwapAutoCompletedToLeader({
        ministryId: requesterShift.ministryId,
        requesterName: request.requester.nome,
        requestedVolunteerName: request.requestedVolunteer.nome,
        requesterEventName: requesterShift.event.nome,
        requestedEventName: requestedShift.event.nome,
      });

      await this.auditLogsService.log({
        userId: user.sub,
        action: "SWAP_REQUEST_APPROVED",
        module: "SWAP_REQUESTS",
        targetId: approved.id,
        oldValue: toJsonValue(request),
        newValue: toJsonValue(approved),
      });

      return approved;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Não foi possível concluir a troca por conflito de escala.",
        );
      }

      throw error;
    }
  }

  async reject(id: string, user: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(user);
    const request = await this.findSwapOrThrow(id, churchId);

    if (request.status !== SwapRequestStatus.PENDENTE) {
      throw new BadRequestException(
        "Somente solicitações pendentes podem ser recusadas.",
      );
    }

    if (request.requestedVolunteerId !== user.sub) {
      throw new ForbiddenException(
        "Apenas o voluntário solicitado pode recusar.",
      );
    }

    const rejected = await this.prisma.swapRequest.update({
      where: { id: request.id },
      data: { status: SwapRequestStatus.RECUSADO },
      select: swapRequestSelect,
    });

    await this.notificationsService.notifySwapDeclined({
      requesterId: request.requesterId,
      churchId,
      requestedVolunteerName: request.requestedVolunteer.nome,
    });

    await this.auditLogsService.log({
      userId: user.sub,
      action: "SWAP_REQUEST_REJECTED",
      module: "SWAP_REQUESTS",
      targetId: rejected.id,
      oldValue: toJsonValue(request),
      newValue: toJsonValue(rejected),
    });

    return rejected;
  }

  async cancel(id: string, user: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(user);
    const request = await this.findSwapOrThrow(id, churchId);

    if (request.status !== SwapRequestStatus.PENDENTE) {
      throw new BadRequestException(
        "Somente solicitações pendentes podem ser canceladas.",
      );
    }

    if (request.requesterId !== user.sub) {
      throw new ForbiddenException("Apenas quem solicitou pode cancelar.");
    }

    const cancelled = await this.prisma.swapRequest.update({
      where: { id: request.id },
      data: { status: SwapRequestStatus.CANCELADO },
      select: swapRequestSelect,
    });

    await this.auditLogsService.log({
      userId: user.sub,
      action: "SWAP_REQUEST_CANCELLED",
      module: "SWAP_REQUESTS",
      targetId: cancelled.id,
      oldValue: toJsonValue(request),
      newValue: toJsonValue(cancelled),
    });

    return cancelled;
  }
}
