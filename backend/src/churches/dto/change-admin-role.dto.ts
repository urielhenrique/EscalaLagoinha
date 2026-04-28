import { ApiProperty } from "@nestjs/swagger";
import { Perfil } from "@prisma/client";
import { IsEnum, IsIn } from "class-validator";

export class ChangeAdminRoleDto {
  @ApiProperty({
    enum: [Perfil.VOLUNTARIO, Perfil.ADMIN, Perfil.MASTER_ADMIN],
    example: Perfil.ADMIN,
  })
  @IsEnum(Perfil)
  @IsIn([Perfil.VOLUNTARIO, Perfil.ADMIN, Perfil.MASTER_ADMIN])
  perfil!: Perfil;
}
