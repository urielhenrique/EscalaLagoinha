import { Injectable, NotFoundException } from "@nestjs/common";
import { ArticleCategory, FeedbackStatus, FeedbackType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { CreateArticleDto } from "./dto/create-article.dto";
import { CreateFeedbackDto } from "./dto/create-feedback.dto";

@Injectable()
export class HelpCenterService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Articles ─────────────────────────────────────────────────────────────

  async listArticles(categoria?: ArticleCategory, q?: string) {
    return this.prisma.helpArticle.findMany({
      where: {
        publicado: true,
        ...(categoria ? { categoria } : {}),
        ...(q
          ? {
              OR: [
                { titulo: { contains: q, mode: "insensitive" } },
                { conteudo: { contains: q, mode: "insensitive" } },
                { tags: { has: q } },
              ],
            }
          : {}),
      },
      orderBy: { visualizacoes: "desc" },
      select: {
        id: true,
        titulo: true,
        categoria: true,
        tags: true,
        slug: true,
        visualizacoes: true,
        createdAt: true,
      },
    });
  }

  async getArticle(slug: string) {
    const article = await this.prisma.helpArticle.findUnique({
      where: { slug },
    });

    if (!article || !article.publicado) {
      throw new NotFoundException("Artigo não encontrado.");
    }

    await this.prisma.helpArticle.update({
      where: { slug },
      data: { visualizacoes: { increment: 1 } },
    });

    return article;
  }

  async createArticle(dto: CreateArticleDto) {
    return this.prisma.helpArticle.create({ data: dto });
  }

  async updateArticle(id: string, dto: Partial<CreateArticleDto>) {
    return this.prisma.helpArticle.update({ where: { id }, data: dto });
  }

  async deleteArticle(id: string) {
    await this.prisma.helpArticle.delete({ where: { id } });
    return { success: true };
  }

  // ─── Feedback ─────────────────────────────────────────────────────────────

  async submitFeedback(dto: CreateFeedbackDto, user: JwtPayload) {
    return this.prisma.userFeedback.create({
      data: {
        ...dto,
        userId: user.sub,
        churchId: user.churchId ?? null,
      },
    });
  }

  async listFeedbacks(status?: FeedbackStatus, tipo?: string) {
    const parsedTipo = tipo as FeedbackType | undefined;

    return this.prisma.userFeedback.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(parsedTipo ? { tipo: parsedTipo } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, nome: true, email: true } },
        church: { select: { id: true, nome: true } },
      },
    });
  }

  async updateFeedbackStatus(id: string, status: FeedbackStatus) {
    return this.prisma.userFeedback.update({ where: { id }, data: { status } });
  }
}
