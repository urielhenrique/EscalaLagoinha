import {
  Controller,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Perfil } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { AuditLogsService } from "./audit-logs.service";

@Controller("audit-logs")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Perfil.ADMIN)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  list(
    @Query("userId") userId?: string,
    @Query("action") action?: string,
    @Query("module") module?: string,
    @Query("search") search?: string,
    @Query("targetId") targetId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @CurrentUser() actor?: JwtPayload,
  ) {
    const churchId =
      actor?.perfil === Perfil.MASTER_PLATFORM_ADMIN
        ? undefined
        : actor?.churchId;

    return this.auditLogsService.list({
      userId,
      churchId,
      action,
      module,
      search,
      targetId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit,
    });
  }
}
