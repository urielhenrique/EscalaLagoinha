import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Perfil, Prisma } from "@prisma/client";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { toJsonValue } from "../common/utils/json";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import { ChangeAdminRoleDto } from "./dto/change-admin-role.dto";
import { CreateInviteLinkDto } from "./dto/create-invite-link.dto";
import { CreateChurchDto } from "./dto/create-church.dto";
import { UpdateChurchSettingsDto } from "./dto/update-church-settings.dto";

@Injectable()
export class ChurchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly email: EmailService,
  ) {}

  async listVisible(actor: JwtPayload) {
    if (this.isPlatformAdmin(actor)) {
      return this.prisma.church.findMany({
        orderBy: { createdAt: "asc" },
        include: {
          settings: true,
          subscription: true,
          _count: {
            select: {
              users: true,
              ministries: true,
              events: true,
              schedules: true,
            },
          },
        },
      });
    }

    if (!actor.churchId) {
      return [];
    }

    const church = await this.prisma.church.findUnique({
      where: { id: actor.churchId },
      include: {
        settings: true,
        subscription: true,
        _count: {
          select: {
            users: true,
            ministries: true,
            events: true,
            schedules: true,
          },
        },
      },
    });

    return church ? [church] : [];
  }

  async getCurrent(actor: JwtPayload) {
    if (!actor.churchId) {
      throw new NotFoundException("Usuário não vinculado a nenhuma igreja.");
    }

    const church = await this.prisma.church.findUnique({
      where: { id: actor.churchId },
      include: {
        settings: true,
        subscription: true,
      },
    });

    if (!church) {
      throw new NotFoundException("Igreja não encontrada.");
    }

    return church;
  }

  async createChurch(dto: CreateChurchDto, actor: JwtPayload) {
    this.assertPlatformAdmin(actor);

    const created = await this.prisma.church.create({
      data: {
        nome: dto.nome,
        slug: dto.slug,
        endereco: dto.endereco,
        cidade: dto.cidade,
        estado: dto.estado,
        logo: dto.logo,
        responsavelPrincipal: dto.responsavelPrincipal,
        settings: {
          create: {},
        },
        subscription: {
          create: {
            status: "TRIAL",
            planName: "STARTER",
          },
        },
      },
      include: {
        settings: true,
        subscription: true,
      },
    });

    await this.auditLogsService.log({
      userId: actor.sub,
      churchId: created.id,
      action: "CHURCH_CREATED",
      module: "CHURCHES",
      targetId: created.id,
      newValue: toJsonValue(created),
    });

    return created;
  }

  async updateCurrentSettings(dto: UpdateChurchSettingsDto, actor: JwtPayload) {
    if (!actor.churchId) {
      throw new NotFoundException("Usuário não vinculado a nenhuma igreja.");
    }

    const existing = await this.prisma.churchSettings.findUnique({
      where: { churchId: actor.churchId },
    });

    const createData: Prisma.ChurchSettingsUncheckedCreateInput = {
      churchId: actor.churchId,
      customChurchName: dto.customChurchName,
      customPlatformName: dto.customPlatformName,
      logoUrl: dto.logoUrl,
      primaryColor: dto.primaryColor,
      secondaryColor: dto.secondaryColor,
      accentColor: dto.accentColor,
      defaultEmailFrom: dto.defaultEmailFrom,
      approvalPolicy: dto.approvalPolicy,
      reminderLeadMinutes: dto.reminderLeadMinutes,
      customDomain: dto.customDomain,
      swapRules:
        dto.swapRules !== undefined ? toJsonValue(dto.swapRules) : undefined,
      scoreRules:
        dto.scoreRules !== undefined ? toJsonValue(dto.scoreRules) : undefined,
      defaultServiceDays:
        dto.defaultServiceDays !== undefined
          ? toJsonValue(dto.defaultServiceDays)
          : undefined,
    };

    const updateData: Prisma.ChurchSettingsUncheckedUpdateInput = {
      customChurchName: dto.customChurchName,
      customPlatformName: dto.customPlatformName,
      logoUrl: dto.logoUrl,
      primaryColor: dto.primaryColor,
      secondaryColor: dto.secondaryColor,
      accentColor: dto.accentColor,
      defaultEmailFrom: dto.defaultEmailFrom,
      approvalPolicy: dto.approvalPolicy,
      reminderLeadMinutes: dto.reminderLeadMinutes,
      customDomain: dto.customDomain,
      swapRules:
        dto.swapRules !== undefined ? toJsonValue(dto.swapRules) : undefined,
      scoreRules:
        dto.scoreRules !== undefined ? toJsonValue(dto.scoreRules) : undefined,
      defaultServiceDays:
        dto.defaultServiceDays !== undefined
          ? toJsonValue(dto.defaultServiceDays)
          : undefined,
    };

    const updated = await this.prisma.churchSettings.upsert({
      where: { churchId: actor.churchId },
      create: createData,
      update: updateData,
    });

    await this.auditLogsService.log({
      userId: actor.sub,
      churchId: actor.churchId,
      action: "CHURCH_SETTINGS_UPDATED",
      module: "CHURCHES",
      targetId: actor.churchId,
      oldValue: existing ? toJsonValue(existing) : undefined,
      newValue: toJsonValue(updated),
    });

    return updated;
  }

  async createInviteLink(dto: CreateInviteLinkDto, actor: JwtPayload) {
    if (!actor.churchId) {
      throw new NotFoundException("Usuário não vinculado a nenhuma igreja.");
    }

    const church = await this.prisma.church.findUnique({
      where: { id: actor.churchId },
      select: { id: true, nome: true, slug: true },
    });

    if (!church) {
      throw new NotFoundException("Igreja não encontrada.");
    }

    const baseUrl =
      process.env.FRONTEND_URL ??
      process.env.APP_URL ??
      "http://localhost:5173";
    const params = new URLSearchParams({ church: church.slug });

    if (dto.ministryName) {
      params.set("ministry", dto.ministryName);
    }

    const inviteResult = {
      churchId: church.id,
      churchName: church.nome,
      inviteUrl: `${baseUrl}/convite?${params.toString()}`,
    };

    const recipients = await this.prisma.user.findMany({
      where: {
        churchId: church.id,
        ativo: true,
        perfil: { in: [Perfil.MASTER_ADMIN, Perfil.ADMIN] },
      },
      select: { email: true, nome: true },
    });

    const uniqueRecipients = Array.from(
      new Map(
        recipients
          .filter((user) => Boolean(user.email))
          .map((user) => [user.email, user]),
      ).values(),
    );

    void Promise.allSettled(
      uniqueRecipients.map((recipient) =>
        this.email.sendConviteCadastro({
          to: recipient.email,
          nome: recipient.nome,
          inviteUrl: inviteResult.inviteUrl,
          churchName: church.nome,
        }),
      ),
    );

    return inviteResult;
  }

  async listChurchAdmins(churchId: string, actor: JwtPayload) {
    this.assertCanManageChurch(churchId, actor);

    return this.prisma.user.findMany({
      where: {
        churchId,
        perfil: { in: [Perfil.ADMIN, Perfil.MASTER_ADMIN, Perfil.VOLUNTARIO] },
        ativo: true,
      },
      orderBy: [{ perfil: "desc" }, { nome: "asc" }],
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        status: true,
        ativo: true,
        churchId: true,
      },
    });
  }

  async changeAdminRole(
    churchId: string,
    userId: string,
    dto: ChangeAdminRoleDto,
    actor: JwtPayload,
  ) {
    this.assertCanManageChurch(churchId, actor);

    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nome: true,
        perfil: true,
        churchId: true,
      },
    });

    if (!target || target.churchId !== churchId) {
      throw new NotFoundException("Usuário da igreja não encontrado.");
    }

    if (
      target.id === actor.sub &&
      target.perfil === Perfil.MASTER_ADMIN &&
      dto.perfil !== Perfil.MASTER_ADMIN
    ) {
      throw new ForbiddenException(
        "Você não pode remover seu próprio perfil Master Admin.",
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: { perfil: dto.perfil },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        status: true,
        ativo: true,
        churchId: true,
      },
    });

    await this.auditLogsService.log({
      userId: actor.sub,
      churchId,
      action: "CHURCH_ADMIN_ROLE_CHANGED",
      module: "CHURCHES",
      targetId: target.id,
      oldValue: toJsonValue(target),
      newValue: toJsonValue(updated),
    });

    if (
      updated.perfil === Perfil.ADMIN ||
      updated.perfil === Perfil.MASTER_ADMIN
    ) {
      const church = await this.prisma.church.findUnique({
        where: { id: churchId },
        select: { nome: true },
      });

      const masterAdmins = await this.prisma.user.findMany({
        where: {
          churchId,
          ativo: true,
          perfil: { in: [Perfil.MASTER_ADMIN, Perfil.MASTER_PLATFORM_ADMIN] },
        },
        select: { email: true, nome: true },
      });

      void Promise.allSettled(
        masterAdmins
          .filter((admin) => Boolean(admin.email))
          .map((admin) =>
            this.email.sendNovoLiderCriado({
              to: admin.email,
              masterAdminNome: admin.nome,
              leaderNome: updated.nome,
              leaderEmail: updated.email,
              churchName: church?.nome,
            }),
          ),
      );
    }

    return updated;
  }

  private isPlatformAdmin(actor: JwtPayload) {
    return actor.perfil === Perfil.MASTER_PLATFORM_ADMIN;
  }

  private assertPlatformAdmin(actor: JwtPayload) {
    if (!this.isPlatformAdmin(actor)) {
      throw new ForbiddenException(
        "Somente MASTER_PLATFORM_ADMIN pode criar igrejas.",
      );
    }
  }

  private assertCanManageChurch(churchId: string, actor: JwtPayload) {
    if (this.isPlatformAdmin(actor)) {
      return;
    }

    if (!actor.churchId || actor.churchId !== churchId) {
      throw new ForbiddenException("Acesso negado: igreja fora do seu escopo.");
    }

    if (actor.perfil !== Perfil.MASTER_ADMIN && actor.perfil !== Perfil.ADMIN) {
      throw new ForbiddenException(
        "Somente administradores podem gerenciar esta igreja.",
      );
    }
  }
}
