import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { AvailabilityModule } from "./availability/availability.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { AuditLogsModule } from "./audit-logs/audit-logs.module";
import { AuthModule } from "./auth/auth.module";
import { ChurchesModule } from "./churches/churches.module";
import { EmailModule } from "./email/email.module";
import { EventsModule } from "./events/events.module";
import { HealthModule } from "./health/health.module";
import { HelpCenterModule } from "./help-center/help-center.module";
import { MinistriesModule } from "./ministries/ministries.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReportsModule } from "./reports/reports.module";
import { SchedulesModule } from "./schedules/schedules.module";
import { SmartSchedulerModule } from "./smart-scheduler/smart-scheduler.module";
import { SwapRequestsModule } from "./swap-requests/swap-requests.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: "short",
          ttl: 1000,
          limit: 20,
        },
        {
          name: "medium",
          ttl: 60000,
          limit: 200,
        },
        {
          name: "auth",
          ttl: 60000,
          limit: Number(configService.get("AUTH_RATE_LIMIT", "5")),
        },
      ],
    }),
    PrismaModule,
    EmailModule,
    HealthModule,
    AvailabilityModule,
    AuthModule,
    ChurchesModule,
    UsersModule,
    MinistriesModule,
    EventsModule,
    NotificationsModule,
    AuditLogsModule,
    AttendanceModule,
    ReportsModule,
    SchedulesModule,
    SmartSchedulerModule,
    SwapRequestsModule,
    HelpCenterModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
