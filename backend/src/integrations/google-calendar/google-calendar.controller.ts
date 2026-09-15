import {
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from "@nestjs/swagger";
import { Response } from "express";
import { Perfil } from "@prisma/client";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Public } from "../../auth/decorators/public.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtPayload } from "../../auth/strategies/jwt.strategy";
import { GoogleCalendarService } from "./google-calendar.service";
import { ResponseMessage } from "../../common/decorators/response-message.decorator";

@ApiTags("Google Calendar Integration")
@ApiBearerAuth("JWT-auth")
@Controller("integrations/google")
export class GoogleCalendarController {
  private readonly logger = new Logger(GoogleCalendarController.name);

  constructor(
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

  @Get("connect")
  @Roles(Perfil.VOLUNTARIO, Perfil.LEADER, Perfil.ADMIN)
  @ResponseMessage("URL de autorização gerada com sucesso.")
  @ApiOperation({
    summary: "Gerar URL de autorização Google OAuth",
    description:
      "Gera uma URL para redirecionar o usuário ao Google OAuth para autorizar o acesso ao Calendar.",
  })
  connect(@CurrentUser() user: JwtPayload): { authorizationUrl: string } {
    this.logger.debug(`Connect requested by user ${user.sub}`);

    const authorizationUrl =
      this.googleCalendarService.getAuthorizationUrl(user.sub);

    return { authorizationUrl };
  }

  @Get("callback")
  @Public()
  @ApiOperation({
    summary: "Callback do Google OAuth",
    description:
      "Recebe o code e state do Google OAuth, valida e redireciona para o frontend.",
  })
  @ApiQuery({ name: "code", required: true, type: String })
  @ApiQuery({ name: "state", required: true, type: String })
  @ApiQuery({ name: "error", required: false, type: String })
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    if (error) {
      this.logger.warn(`OAuth callback error from Google: ${error}`);
      const redirectUrl =
        this.googleCalendarService.getFrontendRedirectUrl(
          "error",
          "Autorização cancelada pelo usuário.",
        );
      res.redirect(redirectUrl);
      return;
    }

    if (!code || !state) {
      this.logger.warn("OAuth callback missing code or state");
      const redirectUrl =
        this.googleCalendarService.getFrontendRedirectUrl(
          "error",
          "Parâmetros inválidos no callback.",
        );
      res.redirect(redirectUrl);
      return;
    }

    try {
      const result =
        await this.googleCalendarService.exchangeCode(code, state);

      this.logger.log(
        `OAuth callback completed for user ${result.userId}`,
      );

      const redirectUrl =
        this.googleCalendarService.getFrontendRedirectUrl("connected");
      res.redirect(redirectUrl);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erro ao processar autorização.";

      this.logger.error(`OAuth callback failed: ${message}`);

      const redirectUrl =
        this.googleCalendarService.getFrontendRedirectUrl(
          "error",
          "Erro ao processar autorização com o Google.",
        );
      res.redirect(redirectUrl);
    }
  }

  @Get("status")
  @Roles(Perfil.VOLUNTARIO, Perfil.LEADER, Perfil.ADMIN)
  @ResponseMessage("Status da integração Google Calendar.")
  @ApiOperation({
    summary: "Status da conexão Google Calendar",
    description:
      "Retorna o status da conexão do usuário com o Google Calendar.",
  })
  async getStatus(@CurrentUser() user: JwtPayload) {
    this.logger.debug(`Status requested by user ${user.sub}`);
    return this.googleCalendarService.getStatus(user.sub);
  }

  @Post("disconnect")
  @Roles(Perfil.VOLUNTARIO, Perfil.LEADER, Perfil.ADMIN)
  @ResponseMessage("Desconectado do Google Calendar.")
  @ApiOperation({
    summary: "Desconectar Google Calendar",
    description:
      "Remove a conexão do usuário com o Google Calendar e revoga o token.",
  })
  async disconnect(@CurrentUser() user: JwtPayload) {
    this.logger.debug(`Disconnect requested by user ${user.sub}`);
    return this.googleCalendarService.disconnect(user.sub);
  }
}
