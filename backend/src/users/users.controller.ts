import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { Perfil, UserStatus } from "@prisma/client";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

@ApiTags("Users")
@ApiBearerAuth("JWT-auth")
@Controller("users")
@Roles(Perfil.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── Admin cria usuário com status ATIVO ──────────────────────────────────
  @Post()
  @ApiOperation({ summary: "Criar novo usuário (Admin)" })
  @ResponseMessage("Usuário criado com sucesso.")
  create(@Body() dto: CreateUserDto, @CurrentUser() admin: JwtPayload) {
    return this.usersService.create(dto, { status: UserStatus.ATIVO }, admin);
  }

  @Get()
  @ApiOperation({ summary: "Listar usuários com filtros opcionais" })
  @ApiQuery({ name: "ativo", required: false, example: "true" })
  @ApiQuery({ name: "perfil", required: false, enum: Perfil })
  @ApiQuery({ name: "status", required: false, enum: UserStatus })
  @ResponseMessage("Usuários listados com sucesso.")
  findAll(
    @Query("ativo") ativo?: string,
    @Query("perfil") perfil?: Perfil,
    @Query("status") status?: UserStatus,
    @CurrentUser() admin?: JwtPayload,
  ) {
    let ativoParsed: boolean | undefined;

    if (ativo !== undefined) {
      if (ativo === "true") {
        ativoParsed = true;
      } else if (ativo === "false") {
        ativoParsed = false;
      } else {
        throw new BadRequestException(
          'O filtro "ativo" deve ser "true" ou "false".',
        );
      }
    }

    if (perfil !== undefined && !Object.values(Perfil).includes(perfil)) {
      throw new BadRequestException('O filtro "perfil" deve ser válido.');
    }

    return this.usersService.findAll(
      { ativo: ativoParsed, perfil, status },
      admin,
    );
  }

  // ─── Lista usuários pendentes de aprovação ─────────────────────────────────
  @Get("pending")
  @ApiOperation({ summary: "Listar voluntários aguardando aprovação" })
  @ResponseMessage("Usuários pendentes listados com sucesso.")
  findPending(@CurrentUser() admin: JwtPayload) {
    return this.usersService.findPending(admin);
  }

  @Get(":id")
  @ApiOperation({ summary: "Buscar usuário por ID" })
  @ResponseMessage("Usuário encontrado com sucesso.")
  findById(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.usersService.findPublicById(id, admin);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Atualizar dados do usuário" })
  @ResponseMessage("Usuário atualizado com sucesso.")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.usersService.update(id, dto, admin);
  }

  // ─── Aprovar voluntário ────────────────────────────────────────────────────
  @Patch(":id/approve")
  @ApiOperation({ summary: "Aprovar cadastro de voluntário" })
  @ApiOkResponse({ description: "Voluntário aprovado com sucesso." })
  @ResponseMessage("Voluntário aprovado com sucesso.")
  approve(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.usersService.approve(id, admin);
  }

  // ─── Recusar voluntário ────────────────────────────────────────────────────
  @Patch(":id/reject")
  @ApiOperation({ summary: "Recusar cadastro de voluntário" })
  @ApiOkResponse({ description: "Voluntário recusado." })
  @ResponseMessage("Voluntário recusado.")
  reject(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.usersService.reject(id, admin);
  }

  @Delete(":id")
  @Roles(Perfil.MASTER_ADMIN, Perfil.MASTER_PLATFORM_ADMIN)
  @ApiOperation({ summary: "Desativar usuário (soft delete)" })
  @ResponseMessage("Usuário desativado com sucesso.")
  deactivate(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.usersService.deactivate(id, admin);
  }
}
