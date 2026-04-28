import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { NotificationType, Perfil, Prisma, UserStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { toJsonValue } from "../common/utils/json";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

export const USER_PUBLIC_SELECT = {
  id: true,
  nome: true,
  email: true,
  telefone: true,
  foto: true,
  perfil: true,
  status: true,
  ativo: true,
  churchId: true,
  church: {
    select: {
      id: true,
      nome: true,
      slug: true,
    },
  },
  createdAt: true,
} as const;

type UserListFilters = {
  ativo?: boolean;
  perfil?: Perfil;
  status?: UserStatus;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(
    dto: CreateUserDto,
    options: { status?: UserStatus } = {},
    actor?: JwtPayload,
  ) {
    if (
      actor &&
      actor.perfil !== Perfil.MASTER_PLATFORM_ADMIN &&
      dto.churchId &&
      dto.churchId !== actor.churchId
    ) {
      throw new ForbiddenException(
        "Acesso negado: não é permitido criar usuário em outra igreja.",
      );
    }

    if (actor && dto.perfil === Perfil.ADMIN && !this.isMasterAdmin(actor)) {
      throw new ForbiddenException(
        "Somente MASTER_ADMIN ou MASTER_PLATFORM_ADMIN pode criar usuário ADMIN.",
      );
    }

    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (exists) {
      throw new ConflictException("E-mail já cadastrado.");
    }

    const senha = await bcrypt.hash(dto.senha, 10);

    const created = await this.prisma.user.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        senha,
        telefone: dto.telefone,
        foto: dto.foto,
        perfil: dto.perfil,
        status: options.status ?? UserStatus.ATIVO,
        ativo: (options.status ?? UserStatus.ATIVO) === UserStatus.ATIVO,
        churchId: dto.churchId ?? actor?.churchId,
      },
      select: USER_PUBLIC_SELECT,
    });

    if (actor) {
      this.logger.warn(
        `Criação de usuário por actor=${actor.sub} perfilNovo=${created.perfil} target=${created.id}`,
      );
      await this.auditLogsService.log({
        userId: actor.sub,
        action: "USER_CREATED",
        module: "USERS",
        targetId: created.id,
        churchId: created.churchId ?? undefined,
        newValue: toJsonValue(created),
      });
    }

    if (
      created.churchId &&
      (created.perfil === Perfil.ADMIN ||
        created.perfil === Perfil.MASTER_ADMIN)
    ) {
      const masterAdmins = await this.prisma.user.findMany({
        where: {
          churchId: created.churchId,
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
              leaderNome: created.nome,
              leaderEmail: created.email,
              churchName: created.church?.nome,
            }),
          ),
      );
    }

    return created;
  }

  async findAll(filters: UserListFilters = {}, actor?: JwtPayload) {
    const churchScope = this.buildChurchScope(actor);

    return this.prisma.user.findMany({
      where: {
        ativo: filters.ativo,
        perfil: filters.perfil,
        status: filters.status,
        ...churchScope,
      },
      orderBy: { createdAt: "desc" },
      select: USER_PUBLIC_SELECT,
    });
  }

  async findPending(actor?: JwtPayload) {
    const churchScope = this.buildChurchScope(actor);

    return this.prisma.user.findMany({
      where: { status: UserStatus.PENDENTE, ...churchScope },
      orderBy: { createdAt: "asc" },
      select: USER_PUBLIC_SELECT,
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findPublicById(id: string, actor?: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_PUBLIC_SELECT,
    });

    if (!user) {
      throw new NotFoundException("Usuário não encontrado.");
    }

    this.assertSameChurch(user.churchId ?? undefined, actor);

    return user;
  }

  async approve(id: string, actor: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        email: true,
        status: true,
        churchId: true,
      },
    });

    if (!user) throw new NotFoundException("Usuário não encontrado.");
    this.assertSameChurch(user.churchId ?? undefined, actor);
    if (user.status !== UserStatus.PENDENTE) {
      throw new ForbiddenException("Usuário não está pendente de aprovação.");
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ATIVO, ativo: true },
      select: USER_PUBLIC_SELECT,
    });

    // Notificação in-app
    await this.prisma.notification.create({
      data: {
        userId: id,
        churchId: user.churchId ?? undefined,
        titulo: "Conta aprovada!",
        mensagem:
          "Seu cadastro foi aprovado. Bem-vindo(a) à equipe de voluntários!",
        tipo: NotificationType.USER_APPROVED,
      },
    });

    // Email
    void this.email.sendCadastroAprovado(user.email, user.nome);

    await this.auditLogsService.log({
      userId: actor.sub,
      action: "USER_APPROVED",
      module: "USERS",
      targetId: id,
      churchId: user.churchId ?? undefined,
      oldValue: toJsonValue(user),
      newValue: toJsonValue(updated),
    });

    return updated;
  }

  async reject(id: string, actor: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        email: true,
        status: true,
        churchId: true,
      },
    });

    if (!user) throw new NotFoundException("Usuário não encontrado.");
    this.assertSameChurch(user.churchId ?? undefined, actor);
    if (user.status !== UserStatus.PENDENTE) {
      throw new ForbiddenException("Usuário não está pendente de aprovação.");
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.INATIVO, ativo: false },
      select: USER_PUBLIC_SELECT,
    });

    // Notificação in-app
    await this.prisma.notification.create({
      data: {
        userId: id,
        churchId: user.churchId ?? undefined,
        titulo: "Cadastro não aprovado",
        mensagem:
          "Seu cadastro não foi aprovado. Entre em contato com o líder do ministério.",
        tipo: NotificationType.USER_REJECTED,
      },
    });

    // Email
    void this.email.sendCadastroRecusado(user.email, user.nome);

    await this.auditLogsService.log({
      userId: actor.sub,
      action: "USER_REJECTED",
      module: "USERS",
      targetId: id,
      churchId: user.churchId ?? undefined,
      oldValue: toJsonValue(user),
      newValue: toJsonValue(updated),
    });

    return updated;
  }

  async update(id: string, dto: UpdateUserDto, actor: JwtPayload) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException("Usuário não encontrado.");
    }

    this.assertSameChurch(user.churchId ?? undefined, actor);

    if (
      (dto.perfil !== undefined || dto.ativo !== undefined) &&
      !this.isMasterAdmin(actor)
    ) {
      throw new ForbiddenException(
        "Somente MASTER_ADMIN ou MASTER_PLATFORM_ADMIN pode alterar perfil/permissões.",
      );
    }

    if (
      dto.perfil === Perfil.MASTER_PLATFORM_ADMIN &&
      !this.isPlatformAdmin(actor)
    ) {
      throw new ForbiddenException(
        "Somente MASTER_PLATFORM_ADMIN pode conceder perfil MASTER_PLATFORM_ADMIN.",
      );
    }

    if (dto.email && dto.email !== user.email) {
      const emailInUse = await this.prisma.user.findUnique({
        where: { email: dto.email },
        select: { id: true },
      });

      if (emailInUse) {
        throw new ConflictException("E-mail já cadastrado.");
      }
    }

    const data: Prisma.UserUpdateInput = {
      nome: dto.nome,
      email: dto.email,
      telefone: dto.telefone,
      foto: dto.foto,
      perfil: dto.perfil,
      ativo: dto.ativo,
    };

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: USER_PUBLIC_SELECT,
    });

    await this.auditLogsService.log({
      userId: actor.sub,
      action: "USER_UPDATED",
      module: "USERS",
      targetId: id,
      churchId: user.churchId ?? undefined,
      oldValue: toJsonValue(user),
      newValue: toJsonValue(updated),
    });

    if (dto.perfil !== undefined || dto.ativo !== undefined) {
      this.logger.warn(
        `Alteração sensível de usuário actor=${actor.sub} target=${id} perfil=${dto.perfil ?? "-"} ativo=${dto.ativo ?? "-"}`,
      );

      if (
        updated.churchId &&
        (updated.perfil === Perfil.ADMIN ||
          updated.perfil === Perfil.MASTER_ADMIN)
      ) {
        const masterAdmins = await this.prisma.user.findMany({
          where: {
            churchId: updated.churchId,
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
                churchName: updated.church?.nome,
              }),
            ),
        );
      }
    }

    return updated;
  }

  async deactivate(id: string, actor: JwtPayload) {
    if (!this.isMasterAdmin(actor)) {
      throw new ForbiddenException(
        "Somente MASTER_ADMIN ou MASTER_PLATFORM_ADMIN pode desativar usuários.",
      );
    }

    const exists = await this.prisma.user.findUnique({
      where: { id },
      select: USER_PUBLIC_SELECT,
    });

    if (!exists) {
      throw new NotFoundException("Usuário não encontrado.");
    }

    this.assertSameChurch(exists.churchId ?? undefined, actor);

    const deactivated = await this.prisma.user.update({
      where: { id },
      data: { ativo: false, status: UserStatus.INATIVO },
      select: USER_PUBLIC_SELECT,
    });

    await this.auditLogsService.log({
      userId: actor.sub,
      action: "USER_DEACTIVATED",
      module: "USERS",
      targetId: id,
      churchId: exists.churchId ?? undefined,
      oldValue: toJsonValue(exists),
      newValue: toJsonValue(deactivated),
    });

    this.logger.warn(`Usuário desativado actor=${actor.sub} target=${id}`);

    return deactivated;
  }

  private isPlatformAdmin(actor?: JwtPayload) {
    return actor?.perfil === Perfil.MASTER_PLATFORM_ADMIN;
  }

  private isMasterAdmin(actor?: JwtPayload) {
    return (
      actor?.perfil === Perfil.MASTER_ADMIN ||
      actor?.perfil === Perfil.MASTER_PLATFORM_ADMIN
    );
  }

  private buildChurchScope(actor?: JwtPayload) {
    if (!actor || this.isPlatformAdmin(actor)) {
      return {};
    }

    return { churchId: actor.churchId };
  }

  private assertSameChurch(
    targetChurchId: string | undefined,
    actor?: JwtPayload,
  ) {
    if (!actor || this.isPlatformAdmin(actor)) {
      return;
    }

    if (!targetChurchId || targetChurchId !== actor.churchId) {
      throw new ForbiddenException(
        "Acesso negado: recurso pertence a outra igreja.",
      );
    }
  }
}
