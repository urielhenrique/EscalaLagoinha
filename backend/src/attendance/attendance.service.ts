import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AttendanceStatus, Perfil, Prisma } from "@prisma/client";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { toJsonValue } from "../common/utils/json";
import { PrismaService } from "../prisma/prisma.service";
import { MarkAttendanceStatusDto } from "./dto/mark-attendance-status.dto";

const SCHEDULE_INCLUDE = {
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
  volunteer: {
    select: {
      id: true,
      nome: true,
      email: true,
    },
  },
} satisfies Prisma.ScheduleInclude;

type AttendanceListItem = Prisma.AttendanceRecordGetPayload<{
  include: {
    schedule: {
      include: typeof SCHEDULE_INCLUDE;
    };
    markedBy: {
      select: {
        id: true;
        nome: true;
        email: true;
        perfil: true;
      };
    };
  };
}> & {
  id: string;
};

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
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

  private async assertEventChurchAccess(eventId: string, user: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(user);
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, churchId: true },
    });

    if (!event || event.churchId !== churchId) {
      throw new ForbiddenException("Acesso negado ao evento de outra igreja.");
    }
  }

  async getMyAttendance(user: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(user);
    const schedules = await this.prisma.schedule.findMany({
      where: {
        volunteerId: user.sub,
        churchId,
        status: { not: "CANCELADO" },
      },
      include: {
        ...SCHEDULE_INCLUDE,
        attendance: {
          include: {
            markedBy: {
              select: {
                id: true,
                nome: true,
                email: true,
                perfil: true,
              },
            },
          },
        },
      },
      orderBy: [{ event: { dataInicio: "asc" } }, { createdAt: "desc" }],
    });

    return schedules.map((schedule) => this.toAttendanceListItem(schedule));
  }

  async getAttendanceByEvent(eventId: string, user: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(user);
    await this.assertEventChurchAccess(eventId, user);

    const schedules = await this.prisma.schedule.findMany({
      where: {
        eventId,
        churchId,
      },
      include: {
        ...SCHEDULE_INCLUDE,
        attendance: {
          include: {
            markedBy: {
              select: {
                id: true,
                nome: true,
                email: true,
                perfil: true,
              },
            },
          },
        },
      },
      orderBy: [{ ministry: { nome: "asc" } }, { volunteer: { nome: "asc" } }],
    });

    return schedules.map((schedule) => this.toAttendanceListItem(schedule));
  }

  async confirmParticipation(scheduleId: string, user: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(user);
    const schedule = await this.getVolunteerSchedule(scheduleId, user.sub);

    const previous = await this.prisma.attendanceRecord.findUnique({
      where: { scheduleId },
    });

    const attendance = await this.prisma.attendanceRecord.upsert({
      where: { scheduleId },
      create: {
        scheduleId,
        volunteerId: user.sub,
        churchId,
        status: AttendanceStatus.CONFIRMADO,
        confirmedAt: new Date(),
      },
      update: {
        churchId,
        status: AttendanceStatus.CONFIRMADO,
        confirmedAt: new Date(),
      },
      include: {
        schedule: { include: SCHEDULE_INCLUDE },
      },
    });

    await this.auditLogsService.log({
      userId: user.sub,
      action: "ATTENDANCE_CONFIRM",
      module: "ATTENDANCE",
      targetId: attendance.id,
      churchId,
      oldValue: previous ? toJsonValue(previous) : undefined,
      newValue: toJsonValue(attendance),
    });

    return {
      message: `Presença confirmada para ${schedule.event.nome}.`,
      attendance,
    };
  }

  async checkIn(scheduleId: string, user: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(user);
    await this.getVolunteerSchedule(scheduleId, user.sub);

    const previous = await this.prisma.attendanceRecord.findUnique({
      where: { scheduleId },
    });

    const attendance = await this.prisma.attendanceRecord.upsert({
      where: { scheduleId },
      create: {
        scheduleId,
        volunteerId: user.sub,
        churchId,
        status: AttendanceStatus.PRESENTE,
        confirmedAt: new Date(),
        checkedInAt: new Date(),
      },
      update: {
        churchId,
        status: AttendanceStatus.PRESENTE,
        checkedInAt: new Date(),
      },
      include: {
        schedule: { include: SCHEDULE_INCLUDE },
      },
    });

    await this.auditLogsService.log({
      userId: user.sub,
      action: "ATTENDANCE_CHECK_IN",
      module: "ATTENDANCE",
      targetId: attendance.id,
      churchId,
      oldValue: previous ? toJsonValue(previous) : undefined,
      newValue: toJsonValue(attendance),
    });

    return {
      message: "Check-in realizado com sucesso.",
      attendance,
    };
  }

  async markStatus(
    scheduleId: string,
    body: MarkAttendanceStatusDto,
    actor: JwtPayload,
  ) {
    const churchId = this.getChurchIdOrThrow(actor);
    if (actor.perfil === Perfil.VOLUNTARIO) {
      throw new BadRequestException("Apenas liderança pode ajustar presença.");
    }

    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: SCHEDULE_INCLUDE,
    });

    if (!schedule) {
      throw new NotFoundException("Escala não encontrada.");
    }

    if (schedule.churchId !== churchId) {
      throw new ForbiddenException("Acesso negado a escala de outra igreja.");
    }

    const previous = await this.prisma.attendanceRecord.findUnique({
      where: { scheduleId },
    });

    const attendance = await this.prisma.attendanceRecord.upsert({
      where: { scheduleId },
      create: {
        scheduleId,
        volunteerId: schedule.volunteerId,
        churchId,
        status: body.status,
        note: body.note,
        markedById: actor.sub,
        confirmedAt:
          body.status === AttendanceStatus.CONFIRMADO ? new Date() : undefined,
        checkedInAt:
          body.status === AttendanceStatus.PRESENTE ? new Date() : undefined,
      },
      update: {
        churchId,
        status: body.status,
        note: body.note,
        markedById: actor.sub,
        confirmedAt:
          body.status === AttendanceStatus.CONFIRMADO
            ? new Date()
            : previous?.confirmedAt,
        checkedInAt:
          body.status === AttendanceStatus.PRESENTE
            ? new Date()
            : previous?.checkedInAt,
      },
      include: {
        schedule: { include: SCHEDULE_INCLUDE },
        markedBy: {
          select: {
            id: true,
            nome: true,
            email: true,
            perfil: true,
          },
        },
      },
    });

    await this.auditLogsService.log({
      userId: actor.sub,
      action: "ATTENDANCE_STATUS_UPDATED",
      module: "ATTENDANCE",
      targetId: attendance.id,
      churchId,
      oldValue: previous ? toJsonValue(previous) : undefined,
      newValue: toJsonValue(attendance),
    });

    return attendance;
  }

  private async getVolunteerSchedule(scheduleId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { churchId: true },
    });

    if (!user?.churchId) {
      throw new ForbiddenException(
        "Acesso negado: usuário sem igreja vinculada.",
      );
    }

    const schedule = await this.prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        volunteerId: userId,
        churchId: user.churchId,
      },
      include: SCHEDULE_INCLUDE,
    });

    if (!schedule) {
      throw new NotFoundException(
        "Escala não encontrada para o voluntário autenticado.",
      );
    }

    return schedule;
  }

  private toAttendanceListItem(
    schedule: Prisma.ScheduleGetPayload<{
      include: typeof SCHEDULE_INCLUDE & {
        attendance: {
          include: {
            markedBy: {
              select: {
                id: true;
                nome: true;
                email: true;
                perfil: true;
              };
            };
          };
        };
      };
    }>,
  ): AttendanceListItem {
    if (schedule.attendance) {
      return {
        ...schedule.attendance,
        schedule: {
          id: schedule.id,
          eventId: schedule.eventId,
          ministryId: schedule.ministryId,
          volunteerId: schedule.volunteerId,
          churchId: schedule.churchId,
          status: schedule.status,
          createdAt: schedule.createdAt,
          updatedAt: schedule.updatedAt,
          event: schedule.event,
          ministry: schedule.ministry,
          volunteer: schedule.volunteer,
        },
      };
    }

    return {
      id: `pending-${schedule.id}`,
      scheduleId: schedule.id,
      volunteerId: schedule.volunteerId,
      churchId: schedule.churchId,
      status: null,
      note: null,
      confirmedAt: null,
      checkedInAt: null,
      markedById: null,
      markedBy: null,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
      schedule: {
        id: schedule.id,
        eventId: schedule.eventId,
        ministryId: schedule.ministryId,
        volunteerId: schedule.volunteerId,
        churchId: schedule.churchId,
        status: schedule.status,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt,
        event: schedule.event,
        ministry: schedule.ministry,
        volunteer: schedule.volunteer,
      },
    };
  }
}
