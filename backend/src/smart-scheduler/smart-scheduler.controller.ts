import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Perfil } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { GenerateSmartScheduleDto } from "./dto/generate-smart-schedule.dto";
import { SmartSchedulerService } from "./smart-scheduler.service";

@ApiTags("Smart Scheduler")
@ApiBearerAuth("JWT-auth")
@Controller("smart-scheduler")
export class SmartSchedulerController {
  constructor(private readonly smartSchedulerService: SmartSchedulerService) {}

  @Get("ranking")
  @ApiOperation({ summary: "Ranking gamificado de voluntarios" })
  @ApiQuery({ name: "limit", required: false, example: 30 })
  @ApiOkResponse({ description: "Ranking carregado com sucesso." })
  @ResponseMessage("Ranking carregado com sucesso.")
  getRanking(@CurrentUser() user: JwtPayload, @Query("limit") limit?: string) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const normalizedLimit =
      parsedLimit !== undefined && Number.isInteger(parsedLimit)
        ? Math.min(50, Math.max(1, parsedLimit))
        : undefined;

    return this.smartSchedulerService.getRanking({
      limit: normalizedLimit,
      viewerId: user.sub,
    });
  }

  @Get("dashboard/admin")
  @Roles(Perfil.ADMIN)
  @ApiOperation({ summary: "Dashboard executivo para administradores" })
  @ApiOkResponse({ description: "Dashboard admin carregado com sucesso." })
  @ResponseMessage("Dashboard admin carregado com sucesso.")
  getAdminDashboard() {
    return this.smartSchedulerService.getAdminExecutiveDashboard();
  }

  @Get("dashboard/me")
  @ApiOperation({ summary: "Dashboard pessoal do voluntario" })
  @ApiOkResponse({
    description: "Dashboard pessoal carregado com sucesso.",
  })
  @ResponseMessage("Dashboard pessoal carregado com sucesso.")
  getVolunteerDashboard(@CurrentUser() user: JwtPayload) {
    return this.smartSchedulerService.getVolunteerDashboard(user.sub);
  }

  @Get("insights/:eventId")
  @Roles(Perfil.ADMIN)
  @ApiOperation({ summary: "Obter insights inteligentes para um evento" })
  @ApiOkResponse({ description: "Insights de IA carregados com sucesso." })
  @ResponseMessage("Insights de IA carregados com sucesso.")
  getInsights(@Param("eventId", new ParseUUIDPipe()) eventId: string) {
    return this.smartSchedulerService.getInsights(eventId);
  }

  @Get("suggestions")
  @Roles(Perfil.ADMIN)
  @ApiOperation({ summary: "Sugerir melhores voluntários para escala manual" })
  @ApiQuery({ name: "eventId", required: true })
  @ApiQuery({ name: "ministryId", required: true })
  @ApiQuery({ name: "limit", required: false, example: 5 })
  @ApiOkResponse({ description: "Sugestões carregadas com sucesso." })
  @ResponseMessage("Sugestões carregadas com sucesso.")
  getManualSuggestions(
    @Query("eventId", new ParseUUIDPipe()) eventId: string,
    @Query("ministryId", new ParseUUIDPipe()) ministryId: string,
    @Query("limit") limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const normalizedLimit =
      parsedLimit !== undefined && Number.isInteger(parsedLimit)
        ? Math.min(20, Math.max(1, parsedLimit))
        : undefined;

    return this.smartSchedulerService.getManualSuggestions({
      eventId,
      ministryId,
      limit: normalizedLimit,
    });
  }

  @Post("generate/:eventId")
  @Roles(Perfil.ADMIN)
  @ApiOperation({ summary: "Gerar escala inteligente automática" })
  @ApiOkResponse({ description: "Escala inteligente gerada com sucesso." })
  @ResponseMessage("Escala inteligente gerada com sucesso.")
  generateSmartSchedule(
    @Param("eventId", new ParseUUIDPipe()) eventId: string,
    @Body() dto: GenerateSmartScheduleDto,
  ) {
    return this.smartSchedulerService.generateSmartSchedule({
      eventId,
      ministryIds: dto.ministryIds,
      slotsPerMinistry: dto.slotsPerMinistry,
    });
  }

  @Get("strategic")
  @Roles(Perfil.ADMIN, Perfil.MASTER_ADMIN, Perfil.MASTER_PLATFORM_ADMIN)
  @ApiOperation({
    summary: "Dashboard estratégico — saúde, crescimento e alertas preditivos",
  })
  @ApiOkResponse({
    description: "Dashboard estratégico carregado com sucesso.",
  })
  @ResponseMessage("Dashboard estratégico carregado com sucesso.")
  getStrategicDashboard(@CurrentUser() user: JwtPayload) {
    return this.smartSchedulerService.getStrategicDashboard(
      user.churchId ?? undefined,
    );
  }
}
