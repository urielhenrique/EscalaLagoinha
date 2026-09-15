import { Injectable, Logger } from "@nestjs/common";
import { GoogleSyncStatus } from "@prisma/client";
import { google, calendar_v3 } from "googleapis";
import { PrismaService } from "../../prisma/prisma.service";
import { GoogleCalendarService } from "./google-calendar.service";

const BRAZIL_TIMEZONE = "America/Sao_Paulo";
const EXTENDED_PROPERTY_SOURCE = "escala-facil";

interface SyncResult {
  status: GoogleSyncStatus;
  googleEventId: string | null;
  error: string | null;
}

@Injectable()
export class GoogleCalendarSyncService {
  private readonly logger = new Logger(GoogleCalendarSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

  buildGoogleEventId(scheduleId: string): string {
    const normalized = scheduleId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    return `escala-${normalized}`;
  }

  toGoogleDateTime(date: Date): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: BRAZIL_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";

    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
  }

  async syncSchedule(scheduleId: string): Promise<SyncResult> {
    try {
      const schedule = await this.prisma.schedule.findUnique({
        where: { id: scheduleId },
        select: {
          id: true,
          volunteerId: true,
          eventId: true,
          status: true,
          event: {
            select: {
              id: true,
              churchId: true,
              nome: true,
              descricao: true,
              dataInicio: true,
              dataFim: true,
              recurrenceGroupId: true,
            },
          },
        },
      });

      if (!schedule) {
        return {
          status: GoogleSyncStatus.ERROR,
          googleEventId: null,
          error: "Escala não encontrada.",
        };
      }

      if (schedule.status === "CANCELADO") {
        return {
          status: GoogleSyncStatus.NONE,
          googleEventId: null,
          error: null,
        };
      }

      const userId = schedule.volunteerId;

      const connection =
        await this.prisma.googleCalendarConnection.findUnique({
          where: { userId },
          select: { calendarId: true },
        });

      if (!connection) {
        return {
          status: GoogleSyncStatus.NONE,
          googleEventId: null,
          error: null,
        };
      }

      const calendarId = connection.calendarId || "primary";

      const existingSync =
        await this.prisma.googleCalendarEventSync.findUnique({
          where: { scheduleId },
          select: { googleEventId: true, syncStatus: true },
        });

      if (
        existingSync?.syncStatus === GoogleSyncStatus.SYNCED &&
        existingSync.googleEventId
      ) {
        return await this.retryWithRefresh(userId, (accessToken) =>
          this.updateGoogleEvent(
            accessToken,
            calendarId,
            schedule.event,
            existingSync.googleEventId!,
            scheduleId,
            userId,
          ),
        );
      }

      return await this.retryWithRefresh(userId, (accessToken) =>
        this.createGoogleEvent(
          accessToken,
          calendarId,
          schedule.event,
          scheduleId,
          userId,
        ),
      );
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      this.logger.error(
        `Sync failed for schedule ${scheduleId}: ${errorMsg}`,
      );
      await this.updateSyncError(scheduleId, errorMsg);
      return {
        status: GoogleSyncStatus.ERROR,
        googleEventId: null,
        error: errorMsg,
      };
    }
  }

  private async retryWithRefresh<T>(
    userId: string,
    operation: (accessToken: string) => Promise<T>,
  ): Promise<T> {
    let accessToken =
      await this.googleCalendarService.getStoredAccessToken(userId);

    if (!accessToken) {
      throw new Error("Google Calendar não conectado para este usuário.");
    }

    try {
      return await operation(accessToken);
    } catch (error) {
      if (this.getHttpStatus(error) !== 401) {
        throw error;
      }

      this.logger.warn(
        `Google API returned 401 for user ${userId}. Refreshing token and retrying.`,
      );

      accessToken =
        await this.googleCalendarService.refreshAccessToken(userId);

      if (!accessToken) {
        this.logger.error(`Token refresh failed for user ${userId} after 401.`);
        // eslint-disable-next-line preserve-caught-error
        throw new Error(
          "Falha ao renovar token do Google Calendar. Reconecte sua conta.",
        );
      }

      return await operation(accessToken);
    }
  }

