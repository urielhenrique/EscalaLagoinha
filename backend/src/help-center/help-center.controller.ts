import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ArticleCategory, FeedbackStatus, Perfil } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { CreateArticleDto } from "./dto/create-article.dto";
import { CreateFeedbackDto } from "./dto/create-feedback.dto";
import { HelpCenterService } from "./help-center.service";

@Controller("help-center")
export class HelpCenterController {
  constructor(private readonly service: HelpCenterService) {}

  // ─── Articles (public read) ────────────────────────────────────────────────

  @Get("articles")
  listArticles(
    @Query("categoria") categoria?: ArticleCategory,
    @Query("q") q?: string,
  ) {
    return this.service.listArticles(categoria, q);
  }

  @Get("articles/:slug")
  getArticle(@Param("slug") slug: string) {
    return this.service.getArticle(slug);
  }

  @Post("articles")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Perfil.MASTER_PLATFORM_ADMIN, Perfil.MASTER_ADMIN)
  createArticle(@Body() dto: CreateArticleDto) {
    return this.service.createArticle(dto);
  }

  @Patch("articles/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Perfil.MASTER_PLATFORM_ADMIN, Perfil.MASTER_ADMIN)
  updateArticle(
    @Param("id") id: string,
    @Body() dto: Partial<CreateArticleDto>,
  ) {
    return this.service.updateArticle(id, dto);
  }

  @Delete("articles/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Perfil.MASTER_PLATFORM_ADMIN)
  deleteArticle(@Param("id") id: string) {
    return this.service.deleteArticle(id);
  }

  // ─── Feedback ─────────────────────────────────────────────────────────────

  @Post("feedback")
  @UseGuards(JwtAuthGuard)
  submitFeedback(
    @Body() dto: CreateFeedbackDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.submitFeedback(dto, user);
  }

  @Get("feedback")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Perfil.MASTER_PLATFORM_ADMIN, Perfil.MASTER_ADMIN, Perfil.ADMIN)
  listFeedbacks(
    @Query("status") status?: FeedbackStatus,
    @Query("tipo") tipo?: string,
  ) {
    return this.service.listFeedbacks(status, tipo);
  }

  @Patch("feedback/:id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Perfil.MASTER_PLATFORM_ADMIN, Perfil.MASTER_ADMIN)
  updateFeedbackStatus(
    @Param("id") id: string,
    @Body("status") status: FeedbackStatus,
  ) {
    return this.service.updateFeedbackStatus(id, status);
  }
}
