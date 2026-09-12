import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "./notifications.service";

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
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
      const churches = await this.prisma.church.findMany({
        where: { ativo: true },
        select: { id: true, nome: true },
      });

      let totalScanned = 0;
      let totalSent = 0;

      for (const church of churches) {
        const result =
          await this.notificationsService.runRemindersForUpcomingSchedules(
            hoursAhead,
            undefined,
            church.id,
          );

        totalScanned += result.scanned;
        totalSent += result.sent;
      }

      this.logger.log(
        `Reminders automáticos executados: igrejas=${churches.length}, janela=${hoursAhead}h, analisadas=${totalScanned}, enviadas=${totalSent}`,
      );
    } catch (error) {
      this.logger.error("Falha ao executar reminders automáticos.", error);
    }
  }
}