  private async createGoogleEvent(
    accessToken: string,
    calendarId: string,
    event: {
      id: string;
      churchId: string | null;
      nome: string;
      descricao: string | null;
      dataInicio: Date;
      dataFim: Date;
      recurrenceGroupId: string | null;
    },
    scheduleId: string,
    userId: string,
  ): Promise<SyncResult> {
    const calendar = this.getCalendarClient(accessToken);

    const googleEventId = this.buildGoogleEventId(scheduleId);

    const eventBody: calendar_v3.Schema$Event = {
      id: googleEventId,
      summary: event.nome,
      description: event.descricao || undefined,
      start: {
        dateTime: this.toGoogleDateTime(event.dataInicio),
        timeZone: BRAZIL_TIMEZONE,
      },
      end: {
        dateTime: this.toGoogleDateTime(event.dataFim),
        timeZone: BRAZIL_TIMEZONE,
      },
      extendedProperties: {
        private: {
          [EXTENDED_PROPERTY_SOURCE]: "true",
          eventId: event.id,
          scheduleId,
          churchId: event.churchId || "",
          recurrenceGroupId: event.recurrenceGroupId || "",
        },
      },
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: eventBody,
      conferenceDataVersion: 0,
    });

    const createdGoogleId = response.data.id || googleEventId;

    await this.prisma.googleCalendarEventSync.upsert({
      where: { scheduleId },
      update: {
        googleEventId: createdGoogleId,
        syncStatus: GoogleSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
        syncError: null,
      },
      create: {
        scheduleId,
        userId,
        eventId: event.id,
        googleEventId: createdGoogleId,
        syncStatus: GoogleSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
      },
    });

    this.logger.log(
      `Schedule ${scheduleId} synced to Google Calendar for user ${userId} as ${createdGoogleId}.`,
    );

