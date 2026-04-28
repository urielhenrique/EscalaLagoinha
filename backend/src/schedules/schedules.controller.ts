import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CreateScheduleDto } from "./dto/create-schedule.dto";
import { UpdateScheduleDto } from "./dto/update-schedule.dto";
import { SchedulesService } from "./schedules.service";

@ApiTags("Schedules")
@ApiBearerAuth("JWT-auth")
@Controller("schedules")
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  @Roles(Perfil.ADMIN)
  @ApiOperation({ summary: "Criar escala" })
  @ApiOkResponse({ description: "Escala criada com sucesso." })
  @ResponseMessage("Escala criada com sucesso.")
  create(@Body() dto: CreateScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: "Listar escalas visíveis para o usuário" })
  @ApiQuery({ name: "eventId", required: false })
  @ApiQuery({ name: "ministryId", required: false })
  @ApiQuery({ name: "volunteerId", required: false })
  @ApiOkResponse({ description: "Escalas listadas com sucesso." })
  @ResponseMessage("Escalas listadas com sucesso.")
  findAllVisible(
    @CurrentUser() user: JwtPayload,
    @Query("eventId") eventId?: string,
    @Query("ministryId") ministryId?: string,
    @Query("volunteerId") volunteerId?: string,
  ) {
    return this.schedulesService.findAllVisible(user, {
      eventId,
      ministryId,
      volunteerId,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Buscar escala por ID" })
  @ApiOkResponse({ description: "Escala encontrada com sucesso." })
  @ResponseMessage("Escala encontrada com sucesso.")
  findById(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.schedulesService.findByIdVisible(id, user);
  }

  @Patch(":id")
  @Roles(Perfil.ADMIN)
  @ApiOperation({ summary: "Atualizar escala" })
  @ApiOkResponse({ description: "Escala atualizada com sucesso." })
  @ResponseMessage("Escala atualizada com sucesso.")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.schedulesService.update(id, dto, user);
  }

  @Patch(":id/cancel")
  @Roles(Perfil.ADMIN)
  @ApiOperation({ summary: "Cancelar escala" })
  @ApiOkResponse({ description: "Escala cancelada com sucesso." })
  @ResponseMessage("Escala cancelada com sucesso.")
  cancel(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.schedulesService.cancel(id, user);
  }
}
