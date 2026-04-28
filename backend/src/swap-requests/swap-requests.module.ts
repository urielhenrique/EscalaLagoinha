import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AvailabilityModule } from "../availability/availability.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SwapRequestsController } from "./swap-requests.controller";
import { SwapRequestsService } from "./swap-requests.service";

@Module({
  imports: [NotificationsModule, AvailabilityModule, AuditLogsModule],
  controllers: [SwapRequestsController],
  providers: [SwapRequestsService],
})
export class SwapRequestsModule {}
