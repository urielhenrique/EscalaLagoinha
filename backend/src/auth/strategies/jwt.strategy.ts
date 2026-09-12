import {
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Perfil } from "@prisma/client";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../prisma/prisma.service";

export interface JwtPayload {
  sub: string;
  email: string;
  perfil: Perfil;
  churchId?: string;
  churchSlug?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        passwordChangedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("Usuário não encontrado.");
    }

    if (user.passwordChangedAt && payload.iat) {
      const passwordChangedTimestamp = Math.floor(
        user.passwordChangedAt.getTime() / 1000,
      );
      if (passwordChangedTimestamp > payload.iat) {
        this.logger.warn(
          `Token rejeitado: senha alterada após emissão. userId=${payload.sub}`,
        );
        throw new UnauthorizedException(
          "Sessão expirada. Faça login novamente.",
        );
      }
    }

    return payload;
  }
}
