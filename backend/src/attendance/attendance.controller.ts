import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Perfil } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { MarkAttendanceStatusDto } from "./dto/mark-attendance-status.dto";
import { AttendanceService } from "./attendance.service";

@Controller("attendance")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get("my")
  getMyAttendance(@CurrentUser() user: JwtPayload) {
    return this.attendanceService.getMyAttendance(user);
  }

  @Get("event/:eventId")
  @Roles(Perfil.ADMIN)
  getAttendanceByEvent(
    @Param("eventId") eventId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attendanceService.getAttendanceByEvent(eventId, user);
  }

  @Post(":scheduleId/confirm")
  confirm(
    @Param("scheduleId") scheduleId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attendanceService.confirmParticipation(scheduleId, user);
  }

  @Post(":scheduleId/check-in")
  checkIn(
    @Param("scheduleId") scheduleId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attendanceService.checkIn(scheduleId, user);
  }

  @Patch(":scheduleId/status")
  @Roles(Perfil.ADMIN)
  markStatus(
    @Param("scheduleId") scheduleId: string,
    @Body() body: MarkAttendanceStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attendanceService.markStatus(scheduleId, body, user);
  }
}
