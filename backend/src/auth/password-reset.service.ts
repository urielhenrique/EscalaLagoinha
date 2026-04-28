import { BadRequestException, Injectable } from "@nestjs/common";
import { UserStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PasswordResetService {
  constructor(private readonly prisma: PrismaService) {}

  async createTokenForEmail(email: string): Promise<
    | {
        shouldSendEmail: true;
        rawToken: string;
        nome: string;
        email: string;
      }
    | { shouldSendEmail: false }
  > {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, nome: true, email: true, status: true },
    });

    // Resposta neutra para evitar enumeração de contas
    if (!user || user.status !== UserStatus.ATIVO) {
      return { shouldSendEmail: false };
    }

    // Anti-abuso: limite de frequência por usuário
    const lastToken = await this.prisma.passwordResetToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    });

    if (lastToken) {
      const secondsSinceLast =
        (Date.now() - lastToken.createdAt.getTime()) / 1000;
      if (secondsSinceLast < 60) {
        return { shouldSendEmail: false };
      }
    }

    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    return {
      shouldSendEmail: true,
      rawToken,
      nome: user.nome,
      email: user.email,
    };
  }

  async consumeTokenAndResetPassword(token: string, novaSenha: string) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
      include: { user: { select: { id: true, status: true } } },
    });

    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      throw new BadRequestException(
        "Link de recuperação inválido ou expirado. Solicite um novo.",
      );
    }

    const novoHash = await bcrypt.hash(novaSenha, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { senha: novoHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, used: false },
        data: { used: true },
      }),
    ]);
  }
}
