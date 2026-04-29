import {
  Controller,
  Get,
  Header,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { Perfil } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { ReportsQueryDto } from "./dto/reports-query.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Perfil.ADMIN)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("overview")
  getOverview(
    @Query() query: ReportsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.getOverview(query, user);
  }

  @Get("export")
  @Header("Cache-Control", "no-store")
  async export(
    @Query() query: ReportsQueryDto,
    @Query("format") format: "csv" | "xlsx" | "pdf" = "csv",
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) response: Response,
  ) {
    const extension =
      format === "xlsx" ? "xlsx" : format === "pdf" ? "pdf" : "csv";

    const mimeType =
      extension === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : extension === "pdf"
          ? "application/pdf"
          : "text/csv";

    const fileName = `relatorio-presenca.${extension}`;

    const fileBuffer = await this.reportsService.exportOverview(
      query,
      format,
      user,
    );
    await this.reportsService.logExport(user.sub, format, query);

    response.setHeader("Content-Type", mimeType);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`,
    );

    return new StreamableFile(fileBuffer);
  }
}
