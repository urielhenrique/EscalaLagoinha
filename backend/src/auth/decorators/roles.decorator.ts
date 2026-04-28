import { SetMetadata } from "@nestjs/common";
import { Perfil } from "@prisma/client";
import { ROLES_KEY } from "../guards/roles.guard";

export const Roles = (...roles: Perfil[]) => SetMetadata(ROLES_KEY, roles);
