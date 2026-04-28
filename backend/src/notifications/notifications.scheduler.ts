import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { NotificationsService } from "./notifications.service";

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runAutomaticReminders() {
    const enabled =
      this.configService.get<string>("REMINDERS_ENABLED", "true") !== "false";

    if (!enabled) {
      return;
    }

    const rawHoursAhead = Number(
      this.configService.get<string>("REMINDERS_HOURS_AHEAD", "24"),
    );

    const hoursAhead =
      Number.isFinite(rawHoursAhead) && rawHoursAhead > 0 ? rawHoursAhead : 24;

    try {
      const result =
        await this.notificationsService.runRemindersForUpcomingSchedules(
          hoursAhead,
        );

      this.logger.log(
        `Reminders automáticos executados: janela=${hoursAhead}h, analisadas=${result.scanned}, enviadas=${result.sent}`,
      );
    } catch (error) {
      this.logger.error("Falha ao executar reminders automáticos.", error);
    }
  }
}
