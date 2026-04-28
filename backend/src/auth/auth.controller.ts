import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Public } from "./decorators/public.decorator";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { OnboardingChurchDto } from "./dto/onboarding-church.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { UpdateMeDto } from "./dto/update-me.dto";
import { JwtPayload } from "./strategies/jwt.strategy";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  @ApiOperation({ summary: "Registrar novo voluntário (inicia como PENDENTE)" })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({ description: "Cadastro realizado — aguardando aprovação." })
  @ResponseMessage("Cadastro realizado. Aguarde a aprovação do líder.")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post("onboarding")
  @ApiOperation({ summary: "Onboarding inicial de igreja e admin" })
  @ApiBody({ type: OnboardingChurchDto })
  @ApiOkResponse({ description: "Onboarding concluído com sucesso." })
  @ResponseMessage("Onboarding concluído com sucesso.")
  onboarding(@Body() dto: OnboardingChurchDto) {
    return this.authService.onboardChurch(dto);
  }

  @Public()
  @Post("login")
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Autenticar usuário e retornar token JWT" })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: "Login realizado com sucesso." })
  @ApiUnauthorizedResponse({ description: "Credenciais inválidas." })
  @ResponseMessage("Login realizado com sucesso.")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get("me")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Retornar dados completos do usuário autenticado" })
  @ApiOkResponse({ description: "Usuário retornado com sucesso." })
  @ResponseMessage("Usuário retornado com sucesso.")
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }

  @Patch("me")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Atualizar dados do usuário autenticado" })
  @ApiOkResponse({ description: "Perfil atualizado com sucesso." })
  @ResponseMessage("Perfil atualizado com sucesso.")
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMeDto) {
    return this.authService.updateMe(user.sub, dto);
  }

  @Public()
  @Post("forgot-password")
  @Throttle({ auth: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Solicitar link de recuperação de senha por email" })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOkResponse({ description: "Se o email existir, um link será enviado." })
  @ResponseMessage("Se o email existir, um link de recuperação será enviado.")
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
  }

  @Public()
  @Post("reset-password")
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Redefinir senha com token recebido por email" })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({ description: "Senha redefinida com sucesso." })
  @ResponseMessage("Senha redefinida com sucesso.")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
