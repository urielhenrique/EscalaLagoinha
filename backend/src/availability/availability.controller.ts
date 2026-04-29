import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { AvailabilityService } from "./availability.service";
import { CreateBlockedDateDto } from "./dto/create-blocked-date.dto";
import { UpsertAvailabilityDto } from "./dto/upsert-availability.dto";
import { UpsertMinistryPreferencesDto } from "./dto/upsert-ministry-preferences.dto";

@ApiTags("Availability")
@ApiBearerAuth("JWT-auth")
@Controller("availability")
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get("me")
  @ApiOperation({ summary: "Consultar disponibilidade do voluntário logado" })
  @ApiOkResponse({ description: "Disponibilidade retornada com sucesso." })
  @ResponseMessage("Disponibilidade carregada com sucesso.")
  getMine(@CurrentUser() user: JwtPayload) {
    return this.availabilityService.getMine(user);
  }

  @Put("me/weekly")
  @ApiOperation({ summary: "Salvar grade semanal de disponibilidade" })
  @ResponseMessage("Disponibilidade semanal atualizada com sucesso.")
  upsertWeekly(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertAvailabilityDto,
  ) {
    return this.availabilityService.upsertWeekly(user, dto);
  }

  @Put("me/ministry-preferences")
  @ApiOperation({ summary: "Salvar preferências por ministério" })
  @ResponseMessage("Preferências de ministério atualizadas com sucesso.")
  upsertMinistryPreferences(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertMinistryPreferencesDto,
  ) {
    return this.availabilityService.upsertMinistryPreferences(user, dto);
  }

  @Post("me/blocked-dates")
  @ApiOperation({ summary: "Adicionar data ou período específico bloqueado" })
  @ResponseMessage("Datas bloqueadas adicionadas com sucesso.")
  addBlockedDate(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBlockedDateDto,
  ) {
    return this.availabilityService.addBlockedDate(user, dto);
  }

  @Delete("me/blocked-dates/:id")
  @ApiOperation({ summary: "Remover data bloqueada" })
  @ResponseMessage("Data bloqueada removida com sucesso.")
  removeBlockedDate(
    @CurrentUser() user: JwtPayload,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.availabilityService.removeBlockedDate(user, id);
  }
}
