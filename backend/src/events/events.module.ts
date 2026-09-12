import { Module } from "@nestjs/common";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";
import { GoogleCalendarModule } from "../integrations/google-calendar/google-calendar.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";

@Module({
  imports: [GoogleCalendarModule, AuditLogsModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
