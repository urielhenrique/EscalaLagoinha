import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { Perfil } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { ChurchesService } from "./churches.service";
import { ChangeAdminRoleDto } from "./dto/change-admin-role.dto";
import { CreateInviteLinkDto } from "./dto/create-invite-link.dto";
import { CreateChurchDto } from "./dto/create-church.dto";
import { UpdateChurchSettingsDto } from "./dto/update-church-settings.dto";

@Controller("churches")
@Roles(Perfil.ADMIN)
export class ChurchesController {
  constructor(private readonly churchesService: ChurchesService) {}

  @Get()
  @ResponseMessage("Igrejas carregadas com sucesso.")
  listVisible(@CurrentUser() user: JwtPayload) {
    return this.churchesService.listVisible(user);
  }

  @Get("current")
  @ResponseMessage("Igreja atual carregada com sucesso.")
  getCurrent(@CurrentUser() user: JwtPayload) {
    return this.churchesService.getCurrent(user);
  }

  @Post()
  @Roles(Perfil.MASTER_PLATFORM_ADMIN)
  @ResponseMessage("Igreja criada com sucesso.")
  create(@Body() dto: CreateChurchDto, @CurrentUser() user: JwtPayload) {
    return this.churchesService.createChurch(dto, user);
  }

  @Patch("current/settings")
  @Roles(Perfil.ADMIN)
  @ResponseMessage("Configurações da igreja atualizadas com sucesso.")
  updateCurrentSettings(
    @Body() dto: UpdateChurchSettingsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.churchesService.updateCurrentSettings(dto, user);
  }

  @Post("current/invite-link")
  @Roles(Perfil.ADMIN)
  @ResponseMessage("Link de convite gerado com sucesso.")
  createInviteLink(
    @Body() dto: CreateInviteLinkDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.churchesService.createInviteLink(dto, user);
  }

  @Get(":churchId/admins")
  @Roles(Perfil.ADMIN)
  @ResponseMessage("Administradores da igreja carregados com sucesso.")
  listAdmins(
    @Param("churchId", new ParseUUIDPipe()) churchId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.churchesService.listChurchAdmins(churchId, user);
  }

  @Patch(":churchId/admins/:userId/profile")
  @Roles(Perfil.MASTER_ADMIN, Perfil.MASTER_PLATFORM_ADMIN)
  @ResponseMessage("Perfil administrativo atualizado com sucesso.")
  changeAdminRole(
    @Param("churchId", new ParseUUIDPipe()) churchId: string,
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @Body() dto: ChangeAdminRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.churchesService.changeAdminRole(churchId, userId, dto, user);
  }
}
