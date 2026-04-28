import { Injectable, NotFoundException } from "@nestjs/common";
import { NotificationType, Perfil, ScheduleStatus } from "@prisma/client";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";

const notificationSelect = {
  id: true,
  userId: true,
  churchId: true,
  titulo: true,
  mensagem: true,
  tipo: true,
  lida: true,
  createdAt: true,
} as const;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  private getChurchIdOrThrow(user: JwtPayload) {
    if (!user.churchId) {
      throw new NotFoundException("Usuário sem igreja vinculada.");
    }

    return user.churchId;
  }

  async createNotification(params: {
    userId: string;
    churchId?: string;
    titulo: string;
    mensagem: string;
    tipo: NotificationType;
    sendEmail?: boolean;
    ctaUrl?: string;
    ctaLabel?: string;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        churchId: params.churchId,
        titulo: params.titulo,
        mensagem: params.mensagem,
        tipo: params.tipo,
      },
      select: notificationSelect,
    });

    if (params.sendEmail !== false) {
      const user = await this.prisma.user.findUnique({
        where: { id: params.userId },
        select: { email: true, nome: true, telefone: true },
      });

      if (user?.email) {
        await this.email.sendGenericNotification({
          to: user.email,
          nome: user.nome,
          title: params.titulo,
          message: params.mensagem,
          ctaUrl: params.ctaUrl,
          ctaLabel: params.ctaLabel,
        });
      }
    }

    return notification;
  }

  async notifyScaleCreated(params: {
    volunteerId: string;
    churchId?: string;
    eventName: string;
    eventDateTimeLabel: string;
  }) {
    return this.createNotification({
      userId: params.volunteerId,
      churchId: params.churchId,
      titulo: "Nova escala criada",
      mensagem: `Você foi escalado para ${params.eventName} em ${params.eventDateTimeLabel}.`,
      tipo: NotificationType.SCALE_CREATED,
      sendEmail: true,
      ctaUrl: `${process.env.APP_URL ?? "http://localhost:5173"}/minhas-escalas`,
      ctaLabel: "Ver minhas escalas",
    });
  }

  async notifyScaleCancelled(params: {
    volunteerId: string;
    churchId?: string;
    eventName: string;
    eventDateTimeLabel: string;
  }) {
    return this.createNotification({
      userId: params.volunteerId,
      churchId: params.churchId,
      titulo: "Escala cancelada",
      mensagem: `Sua escala de ${params.eventName} em ${params.eventDateTimeLabel} foi cancelada.`,
      tipo: NotificationType.SCALE_CANCELLED,
      sendEmail: true,
    });
  }

  async notifySwapRequest(params: {
    requestedVolunteerId: string;
    churchId?: string;
    requesterName: string;
    eventName: string;
  }) {
    return this.createNotification({
      userId: params.requestedVolunteerId,
      churchId: params.churchId,
      titulo: "Nova solicitação de troca",
      mensagem: `${params.requesterName} solicitou uma troca de escala com você (${params.eventName}).`,
      tipo: NotificationType.SWAP_REQUEST,
      sendEmail: true,
      ctaUrl: `${process.env.APP_URL ?? "http://localhost:5173"}/trocas/recebidas`,
      ctaLabel: "Avaliar solicitação",
    });
  }

  async notifySwapApproved(params: {
    requesterId: string;
    churchId?: string;
    requestedVolunteerName: string;
  }) {
    return this.createNotification({
      userId: params.requesterId,
      churchId: params.churchId,
      titulo: "Troca aprovada",
      mensagem: `Sua solicitação de troca foi aprovada por ${params.requestedVolunteerName}.`,
      tipo: NotificationType.SWAP_APPROVED,
      sendEmail: true,
    });
  }

  async notifySwapDeclined(params: {
    requesterId: string;
    churchId?: string;
    requestedVolunteerName: string;
  }) {
    return this.createNotification({
      userId: params.requesterId,
      churchId: params.churchId,
      titulo: "Troca recusada",
      mensagem: `${params.requestedVolunteerName} recusou sua solicitação de troca.`,
      tipo: NotificationType.SWAP_DECLINED,
      sendEmail: true,
    });
  }

  async notifySwapAutoCompletedToLeader(params: {
    ministryId: string;
    requesterName: string;
    requestedVolunteerName: string;
    requesterEventName: string;
    requestedEventName: string;
  }) {
    const ministry = await this.prisma.ministry.findUnique({
      where: { id: params.ministryId },
      select: { id: true, nome: true, leaderId: true, churchId: true },
    });

    if (!ministry) return;

    if (ministry.leaderId) {
      await this.createNotification({
        userId: ministry.leaderId,
        churchId: ministry.churchId ?? undefined,
        titulo: "Troca automática concluída",
        mensagem: `A troca de escala no ministério ${ministry.nome} foi concluída automaticamente entre ${params.requesterName} e ${params.requestedVolunteerName}.`,
        tipo: NotificationType.SWAP_APPROVED,
        sendEmail: true,
      });
      return;
    }

    const admins = await this.prisma.user.findMany({
      where: {
        churchId: ministry.churchId,
        perfil: { in: [Perfil.ADMIN, Perfil.MASTER_ADMIN] },
        ativo: true,
      },
      select: { id: true },
      take: 5,
    });

    for (const admin of admins) {
      await this.createNotification({
        userId: admin.id,
        churchId: ministry.churchId ?? undefined,
        titulo: "Troca automática concluída",
        mensagem: `Troca automática registrada em ${ministry.nome}: ${params.requesterName} (${params.requesterEventName}) ↔ ${params.requestedVolunteerName} (${params.requestedEventName}).`,
        tipo: NotificationType.SWAP_APPROVED,
        sendEmail: true,
      });
    }
  }

  async runRemindersForUpcomingSchedules(hoursAhead = 24, actor?: JwtPayload) {
    const now = new Date();
    const start = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const churchId = actor ? this.getChurchIdOrThrow(actor) : undefined;

    const schedules = await this.prisma.schedule.findMany({
      where: {
        churchId: churchId ?? { not: null },
        status: { in: [ScheduleStatus.CONFIRMADO, ScheduleStatus.PENDENTE] },
        event: {
          dataInicio: {
            gte: start,
            lte: end,
          },
        },
      },
      select: {
        id: true,
        churchId: true,
        volunteerId: true,
        volunteer: {
          select: { nome: true },
        },
        event: {
          select: {
            id: true,
            nome: true,
            dataInicio: true,
          },
        },
      },
    });

    let sentCount = 0;

    for (const schedule of schedules) {
      const title = "Lembrete de escala";
      const message = `Seu culto/evento ${schedule.event.nome} será amanhã. Confira sua escala.`;

      const duplicate = await this.prisma.notification.findFirst({
        where: {
          userId: schedule.volunteerId,
          tipo: NotificationType.REMINDER,
          titulo: title,
          mensagem: message,
          createdAt: {
            gte: new Date(now.getTime() - 20 * 60 * 60 * 1000),
          },
        },
        select: { id: true },
      });

      if (duplicate) {
        continue;
      }

      await this.createNotification({
        userId: schedule.volunteerId,
        churchId: schedule.churchId ?? undefined,
        titulo: title,
        mensagem: message,
        tipo: NotificationType.REMINDER,
        sendEmail: true,
      });
      sentCount += 1;
    }

    return {
      startWindow: start,
      endWindow: end,
      scanned: schedules.length,
      sent: sentCount,
    };
  }

  async listForUser(user: JwtPayload, unreadOnly?: boolean) {
    const churchId = this.getChurchIdOrThrow(user);
    return this.prisma.notification.findMany({
      where: {
        userId: user.sub,
        churchId,
        lida: unreadOnly ? false : undefined,
      },
      orderBy: [{ createdAt: "desc" }],
      select: notificationSelect,
    });
  }

  async getUnreadCount(user: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(user);
    const count = await this.prisma.notification.count({
      where: {
        userId: user.sub,
        churchId,
        lida: false,
      },
    });

    return { count };
  }

  async markAsRead(id: string, user: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(user);
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true, churchId: true },
    });

    if (
      !notification ||
      notification.userId !== user.sub ||
      notification.churchId !== churchId
    ) {
      throw new NotFoundException("Notificação não encontrada.");
    }

    return this.prisma.notification.update({
      where: { id },
      data: { lida: true },
      select: notificationSelect,
    });
  }

  async markAllAsRead(user: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(user);
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.sub, churchId, lida: false },
      data: { lida: true },
    });

    return { updated: result.count };
  }

  async remove(id: string, user: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(user);
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true, churchId: true },
    });

    if (
      !notification ||
      notification.userId !== user.sub ||
      notification.churchId !== churchId
    ) {
      throw new NotFoundException("Notificação não encontrada.");
    }

    return this.prisma.notification.delete({
      where: { id },
      select: notificationSelect,
    });
  }
}
