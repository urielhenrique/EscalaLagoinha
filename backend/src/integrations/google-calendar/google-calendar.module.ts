import { Module } from "@nestjs/common";
import { GoogleCalendarController } from "./google-calendar.controller";
import { GoogleCalendarService } from "./google-calendar.service";
import { GoogleCalendarSyncService } from "./google-calendar-sync.service";
import { GoogleOAuthStateService } from "./google-oauth-state.service";
import { GoogleEncryptionService } from "./google-encryption.service";

@Module({
  controllers: [GoogleCalendarController],
  providers: [
    GoogleCalendarService,
    GoogleCalendarSyncService,
    GoogleOAuthStateService,
    GoogleEncryptionService,
  ],
  exports: [GoogleCalendarService, GoogleCalendarSyncService],
})
export class GoogleCalendarModule {}
