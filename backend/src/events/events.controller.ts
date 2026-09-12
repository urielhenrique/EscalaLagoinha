import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Perfil } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { Roles } from "../auth/decorators/roles.decorator";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { CreateEventDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { EventsService } from "./events.service";

@ApiTags("Events")
@ApiBearerAuth("JWT-auth")
@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: "Listar eventos" })
  @ApiOkResponse({ description: "Eventos listados com sucesso." })
  @ResponseMessage("Eventos listados com sucesso.")
  findAll(@CurrentUser() user: JwtPayload) {
    return this.eventsService.findAll(user);
  }

  @Get("recurrence-group/:groupId")
  @ApiOperation({ summary: "Listar eventos de uma série de recorrência" })
  @ApiOkResponse({
    description: "Eventos da série listados com sucesso.",
  })
  @ResponseMessage("Eventos da série listados com sucesso.")
  findByRecurrenceGroup(
    @Param("groupId") groupId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.eventsService.findByRecurrenceGroup(groupId, user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Buscar evento por ID" })
  @ApiOkResponse({ description: "Evento encontrado com sucesso." })
  @ResponseMessage("Evento encontrado com sucesso.")
  findById(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.eventsService.findById(id, user);
  }

  @Post()
  @Roles(Perfil.ADMIN)
  @ApiOperation({ summary: "Criar evento" })
  @ApiOkResponse({ description: "Evento criado com sucesso." })
  @ResponseMessage("Evento criado com sucesso.")
  create(@Body() dto: CreateEventDto, @CurrentUser() user: JwtPayload) {
    return this.eventsService.create(dto, user);
  }

  @Post("seed-defaults")
  @Roles(Perfil.ADMIN)
  @ApiOperation({ summary: "Criar eventos padrão para testes" })
  @ApiOkResponse({ description: "Eventos padrão configurados com sucesso." })
  @ResponseMessage("Eventos padrão configurados com sucesso.")
  seedDefaults(@CurrentUser() user: JwtPayload) {
    return this.eventsService.seedInitialEvents(user);
  }

  @Patch(":id")
  @Roles(Perfil.ADMIN)
  @ApiOperation({ summary: "Atualizar evento" })
  @ApiOkResponse({ description: "Evento atualizado com sucesso." })
  @ResponseMessage("Evento atualizado com sucesso.")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.eventsService.update(id, dto, user);
  }

  @Delete(":id")
  @Roles(Perfil.ADMIN)
  @ApiOperation({ summary: "Remover evento" })
  @ApiOkResponse({ description: "Evento removido com sucesso." })
  @ResponseMessage("Evento removido com sucesso.")
  remove(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.eventsService.remove(id, user);
  }

  @Post(":id/sync-google")
  @Roles(Perfil.ADMIN)
  @ApiOperation({ summary: "Sincronizar evento com Google Calendar" })
  @ApiOkResponse({ description: "Evento sincronizado com sucesso." })
  @ResponseMessage("Evento sincronizado com Google Calendar.")
  syncGoogle(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.eventsService.syncEventToGoogle(user.sub, id, user);
  }

  @Delete(":id/sync-google")
  @Roles(Perfil.ADMIN)
  @ApiOperation({ summary: "Desvincular evento do Google Calendar" })
  @ApiOkResponse({ description: "Evento desvinculado do Google Calendar." })
  @ResponseMessage("Evento desvinculado do Google Calendar.")
  unlinkGoogle(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.eventsService.unlinkEventFromGoogle(user.sub, id, user);
  }
}