    return {
      status: GoogleSyncStatus.SYNCED,
      googleEventId: createdGoogleId,
      error: null,
    };
  }

  private async updateGoogleEvent(
    accessToken: string,
    calendarId: string,
    event: {
      id: string;
      churchId: string | null;
      nome: string;
      descricao: string | null;
      dataInicio: Date;
      dataFim: Date;
      recurrenceGroupId: string | null;
    },
    existingGoogleEventId: string,
    scheduleId: string,
    userId: string,
  ): Promise<SyncResult> {
    const calendar = this.getCalendarClient(accessToken);

    const eventBody: calendar_v3.Schema$Event = {
      summary: event.nome,
      description: event.descricao || undefined,
      start: {
        dateTime: this.toGoogleDateTime(event.dataInicio),
        timeZone: BRAZIL_TIMEZONE,
      },
      end: {
        dateTime: this.toGoogleDateTime(event.dataFim),
        timeZone: BRAZIL_TIMEZONE,
      },
      extendedProperties: {
        private: {
          [EXTENDED_PROPERTY_SOURCE]: "true",
          eventId: event.id,
          scheduleId,
          churchId: event.churchId || "",
          recurrenceGroupId: event.recurrenceGroupId || "",
        },
      },
    };

    try {
      await calendar.events.update({
        calendarId,
        eventId: existingGoogleEventId,
        requestBody: eventBody,
      });

      await this.prisma.googleCalendarEventSync.upsert({
        where: { scheduleId },
        update: {
          syncStatus: GoogleSyncStatus.SYNCED,
          lastSyncedAt: new Date(),
          syncError: null,
        },
        create: {
          scheduleId,
          userId,
          eventId: event.id,
          googleEventId: existingGoogleEventId,
          syncStatus: GoogleSyncStatus.SYNCED,
          lastSyncedAt: new Date(),
        },
      });

      this.logger.log(
        `Schedule ${scheduleId} updated in Google Calendar for user ${userId} (${existingGoogleEventId}).`,
      );

      return {
        status: GoogleSyncStatus.SYNCED,
        googleEventId: existingGoogleEventId,
        error: null,
      };
    } catch (error) {
      const status = this.getHttpStatus(error);
      if (status === 404) {
        this.logger.warn(
          `Google event ${existingGoogleEventId} not found (404). Recreating for schedule ${scheduleId}.`,
        );
        await this.prisma.googleCalendarEventSync.deleteMany({
          where: { scheduleId },
        });
        return this.createGoogleEvent(
          accessToken,
          calendarId,
          event,
          scheduleId,
          userId,
        );
      }
      throw error;
    }
  }

  async deleteGoogleEvent(
    scheduleId: string,
  ): Promise<{ success: boolean; error: string | null }> {
    const sync = await this.prisma.googleCalendarEventSync.findUnique({
      where: { scheduleId },
      select: { googleEventId: true, userId: true },
    });

    if (!sync?.googleEventId) {
      return { success: true, error: null };
    }

    const googleEventId = sync.googleEventId;
    const userId = sync.userId;

    try {
      await this.retryWithRefresh(userId, async (accessToken) => {
        const connection =
          await this.prisma.googleCalendarConnection.findUnique({
            where: { userId },
            select: { calendarId: true },
          });

        const calendarId = connection?.calendarId || "primary";
        const calendar = this.getCalendarClient(accessToken);
        await calendar.events.delete({
          calendarId,
          eventId: googleEventId,
        });
      });
    } catch (error) {
      const status = this.getHttpStatus(error);
      if (status === 404) {
        this.logger.warn(
          `Google event ${googleEventId} already deleted (404). Treating as success.`,
        );
      } else {
        const errorMsg =
          error instanceof Error ? error.message : "Erro desconhecido";
        this.logger.error(
          `Failed to delete Google event for schedule ${scheduleId}: ${errorMsg}`,
        );
        return { success: false, error: errorMsg };
      }
    }

    await this.prisma.googleCalendarEventSync.deleteMany({
      where: { scheduleId },
    });

    this.logger.log(
      `Schedule ${scheduleId} unlinked from Google Calendar (${googleEventId}).`,
    );

    return { success: true, error: null };
  }

  async deleteGoogleEventByGoogleId(
    userId: string,
    googleEventId: string,
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      await this.retryWithRefresh(userId, async (accessToken) => {
        const connection =
          await this.prisma.googleCalendarConnection.findUnique({
            where: { userId },
            select: { calendarId: true },
          });

        const calendarId = connection?.calendarId || "primary";
        const calendar = this.getCalendarClient(accessToken);
        await calendar.events.delete({
          calendarId,
          eventId: googleEventId,
        });
      });
    } catch (error) {
      const status = this.getHttpStatus(error);
      if (status === 404) {
        this.logger.warn(
          `Google event ${googleEventId} already deleted (404). Treating as success.`,
        );
      } else {
        const errorMsg =
          error instanceof Error ? error.message : "Erro desconhecido";
        this.logger.error(
          `Failed to delete Google event ${googleEventId}: ${errorMsg}`,
        );
        return { success: false, error: errorMsg };
      }
    }

    return { success: true, error: null };
  }

  async getScheduleSyncStatus(
    scheduleId: string,
  ): Promise<{
    synced: boolean;
    googleEventId: string | null;
    status: GoogleSyncStatus;
    lastSyncedAt: Date | null;
    error: string | null;
  }> {
    const sync = await this.prisma.googleCalendarEventSync.findUnique({
      where: { scheduleId },
      select: {
        googleEventId: true,
        syncStatus: true,
        lastSyncedAt: true,
        syncError: true,
      },
    });

    if (!sync) {
      return {
        synced: false,
        googleEventId: null,
        status: GoogleSyncStatus.NONE,
        lastSyncedAt: null,
        error: null,
      };
    }

    return {
      synced: sync.syncStatus === GoogleSyncStatus.SYNCED,
      googleEventId: sync.googleEventId,
      status: sync.syncStatus,
      lastSyncedAt: sync.lastSyncedAt,
      error: sync.syncError,
    };
  }

  async getEventSyncStatuses(
    eventId: string,
  ): Promise<
    Array<{
      scheduleId: string;
      userId: string;
      synced: boolean;
      googleEventId: string | null;
      status: GoogleSyncStatus;
    }>
  > {
    const syncs = await this.prisma.googleCalendarEventSync.findMany({
      where: { eventId },
      select: {
        scheduleId: true,
        userId: true,
        googleEventId: true,
        syncStatus: true,
      },
    });

    return syncs.map((sync) => ({
      scheduleId: sync.scheduleId,
      userId: sync.userId,
      synced: sync.syncStatus === GoogleSyncStatus.SYNCED,
      googleEventId: sync.googleEventId,
      status: sync.syncStatus,
    }));
  }

  async syncAllEventSchedules(eventId: string): Promise<void> {
    const schedules = await this.prisma.schedule.findMany({
      where: { eventId, status: { not: "CANCELADO" } },
      select: { id: true },
    });

    for (const schedule of schedules) {
      await this.syncSchedule(schedule.id);
    }
  }

  async unlinkAllEventSchedules(
    eventId: string,
  ): Promise<{ success: boolean; errors: string[] }> {
    const syncs = await this.prisma.googleCalendarEventSync.findMany({
      where: { eventId },
      select: { scheduleId: true, googleEventId: true, userId: true },
    });

    const errors: string[] = [];

    for (const sync of syncs) {
      if (sync.googleEventId) {
        const result = await this.deleteGoogleEventByGoogleId(
          sync.userId,
          sync.googleEventId,
        );
        if (!result.success && result.error) {
          errors.push(`Schedule ${sync.scheduleId}: ${result.error}`);
        }
      }
    }

    await this.prisma.googleCalendarEventSync.deleteMany({
      where: { eventId },
    });

    return { success: errors.length === 0, errors };
  }

  private async updateSyncError(
    scheduleId: string,
    error: string,
  ): Promise<void> {
    try {
      const existing = await this.prisma.googleCalendarEventSync.findUnique({
        where: { scheduleId },
        select: { userId: true, eventId: true },
      });

      if (existing) {
        await this.prisma.googleCalendarEventSync.update({
          where: { scheduleId },
          data: {
            syncStatus: GoogleSyncStatus.ERROR,
            syncError: error,
          },
        });
      } else {
        const schedule = await this.prisma.schedule.findUnique({
          where: { id: scheduleId },
          select: { volunteerId: true, eventId: true },
        });

        if (schedule) {
          await this.prisma.googleCalendarEventSync.create({
            data: {
              scheduleId,
              userId: schedule.volunteerId,
              eventId: schedule.eventId,
              syncStatus: GoogleSyncStatus.ERROR,
              syncError: error,
            },
          });
        }
      }
    } catch (updateError) {
      this.logger.error(
        `Failed to update sync error for schedule ${scheduleId}: ${updateError instanceof Error ? updateError.message : "unknown"}`,
      );
    }
  }

  private getHttpStatus(error: unknown): number | undefined {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof (error as Record<string, unknown>).code === "number"
    ) {
      return (error as { code: number }).code;
    }
    if (
      error &&
      typeof error === "object" &&
      "response" in error &&
      typeof (error as Record<string, unknown>).response === "object" &&
      (error as { response: Record<string, unknown> }).response !== null &&
      "status" in
        (error as { response: Record<string, unknown> }).response
    ) {
      return (
        (error as { response: { status: number } }).response.status
      );
    }
    return undefined;
  }

  private getCalendarClient(accessToken: string): calendar_v3.Calendar {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.calendar({ version: "v3", auth: oauth2Client });
  }
}
