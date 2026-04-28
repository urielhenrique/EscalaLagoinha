import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { NotificationType, Perfil, UserStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { OnboardingChurchDto } from "./dto/onboarding-church.dto";
import { PasswordResetService } from "./password-reset.service";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { UpdateMeDto } from "./dto/update-me.dto";
import { JwtPayload } from "./strategies/jwt.strategy";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (exists) {
      throw new BadRequestException("E-mail já cadastrado.");
    }

    const church = await this.resolveRegistrationChurch(dto.churchSlug);

    const senha = await bcrypt.hash(dto.senha, 10);

    const user = await this.prisma.user.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        senha,
        telefone: dto.telefone,
        foto: dto.foto,
        perfil: Perfil.VOLUNTARIO,
        status: UserStatus.PENDENTE,
        ativo: false,
        churchId: church.id,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        status: true,
        perfil: true,
      },
    });

    // Notifica admin responsável (ou MASTER_ADMIN se não houver)
    void this.notifyAdminsNewVolunteer(user.nome, user.email, church.id);

    // Email de boas-vindas ao voluntário
    void this.email.sendCadastroPendenteVoluntario(dto.email, dto.nome);

    return {
      message: "Cadastro realizado! Aguarde a aprovação do líder responsável.",
      status: UserStatus.PENDENTE,
    };
  }

  async onboardChurch(dto: OnboardingChurchDto) {
    const existingChurch = await this.prisma.church.findUnique({
      where: { slug: dto.churchSlug },
      select: { id: true },
    });

    if (existingChurch) {
      throw new BadRequestException("Já existe uma igreja com este slug.");
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail },
      select: { id: true },
    });

    if (existingUser) {
      throw new BadRequestException("E-mail do administrador já cadastrado.");
    }

    const passwordHash = await bcrypt.hash(dto.adminPassword, 10);

    const created = await this.prisma.$transaction(async (tx) => {
      const church = await tx.church.create({
        data: {
          nome: dto.churchName,
          slug: dto.churchSlug,
          endereco: dto.churchAddress,
          cidade: dto.churchCity,
          estado: dto.churchState,
          responsavelPrincipal: dto.responsibleName,
          settings: { create: {} },
          subscription: {
            create: {
              status: "TRIAL",
              planName: "STARTER",
              trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            },
          },
        },
        select: {
          id: true,
          nome: true,
          slug: true,
        },
      });

      const user = await tx.user.create({
        data: {
          nome: dto.adminName,
          email: dto.adminEmail,
          senha: passwordHash,
          telefone: dto.adminPhone,
          perfil: Perfil.MASTER_ADMIN,
          status: UserStatus.ATIVO,
          ativo: true,
          churchId: church.id,
        },
        include: {
          church: {
            select: {
              id: true,
              nome: true,
              slug: true,
            },
          },
        },
      });

      return { church, user };
    });

    const token = this.signToken(
      created.user.id,
      created.user.email,
      created.user.perfil,
      created.church.id,
      created.church.slug,
    );

    const { senha, ...userWithoutPassword } = created.user;
    void senha;

    return {
      message: "Onboarding concluído com sucesso.",
      token,
      user: userWithoutPassword,
      church: created.church,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        church: {
          select: {
            id: true,
            slug: true,
          },
        },
      },
    });

    if (!user || !(await bcrypt.compare(dto.senha, user.senha))) {
      this.logger.warn(`Tentativa de login inválida para email=${dto.email}`);
      throw new UnauthorizedException("Credenciais inválidas.");
    }

    if (user.status === UserStatus.PENDENTE) {
      this.logger.warn(
        `Tentativa de login com conta pendente userId=${user.id} email=${user.email}`,
      );
      throw new UnauthorizedException(
        "Conta aguardando aprovação. Você receberá um email quando for aprovado.",
      );
    }

    if (user.status === UserStatus.INATIVO || !user.ativo) {
      this.logger.warn(
        `Tentativa de login com conta inativa userId=${user.id} email=${user.email}`,
      );
      throw new UnauthorizedException(
        "Conta desativada. Entre em contato com o administrador.",
      );
    }

    const token = this.signToken(
      user.id,
      user.email,
      user.perfil,
      user.church?.id,
      user.church?.slug,
    );
    const { senha, ...userWithoutPassword } = user;
    void senha;

    this.logger.log(
      `Login realizado userId=${user.id} perfil=${user.perfil} churchId=${user.churchId ?? "-"}`,
    );

    return { user: userWithoutPassword, token };
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
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
      },
    });
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        nome: dto.nome,
        telefone: dto.telefone,
        foto: dto.foto,
      },
    });

    return this.me(userId);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const result = await this.passwordResetService.createTokenForEmail(
      dto.email,
    );

    if (!result.shouldSendEmail) {
      this.logger.warn(
        `forgotPassword: email não enviado para "${dto.email}" (usuário não encontrado, inativo ou rate-limit de 60s)`,
      );
      return;
    }

    this.email;
    this.email
      .sendRecuperacaoSenha(
        result.email,
        result.nome,
        result.rawToken,
        result.churchName,
      )
      .catch((err) =>
        this.logger.error(
          `forgotPassword: falha ao enviar email para ${result.email}`,
          err,
        ),
      );
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    await this.passwordResetService.consumeTokenAndResetPassword(
      dto.token,
      dto.novaSenha,
    );
  }

  private signToken(
    id: string,
    email: string,
    perfil: Perfil,
    churchId?: string,
    churchSlug?: string,
  ): string {
    const payload: JwtPayload = {
      sub: id,
      email,
      perfil,
      churchId,
      churchSlug,
    };
    return this.jwt.sign(payload);
  }

  private async notifyAdminsNewVolunteer(
    voluntarioNome: string,
    voluntarioEmail: string,
    churchId: string,
  ): Promise<void> {
    // Busca ADMINs e MASTER_ADMINs ativos
    const admins = await this.prisma.user.findMany({
      where: {
        perfil: { in: [Perfil.ADMIN, Perfil.MASTER_ADMIN] },
        ativo: true,
        status: UserStatus.ATIVO,
        churchId,
      },
      select: { id: true, nome: true, email: true },
    });

    for (const admin of admins) {
      // Notificação in-app
      await this.prisma.notification.create({
        data: {
          userId: admin.id,
          churchId,
          titulo: "Novo voluntário aguardando aprovação",
          mensagem: `${voluntarioNome} (${voluntarioEmail}) se cadastrou e aguarda aprovação.`,
          tipo: NotificationType.NEW_VOLUNTEER_PENDING,
        },
      });

      // Email
      void this.email.sendNovoVoluntarioPendente(
        admin.email,
        admin.nome,
        voluntarioNome,
        voluntarioEmail,
      );
    }
  }

  private async resolveRegistrationChurch(churchSlug?: string) {
    if (churchSlug) {
      const churchFromSlug = await this.prisma.church.findUnique({
        where: { slug: churchSlug },
        select: { id: true, nome: true, slug: true, ativo: true },
      });

      if (!churchFromSlug || !churchFromSlug.ativo) {
        throw new BadRequestException("Igreja do convite não encontrada.");
      }

      return churchFromSlug;
    }

    const defaultChurchSlug = process.env.DEFAULT_CHURCH_SLUG;

    if (defaultChurchSlug) {
      const configured = await this.prisma.church.findUnique({
        where: { slug: defaultChurchSlug },
        select: { id: true, nome: true, slug: true, ativo: true },
      });

      if (configured?.ativo) {
        return configured;
      }
    }

    const fallback = await this.prisma.church.findFirst({
      where: { ativo: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, nome: true, slug: true, ativo: true },
    });

    if (!fallback) {
      throw new BadRequestException(
        "Nenhuma igreja ativa encontrada para realizar o cadastro.",
      );
    }

    return fallback;
  }
}
