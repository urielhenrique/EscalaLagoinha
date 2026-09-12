import {
  BadRequestException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { google } from "googleapis";
import { PrismaService } from "../../prisma/prisma.service";
import { GoogleOAuthStateService } from "./google-oauth-state.service";
import { GoogleEncryptionService } from "./google-encryption.service";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly oauth2Client;

  constructor(
    private readonly config: ConfigService,
    private readonly stateService: GoogleOAuthStateService,
    private readonly prisma: PrismaService,
    private readonly encryption: GoogleEncryptionService,
  ) {
    const clientId = this.config.get<string>("GOOGLE_CLIENT_ID");
    const clientSecret = this.config.get<string>("GOOGLE_CLIENT_SECRET");
    const redirectUri = this.config.get<string>("GOOGLE_REDIRECT_URI");

    if (!clientId || !clientSecret || !redirectUri) {
      this.logger.warn(
        "Google Calendar integration disabled: missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REDIRECT_URI",
      );
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId || "",
      clientSecret || "",
      redirectUri || "",
    );
  }

  getAuthorizationUrl(userId: string): string {
    this.assertConfigured();

    const state = this.stateService.create(userId);

    const url = this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: true,
      scope: [CALENDAR_SCOPE],
      state,
    });

    this.logger.debug(`Authorization URL generated for user ${userId}`);
    return url;
  }

  async exchangeCode(
    code: string,
    state: string,
  ): Promise<{ userId: string }> {
    this.assertConfigured();
    this.encryption.assertConfigured();

    const stateResult = this.stateService.consume(state);

    if ("error" in stateResult) {
      throw new BadRequestException(stateResult.error);
    }

    const { userId } = stateResult;

    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      const accessToken = tokens.access_token;
      const refreshToken = tokens.refresh_token;
      const expiresAt = tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : undefined;
      const scope = tokens.scope || CALENDAR_SCOPE;
      const googleAccountId = tokens.id_token
        ? this.extractGoogleAccountId(tokens.id_token)
        : undefined;

      if (!accessToken || !expiresAt) {
        throw new BadRequestException(
          "Tokens incompletos recebidos do Google.",
        );
      }

      const accessTokenEnc = this.encryption.encrypt(accessToken);

      let refreshTokenEnc: string | null = null;
      if (refreshToken) {
        refreshTokenEnc = this.encryption.encrypt(refreshToken);
      }

      const existing = await this.prisma.googleCalendarConnection.findUnique({
        where: { userId },
      });

      if (existing) {
        const updateData: Record<string, unknown> = {
          accessTokenEnc,
          expiresAt,
          scope,
          updatedAt: new Date(),
        };

        if (googleAccountId) {
          updateData.googleAccountId = googleAccountId;
        }

        if (refreshTokenEnc) {
          updateData.refreshTokenEnc = refreshTokenEnc;
        }

        await this.prisma.googleCalendarConnection.update({
          where: { userId },
          data: updateData,
        });

        this.logger.log(
          `Google Calendar connection updated for user ${userId}.`,
        );
      } else {
        if (!refreshTokenEnc) {
          throw new BadRequestException(
            "Refresh token não fornecido pelo Google para nova conexão.",
          );
        }

        await this.prisma.googleCalendarConnection.create({
          data: {
            userId,
            accessTokenEnc,
            refreshTokenEnc,
            expiresAt,
            scope,
            googleAccountId: googleAccountId || null,
          },
        });

        this.logger.log(
          `Google Calendar connection created for user ${userId}.`,
        );
      }

      return { userId };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to exchange OAuth code for user ${userId}`);
      throw new BadRequestException(
        "Não foi possível completar a autorização com o Google.",
      );
    }
  }

  async getStatus(userId: string): Promise<{
    connected: boolean;
    googleAccountId: string | null;
    calendarId: string | null;
    scope: string | null;
    connectedAt: Date | null;
    expiresAt: Date | null;
  }> {
    const connection =
      await this.prisma.googleCalendarConnection.findUnique({
        where: { userId },
        select: {
          googleAccountId: true,
          calendarId: true,
          scope: true,
          createdAt: true,
          expiresAt: true,
        },
      });

    if (!connection) {
      return {
        connected: false,
        googleAccountId: null,
        calendarId: null,
        scope: null,
        connectedAt: null,
        expiresAt: null,
      };
    }

    return {
      connected: true,
      googleAccountId: connection.googleAccountId,
      calendarId: connection.calendarId,
      scope: connection.scope,
      connectedAt: connection.createdAt,
      expiresAt: connection.expiresAt,
    };
  }

  async disconnect(userId: string): Promise<{ success: boolean }> {
    const connection =
      await this.prisma.googleCalendarConnection.findUnique({
        where: { userId },
        select: { refreshTokenEnc: true },
      });

    if (!connection) {
      return { success: true };
    }

    try {
      const refreshToken = this.encryption.decrypt(
        connection.refreshTokenEnc,
      );
      await this.revokeGoogleToken(refreshToken);
    } catch (error) {
      this.logger.warn(
        `Failed to revoke Google token for user ${userId}: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }

    await this.prisma.googleCalendarConnection.delete({
      where: { userId },
    });

    this.logger.log(`Google Calendar disconnected for user ${userId}.`);
    return { success: true };
  }

  async refreshAccessToken(userId: string): Promise<string | null> {
    const connection =
      await this.prisma.googleCalendarConnection.findUnique({
        where: { userId },
        select: {
          accessTokenEnc: true,
          refreshTokenEnc: true,
          expiresAt: true,
        },
      });

    if (!connection) {
      return null;
    }

    const now = new Date();
    const bufferMs = 5 * 60 * 1000;

    if (connection.expiresAt.getTime() - bufferMs > now.getTime()) {
      return this.encryption.decrypt(connection.accessTokenEnc);
    }

    const refreshToken = this.encryption.decrypt(
      connection.refreshTokenEnc,
    );

    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { token: newAccessToken } =
        await this.oauth2Client.getAccessToken();

      if (!newAccessToken) {
        throw new Error("No access token returned from refresh.");
      }

      const newExpiryDate = new Date();
      newExpiryDate.setSeconds(newExpiryDate.getSeconds() + 3600);

      const newAccessTokenEnc = this.encryption.encrypt(newAccessToken);

      await this.prisma.googleCalendarConnection.update({
        where: { userId },
        data: {
          accessTokenEnc: newAccessTokenEnc,
          expiresAt: newExpiryDate,
          updatedAt: new Date(),
        },
      });

      this.logger.debug(`Access token refreshed for user ${userId}.`);
      return newAccessToken;
    } catch {
      this.logger.error(
        `Failed to refresh access token for user ${userId}`,
      );
      return null;
    }
  }

  async getStoredAccessToken(userId: string): Promise<string | null> {
    const connection =
      await this.prisma.googleCalendarConnection.findUnique({
        where: { userId },
        select: {
          accessTokenEnc: true,
        },
      });

    if (!connection) {
      return null;
    }

    return this.encryption.decrypt(connection.accessTokenEnc);
  }

  getFrontendRedirectUrl(
    status: "connected" | "error",
    error?: string,
  ): string {
    const frontendUrl =
      this.config.get<string>("FRONTEND_URL") ||
      this.config.get<string>("APP_URL") ||
      "http://localhost:5173";

    const params = new URLSearchParams();
    params.set("google_calendar", status);
    if (error) {
      params.set("google_error", error);
    }

    return `${frontendUrl}?${params.toString()}`;
  }

  assertConfigured(): void {
    const clientId = this.config.get<string>("GOOGLE_CLIENT_ID");
    const clientSecret = this.config.get<string>("GOOGLE_CLIENT_SECRET");
    const redirectUri = this.config.get<string>("GOOGLE_REDIRECT_URI");

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException(
        "Integração com Google Calendar não configurada.",
      );
    }
  }

  private async revokeGoogleToken(token: string): Promise<void> {
    try {
      const oauth2 = google.oauth2({ version: "v2", auth: this.oauth2Client });
      await oauth2.tokeninfo({ access_token: token });
    } catch {
      this.logger.debug("Token already invalid or revoked with Google.");
    }

    try {
      await this.oauth2Client.revokeToken(token);
    } catch (error) {
      this.logger.warn(
        `Google revoke token error: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  private extractGoogleAccountId(idToken: string): string | null {
    try {
      const parts = idToken.split(".");
      if (parts.length !== 3) return null;
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf8"),
      );
      return payload.sub || null;
    } catch {
      return null;
    }
  }
}
