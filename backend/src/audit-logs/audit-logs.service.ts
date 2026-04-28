import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type CreateAuditLogInput = {
  userId?: string;
  churchId?: string;
  action: string;
  module: string;
  targetId?: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
};

type ListAuditLogsFilters = {
  userId?: string;
  churchId?: string;
  action?: string;
  module?: string;
  search?: string;
  targetId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
};

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: CreateAuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        churchId: input.churchId,
        action: input.action,
        module: input.module,
        targetId: input.targetId,
        oldValue: input.oldValue,
        newValue: input.newValue,
      },
    });
  }

  async list(filters: ListAuditLogsFilters) {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);

    return this.prisma.auditLog.findMany({
      where: {
        userId: filters.userId,
        churchId: filters.churchId,
        action: filters.action
          ? { contains: filters.action, mode: "insensitive" }
          : undefined,
        module: filters.module
          ? { contains: filters.module, mode: "insensitive" }
          : undefined,
        targetId: filters.targetId
          ? { contains: filters.targetId, mode: "insensitive" }
          : undefined,
        OR: filters.search
          ? [
              { action: { contains: filters.search, mode: "insensitive" } },
              { module: { contains: filters.search, mode: "insensitive" } },
              { targetId: { contains: filters.search, mode: "insensitive" } },
              {
                user: {
                  nome: { contains: filters.search, mode: "insensitive" },
                },
              },
              {
                user: {
                  email: { contains: filters.search, mode: "insensitive" },
                },
              },
            ]
          : undefined,
        createdAt:
          filters.from || filters.to
            ? {
                gte: filters.from,
                lte: filters.to,
              }
            : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            nome: true,
            email: true,
            perfil: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
