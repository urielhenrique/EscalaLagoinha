import { ForbiddenException } from "@nestjs/common";
import { Perfil } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtPayload } from "../strategies/jwt.strategy";

export function isGlobalAdmin(user: JwtPayload): boolean {
  return (
    user.perfil === Perfil.MASTER_PLATFORM_ADMIN ||
    user.perfil === Perfil.MASTER_ADMIN
  );
}

export function isChurchAdmin(user: JwtPayload): boolean {
  return (
    user.perfil === Perfil.ADMIN ||
    user.perfil === Perfil.MASTER_ADMIN ||
    user.perfil === Perfil.MASTER_PLATFORM_ADMIN
  );
}

export function isLeader(user: JwtPayload): boolean {
  return user.perfil === Perfil.LEADER;
}

export function getChurchIdOrThrow(user: JwtPayload): string {
  if (!user.churchId) {
    throw new ForbiddenException(
      "Acesso negado: usuário sem igreja vinculada.",
    );
  }
  return user.churchId;
}

export async function assertLeaderOfMinistry(
  prisma: PrismaService,
  userId: string,
  ministryId: string,
  churchId: string,
): Promise<void> {
  const ministry = await prisma.ministry.findFirst({
    where: {
      id: ministryId,
      churchId,
    },
    select: { id: true, leaderId: true },
  });

  if (!ministry) {
    throw new ForbiddenException(
      "Acesso negado: ministério não encontrado nesta igreja.",
    );
  }

  if (ministry.leaderId !== userId) {
    throw new ForbiddenException(
      "Acesso negado: você não é líder deste ministério.",
    );
  }
}

export async function getLeaderMinistryIds(
  prisma: PrismaService,
  userId: string,
  churchId: string,
): Promise<string[]> {
  const ministries = await prisma.ministry.findMany({
    where: {
      leaderId: userId,
      churchId,
    },
    select: { id: true },
  });

  return ministries.map((m) => m.id);
}
