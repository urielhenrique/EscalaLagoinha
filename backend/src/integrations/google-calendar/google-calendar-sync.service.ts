import { Injectable, Logger } from "@nestjs/common";
import { GoogleSyncStatus } from "@prisma/client";
import { google, calendar_v3 } from "googleapis";
import { PrismaService } from "../../prisma/prisma.service";
import { GoogleCalendarService } from "./google-calendar.service";

const BRAZIL_TIMEZONE = "America/Sao_Paulo";
const EXTENDED_PROPERTY_SOURCE = "escala-facil";

interface SyncEventInput {
  eventId: string;
  churchId: string | null;
  nome: string;
  descricao: string | null;
  dataInicio: Date;
  dataFim: Date;
  recurrenceGroupId: string | null;
}

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

  buildGoogleEventId(eventId: string): string {
    const normalized = eventId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
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

  async syncEvent(
    userId: string,
    input: SyncEventInput,
  ): Promise<SyncResult> {
    try {
      const connection =
        await this.prisma.googleCalendarConnection.findUnique({
          where: { userId },
          select: { calendarId: true },
        });

      const calendarId = connection?.calendarId || "primary";

      const existingEvent =
        await this.prisma.event.findUnique({
          where: { id: input.eventId },
          select: { googleEventId: true, googleSyncStatus: true },
        });

      if (
        existingEvent?.googleSyncStatus === GoogleSyncStatus.SYNCED &&
        existingEvent.googleEventId
      ) {
        return await this.retryWithRefresh(userId, (accessToken) =>
          this.updateGoogleEvent(
            accessToken,
            calendarId,
            input,
            existingEvent.googleEventId!,
          ),
        );
      }

      return await this.retryWithRefresh(userId, (accessToken) =>
        this.createGoogleEvent(accessToken, calendarId, input),
      );
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      this.logger.error(
        `Sync failed for event ${input.eventId}: ${errorMsg}`,
      );
      await this.updateEventSyncError(input.eventId, errorMsg);
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
    input: SyncEventInput,
  ): Promise<SyncResult> {
    const calendar = this.getCalendarClient(accessToken);

    const googleEventId = this.buildGoogleEventId(input.eventId);

    const eventBody: calendar_v3.Schema$Event = {
      id: googleEventId,
      summary: input.nome,
      description: input.descricao || undefined,
      start: {
        dateTime: this.toGoogleDateTime(input.dataInicio),
        timeZone: BRAZIL_TIMEZONE,
      },
      end: {
        dateTime: this.toGoogleDateTime(input.dataFim),
        timeZone: BRAZIL_TIMEZONE,
      },
      extendedProperties: {
        private: {
          [EXTENDED_PROPERTY_SOURCE]: "true",
          eventId: input.eventId,
          churchId: input.churchId || "",
          recurrenceGroupId: input.recurrenceGroupId || "",
        },
      },
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: eventBody,
      conferenceDataVersion: 0,
    });

    const createdGoogleId = response.data.id || googleEventId;

    await this.prisma.event.update({
      where: { id: input.eventId },
      data: {
        googleEventId: createdGoogleId,
        googleSyncStatus: GoogleSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
        googleSyncError: null,
      },
    });

    this.logger.log(
      `Event ${input.eventId} created in Google Calendar as ${createdGoogleId}.`,
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
    input: SyncEventInput,
    existingGoogleEventId: string,
  ): Promise<SyncResult> {
    const calendar = this.getCalendarClient(accessToken);

    const eventBody: calendar_v3.Schema$Event = {
      summary: input.nome,
      description: input.descricao || undefined,
      start: {
        dateTime: this.toGoogleDateTime(input.dataInicio),
        timeZone: BRAZIL_TIMEZONE,
      },
      end: {
        dateTime: this.toGoogleDateTime(input.dataFim),
        timeZone: BRAZIL_TIMEZONE,
      },
      extendedProperties: {
        private: {
          [EXTENDED_PROPERTY_SOURCE]: "true",
          eventId: input.eventId,
          churchId: input.churchId || "",
          recurrenceGroupId: input.recurrenceGroupId || "",
        },
      },
    };

    try {
      await calendar.events.update({
        calendarId,
        eventId: existingGoogleEventId,
        requestBody: eventBody,
      });

      await this.prisma.event.update({
        where: { id: input.eventId },
        data: {
          googleSyncStatus: GoogleSyncStatus.SYNCED,
          lastSyncedAt: new Date(),
          googleSyncError: null,
        },
      });

      this.logger.log(
        `Event ${input.eventId} updated in Google Calendar (${existingGoogleEventId}).`,
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
          `Google event ${existingGoogleEventId} not found (404). Recreating.`,
        );
        await this.prisma.event.update({
          where: { id: input.eventId },
          data: {
            googleEventId: null,
            googleSyncStatus: GoogleSyncStatus.NONE,
            lastSyncedAt: null,
            googleSyncError: null,
          },
        });
        return this.createGoogleEvent(accessToken, calendarId, input);
      }
      throw error;
    }
  }

  async deleteGoogleEvent(
    userId: string,
    eventId: string,
  ): Promise<{ success: boolean; error: string | null }> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { googleEventId: true, googleSyncStatus: true },
    });

    if (!event?.googleEventId) {
      return { success: true, error: null };
    }

    const googleEventId = event.googleEventId;

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
          `Failed to delete Google event for ${eventId}: ${errorMsg}`,
        );
        return { success: false, error: errorMsg };
      }
    }

    await this.prisma.event.update({
      where: { id: eventId },
      data: {
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
        lastSyncedAt: null,
        googleSyncError: null,
      },
    });

    this.logger.log(
      `Event ${eventId} unlinked from Google Calendar (${googleEventId}).`,
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

  private async updateEventSyncError(
    eventId: string,
    error: string,
  ): Promise<void> {
    try {
      await this.prisma.event.update({
        where: { id: eventId },
        data: {
          googleSyncStatus: GoogleSyncStatus.ERROR,
          googleSyncError: error,
        },
      });
    } catch (updateError) {
      this.logger.error(
        `Failed to update sync error for event ${eventId}: ${updateError instanceof Error ? updateError.message : "unknown"}`,
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
