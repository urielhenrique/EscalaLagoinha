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
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { CreateMinistryDto } from "./dto/create-ministry.dto";
import { UpdateMinistryDto } from "./dto/update-ministry.dto";
import { MinistriesService } from "./ministries.service";

@ApiTags("Ministries")
@ApiBearerAuth("JWT-auth")
@Controller("ministries")
export class MinistriesController {
  constructor(private readonly ministriesService: MinistriesService) {}

  @Get()
  @ApiOperation({ summary: "Listar ministérios visíveis para o usuário" })
  @ApiOkResponse({ description: "Ministérios listados com sucesso." })
  @ResponseMessage("Ministérios listados com sucesso.")
  findAllVisible(@CurrentUser() user: JwtPayload) {
    return this.ministriesService.findAllVisible(user);
  }

  @Get("my")
  @ApiOperation({ summary: "Listar ministérios do voluntário autenticado" })
  @ApiOkResponse({
    description: "Ministérios do usuário listados com sucesso.",
  })
  @ResponseMessage("Ministérios do usuário listados com sucesso.")
  findMyMinistries(@CurrentUser() user: JwtPayload) {
    return this.ministriesService.findAllVisible({
      ...user,
      perfil: Perfil.VOLUNTARIO,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Buscar ministério por ID" })
  @ApiOkResponse({ description: "Ministério encontrado com sucesso." })
  @ResponseMessage("Ministério encontrado com sucesso.")
  findById(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ministriesService.findByIdForUser(id, user);
  }

  @Post()
  @Roles(Perfil.ADMIN)
  @ApiOperation({ summary: "Criar ministério" })
  @ApiOkResponse({ description: "Ministério criado com sucesso." })
  @ResponseMessage("Ministério criado com sucesso.")
  create(@Body() dto: CreateMinistryDto, @CurrentUser() user: JwtPayload) {
    return this.ministriesService.create(dto, user);
  }

  @Post("seed-defaults")
  @Roles(Perfil.ADMIN)
  @ApiOperation({ summary: "Criar ministérios padrão" })
  @ApiOkResponse({
    description: "Ministérios padrão configurados com sucesso.",
  })
  @ResponseMessage("Ministérios padrão configurados com sucesso.")
  createInitialMinistries(@CurrentUser() user: JwtPayload) {
    return this.ministriesService.createInitialMinistries(user);
  }

  @Patch(":id")
  @Roles(Perfil.ADMIN)
  @ApiOperation({ summary: "Atualizar ministério" })
  @ApiOkResponse({ description: "Ministério atualizado com sucesso." })
  @ResponseMessage("Ministério atualizado com sucesso.")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMinistryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ministriesService.update(id, dto, user);
  }

  @Delete(":id")
  @Roles(Perfil.ADMIN)
  @ApiOperation({ summary: "Remover ministério" })
  @ApiOkResponse({ description: "Ministério removido com sucesso." })
  @ResponseMessage("Ministério removido com sucesso.")
  remove(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ministriesService.remove(id, user);
  }
}
