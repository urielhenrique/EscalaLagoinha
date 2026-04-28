import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Perfil } from "@prisma/client";
import { JwtPayload } from "../strategies/jwt.strategy";

export const ROLES_KEY = "roles";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Perfil[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const { user }: { user: JwtPayload } = context.switchToHttp().getRequest();

    // Perfis com acesso total
    if (
      user.perfil === Perfil.MASTER_ADMIN ||
      user.perfil === Perfil.MASTER_PLATFORM_ADMIN
    ) {
      return true;
    }

    if (!required.includes(user.perfil)) {
      throw new ForbiddenException("Acesso negado: perfil insuficiente.");
    }

    return true;
  }
}
