import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AvailabilityDayOfWeek,
  AvailabilityPeriod,
  AvailabilityPreference,
  MinistryPreferenceType,
  Perfil,
} from "@prisma/client";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBlockedDateDto } from "./dto/create-blocked-date.dto";
import { UpsertAvailabilityDto } from "./dto/upsert-availability.dto";
import { UpsertMinistryPreferencesDto } from "./dto/upsert-ministry-preferences.dto";

function toUtcDateBounds(input: Date) {
  const start = new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()),
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function mapDateToDayOfWeek(date: Date): AvailabilityDayOfWeek {
  const day = date.getUTCDay();
  switch (day) {
    case 1:
      return AvailabilityDayOfWeek.SEGUNDA;
    case 2:
      return AvailabilityDayOfWeek.TERCA;
    case 3:
      return AvailabilityDayOfWeek.QUARTA;
    case 4:
      return AvailabilityDayOfWeek.QUINTA;
    case 5:
      return AvailabilityDayOfWeek.SEXTA;
    case 6:
      return AvailabilityDayOfWeek.SABADO;
    default:
      return AvailabilityDayOfWeek.DOMINGO;
  }
}

function mapDateToPeriod(date: Date): AvailabilityPeriod {
  const hour = date.getUTCHours();
  if (hour < 12) return AvailabilityPeriod.MANHA;
  if (hour < 18) return AvailabilityPeriod.TARDE;
  return AvailabilityPeriod.NOITE;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureVolunteer(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, perfil: true, ativo: true, churchId: true },
    });

    if (!user || !user.ativo) {
      throw new NotFoundException("Voluntário não encontrado ou inativo.");
    }

    if (user.perfil === Perfil.ADMIN || user.perfil === Perfil.MASTER_ADMIN) {
      throw new ForbiddenException(
        "Disponibilidade é exclusiva para contas de voluntário.",
      );
    }

    return user;
  }

  async getMine(user: JwtPayload) {
    await this.ensureVolunteer(user.sub);

    const [weekly, blockedDates, ministryPreferences] = await Promise.all([
      this.prisma.volunteerAvailability.findMany({
        where: { volunteerId: user.sub },
        orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
      }),
      this.prisma.blockedDate.findMany({
        where: { volunteerId: user.sub },
        orderBy: { date: "asc" },
      }),
      this.prisma.volunteerMinistryPreference.findMany({
        where: { volunteerId: user.sub },
        include: {
          ministry: {
            select: { id: true, nome: true, descricao: true, leaderId: true },
          },
        },
      }),
    ]);

    return {
      weekly,
      blockedDates,
      ministryPreferences,
    };
  }

  async upsertWeekly(user: JwtPayload, dto: UpsertAvailabilityDto) {
    await this.ensureVolunteer(user.sub);

    const dedup = new Set<string>();
    for (const slot of dto.slots) {
      const key = `${slot.dayOfWeek}:${slot.period}`;
      if (dedup.has(key)) {
        throw new BadRequestException(
          "Não é permitido repetir dia/período na disponibilidade.",
        );
      }
      dedup.add(key);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.volunteerAvailability.deleteMany({
        where: { volunteerId: user.sub },
      });

      if (dto.slots.length > 0) {
        await tx.volunteerAvailability.createMany({
          data: dto.slots.map((slot) => ({
            volunteerId: user.sub,
            dayOfWeek: slot.dayOfWeek,
            period: slot.period,
            preference: slot.preference,
          })),
        });
      }
    });

    return this.prisma.volunteerAvailability.findMany({
      where: { volunteerId: user.sub },
      orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
    });
  }

  async upsertMinistryPreferences(
    user: JwtPayload,
    dto: UpsertMinistryPreferencesDto,
  ) {
    const volunteer = await this.ensureVolunteer(user.sub);

    if (!volunteer.churchId) {
      throw new ForbiddenException(
        "Acesso negado: voluntário sem igreja vinculada.",
      );
    }

    const allIds = [...dto.preferredMinistryIds, ...dto.unavailableMinistryIds];
    const uniqueIds = Array.from(new Set(allIds));

    if (
      dto.preferredMinistryIds.some((id) =>
        dto.unavailableMinistryIds.includes(id),
      )
    ) {
      throw new BadRequestException(
        "Um ministério não pode ser preferencial e indisponível ao mesmo tempo.",
      );
    }

    if (uniqueIds.length > 0) {
      const existing = await this.prisma.ministry.findMany({
        where: { id: { in: uniqueIds }, churchId: volunteer.churchId },
        select: { id: true },
      });

      if (existing.length !== uniqueIds.length) {
        throw new BadRequestException("Foi informado um ministério inválido.");
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.volunteerMinistryPreference.deleteMany({
        where: { volunteerId: user.sub },
      });

      const data = [
        ...dto.preferredMinistryIds.map((ministryId) => ({
          volunteerId: user.sub,
          ministryId,
          type: MinistryPreferenceType.PREFERENCIAL,
        })),
        ...dto.unavailableMinistryIds.map((ministryId) => ({
          volunteerId: user.sub,
          ministryId,
          type: MinistryPreferenceType.INDISPONIVEL,
        })),
      ];

      if (data.length > 0) {
        await tx.volunteerMinistryPreference.createMany({ data });
      }
    });

    return this.prisma.volunteerMinistryPreference.findMany({
      where: { volunteerId: user.sub },
      include: {
        ministry: {
          select: { id: true, nome: true, descricao: true, leaderId: true },
        },
      },
    });
  }

  async addBlockedDate(user: JwtPayload, dto: CreateBlockedDateDto) {
    await this.ensureVolunteer(user.sub);

    const parsed = new Date(dto.date);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("Data inválida para bloqueio.");
    }

    const { start } = toUtcDateBounds(parsed);

    return this.prisma.blockedDate.create({
      data: {
        volunteerId: user.sub,
        date: start,
        reason: dto.reason,
      },
    });
  }

  async removeBlockedDate(user: JwtPayload, id: string) {
    const blocked = await this.prisma.blockedDate.findUnique({
      where: { id },
      select: { id: true, volunteerId: true },
    });

    if (!blocked || blocked.volunteerId !== user.sub) {
      throw new NotFoundException("Bloqueio não encontrado.");
    }

    return this.prisma.blockedDate.delete({ where: { id } });
  }

  async assertVolunteerAvailable(params: {
    volunteerId: string;
    eventStart: Date;
    eventEnd: Date;
    ministryId: string;
  }) {
    const { volunteerId, eventStart, eventEnd, ministryId } = params;

    const { start, end } = toUtcDateBounds(eventStart);

    const [blocked, weeklyForDayPeriod, anyWeekly, ministryPrefs] =
      await Promise.all([
        this.prisma.blockedDate.findFirst({
          where: {
            volunteerId,
            date: {
              gte: start,
              lt: end,
            },
          },
          select: { id: true, reason: true, date: true },
        }),
        this.prisma.volunteerAvailability.findMany({
          where: {
            volunteerId,
            dayOfWeek: mapDateToDayOfWeek(eventStart),
            period: mapDateToPeriod(eventStart),
          },
          select: { preference: true },
        }),
        this.prisma.volunteerAvailability.count({ where: { volunteerId } }),
        this.prisma.volunteerMinistryPreference.findMany({
          where: { volunteerId, ministryId },
          select: { type: true },
        }),
      ]);

    if (blocked) {
      throw new ConflictException(
        `Voluntário indisponível nesta data (${blocked.reason}).`,
      );
    }

    if (eventEnd <= eventStart) {
      throw new BadRequestException("Período do evento inválido.");
    }

    const ministryBlocked = ministryPrefs.some(
      (item) => item.type === MinistryPreferenceType.INDISPONIVEL,
    );
    if (ministryBlocked) {
      throw new ConflictException(
        "Voluntário marcou este ministério como indisponível.",
      );
    }

    if (anyWeekly > 0) {
      if (weeklyForDayPeriod.length === 0) {
        throw new ConflictException(
          "Voluntário não possui disponibilidade para este dia/período.",
        );
      }

      const hasUnavailable = weeklyForDayPeriod.some(
        (item) => item.preference === AvailabilityPreference.INDISPONIVEL,
      );
      if (hasUnavailable) {
        throw new ConflictException(
          "Voluntário marcou este dia/período como indisponível.",
        );
      }
    }
  }
}
