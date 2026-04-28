import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEventDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";

const eventSelect = {
  id: true,
  churchId: true,
  nome: true,
  descricao: true,
  dataInicio: true,
  dataFim: true,
  recorrencia: true,
  createdAt: true,
} as const;

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(dto: CreateEventDto, actor: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(actor);
    const dataInicio = new Date(dto.dataInicio);
    const dataFim = new Date(dto.dataFim);

    this.validateDateRange(dataInicio, dataFim);

    return this.prisma.event.create({
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

  async update(id: string, dto: UpdateEventDto, actor: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(actor);

    const existing = await this.prisma.event.findFirst({
      where: { id, churchId },
      select: { id: true, dataInicio: true, dataFim: true },
    });

    if (!existing) {
      throw new NotFoundException("Evento não encontrado.");
    }

    const dataInicio = dto.dataInicio
      ? new Date(dto.dataInicio)
      : existing.dataInicio;
    const dataFim = dto.dataFim ? new Date(dto.dataFim) : existing.dataFim;

    this.validateDateRange(dataInicio, dataFim);

    return this.prisma.event.update({
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

    return this.prisma.event.delete({
      where: { id },
      select: eventSelect,
    });
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
