import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Perfil } from "@prisma/client";
import {
  getChurchIdOrThrow,
  isChurchAdmin,
} from "../auth/helpers/role-helpers";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";
import { USER_PUBLIC_SELECT } from "../users/users.service";
import { CreateMinistryDto } from "./dto/create-ministry.dto";
import { UpdateMinistryDto } from "./dto/update-ministry.dto";

const ministrySelect = {
  id: true,
  churchId: true,
  nome: true,
  descricao: true,
  leaderId: true,
  createdAt: true,
  updatedAt: true,
  leader: { select: USER_PUBLIC_SELECT },
  members: { select: USER_PUBLIC_SELECT },
} as const;

@Injectable()
export class MinistriesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureUsersExist(ids: string[], churchId: string) {
    if (ids.length === 0) return;

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, ativo: true, churchId },
      select: { id: true },
    });

    if (users.length !== ids.length) {
      throw new NotFoundException(
        "Um ou mais usuários informados não existem, estão inativos ou pertencem a outra igreja.",
      );
    }
  }

  private async ensureLeaderEligible(leaderId: string, churchId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: leaderId, ativo: true, churchId },
      select: { id: true, perfil: true },
    });

    if (!user) {
      throw new NotFoundException(
        "Usuário não encontrado, está inativo ou pertence a outra igreja.",
      );
    }

    if (user.perfil !== Perfil.LEADER) {
      throw new BadRequestException(
        "O usuário selecionado não possui o perfil LEADER. Apenas usuários com perfil LEADER podem ser líderes de ministério.",
      );
    }
  }

  async create(dto: CreateMinistryDto, user: JwtPayload) {
    const churchId = getChurchIdOrThrow(user);
    const memberIds = dto.memberIds ?? [];

    const duplicate = await this.prisma.ministry.findUnique({
      where: {
        churchId_nome: {
          churchId,
          nome: dto.nome,
        },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new BadRequestException(
        "Já existe um ministério com este nome nesta igreja.",
      );
    }

    await this.ensureUsersExist(memberIds, churchId);

    if (dto.leaderId) {
      await this.ensureLeaderEligible(dto.leaderId, churchId);
    }

    return this.prisma.ministry.create({
      data: {
        churchId,
        nome: dto.nome,
        descricao: dto.descricao,
        leaderId: dto.leaderId,
        members: {
          connect: memberIds.map((id) => ({ id })),
        },
      },
      select: ministrySelect,
    });
  }

  async findAllVisible(user: JwtPayload) {
    const churchId = getChurchIdOrThrow(user);

    if (isChurchAdmin(user)) {
      return this.prisma.ministry.findMany({
        where: { churchId },
        orderBy: { nome: "asc" },
        select: ministrySelect,
      });
    }

    return this.prisma.ministry.findMany({
      where: {
        churchId,
        OR: [{ leaderId: user.sub }, { members: { some: { id: user.sub } } }],
      },
      orderBy: { nome: "asc" },
      select: ministrySelect,
    });
  }

  async findAll(user: JwtPayload) {
    const churchId = getChurchIdOrThrow(user);

    return this.prisma.ministry.findMany({
      where: { churchId },
      orderBy: { nome: "asc" },
      select: ministrySelect,
    });
  }

  async findByIdForUser(id: string, user: JwtPayload) {
    const churchId = getChurchIdOrThrow(user);

    if (isChurchAdmin(user)) {
      const ministry = await this.prisma.ministry.findFirst({
        where: { id, churchId },
        select: ministrySelect,
      });

      if (!ministry) {
        throw new NotFoundException("Ministério não encontrado.");
      }

      return ministry;
    }

    const ministry = await this.prisma.ministry.findFirst({
      where: {
        id,
        churchId,
        OR: [{ leaderId: user.sub }, { members: { some: { id: user.sub } } }],
      },
      select: ministrySelect,
    });

    if (!ministry) {
      throw new ForbiddenException("Você não possui acesso a este ministério.");
    }

    return ministry;
  }

  async update(id: string, dto: UpdateMinistryDto, user: JwtPayload) {
    const churchId = getChurchIdOrThrow(user);

    const existing = await this.prisma.ministry.findFirst({
      where: { id, churchId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException("Ministério não encontrado.");
    }

    if (dto.leaderId !== undefined && dto.leaderId !== null) {
      await this.ensureLeaderEligible(dto.leaderId, churchId);
    }

    if (dto.memberIds) {
      await this.ensureUsersExist(dto.memberIds, churchId);
    }

    return this.prisma.ministry.update({
      where: { id },
      data: {
        nome: dto.nome,
        descricao: dto.descricao,
        leaderId: dto.leaderId === null ? null : dto.leaderId,
        members:
          dto.memberIds !== undefined
            ? {
                set: dto.memberIds.map((memberId) => ({ id: memberId })),
              }
            : undefined,
      },
      select: ministrySelect,
    });
  }

  async remove(id: string, user: JwtPayload) {
    const churchId = getChurchIdOrThrow(user);

    const existing = await this.prisma.ministry.findFirst({
      where: { id, churchId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException("Ministério não encontrado.");
    }

    return this.prisma.ministry.delete({
      where: { id },
      select: ministrySelect,
    });
  }

  async createInitialMinistries(user: JwtPayload) {
    const churchId = getChurchIdOrThrow(user);
    const names = ["Foto", "Vídeo", "Projeção", "Iluminação", "Transmissão"];

    for (const name of names) {
      const existing = await this.prisma.ministry.findFirst({
        where: { nome: name, churchId },
        select: { id: true },
      });

      if (!existing) {
        await this.prisma.ministry.create({
          data: {
            nome: name,
            descricao: `Ministério de ${name}`,
            churchId,
          },
        });
      }
    }

    return this.findAll(user);
  }
}
