import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Perfil } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { NotificationsService } from "./notifications.service";

@ApiTags("Notifications")
@ApiBearerAuth("JWT-auth")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @SkipThrottle({ short: true, medium: true, auth: true })
  @ApiOperation({ summary: "Listar notificações do usuário" })
  @ApiQuery({ name: "unreadOnly", required: false, example: "true" })
  @ApiOkResponse({ description: "Notificações listadas com sucesso." })
  @ResponseMessage("Notificações listadas com sucesso.")
  list(
    @CurrentUser() user: JwtPayload,
    @Query("unreadOnly") unreadOnly?: string,
  ) {
    const unread = unreadOnly === "true";
    return this.notificationsService.listForUser(user, unread);
  }

  @Get("unread-count")
  @SkipThrottle({ short: true, medium: true, auth: true })
  @ApiOperation({ summary: "Obter quantidade de notificações não lidas" })
  @ApiOkResponse({ description: "Quantidade obtida com sucesso." })
  @ResponseMessage("Quantidade de não lidas obtida com sucesso.")
  unreadCount(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.getUnreadCount(user);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Marcar notificação como lida" })
  @ApiOkResponse({ description: "Notificação marcada como lida." })
  @ResponseMessage("Notificação marcada como lida.")
  markAsRead(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.markAsRead(id, user);
  }

  @Patch("read-all")
  @ApiOperation({ summary: "Marcar todas notificações como lidas" })
  @ApiOkResponse({ description: "Notificações marcadas como lidas." })
  @ResponseMessage("Todas notificações foram marcadas como lidas.")
  markAllAsRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllAsRead(user);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Excluir notificação" })
  @ApiOkResponse({ description: "Notificação excluída com sucesso." })
  @ResponseMessage("Notificação excluída com sucesso.")
  remove(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.remove(id, user);
  }

  @Post("run-reminders")
  @Roles(Perfil.ADMIN)
  @ApiOperation({ summary: "Executar rotina de lembretes de escala" })
  @ApiQuery({ name: "hoursAhead", required: false, example: "24" })
  @ApiOkResponse({ description: "Rotina executada com sucesso." })
  @ResponseMessage("Rotina de lembretes executada com sucesso.")
  runReminders(
    @CurrentUser() user: JwtPayload,
    @Query("hoursAhead", new ParseIntPipe({ optional: true }))
    hoursAhead?: number,
  ) {
    return this.notificationsService.runRemindersForUpcomingSchedules(
      hoursAhead ?? 24,
      user,
    );
  }
}
