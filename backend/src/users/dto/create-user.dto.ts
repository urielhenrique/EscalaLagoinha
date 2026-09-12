import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Perfil } from "@prisma/client";
import {
  IsEmail,
  IsIn,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import { IsStrongPassword } from "../../common/validators/is-strong-password.validator";

export class CreateUserDto {
  @ApiProperty({ example: "Maria Souza" })
  @IsString()
  nome!: string;

  @ApiProperty({ example: "maria@schedulewell.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Maria@123", minLength: 8 })
  @IsString()
  @IsStrongPassword()
  senha!: string;

  @ApiProperty({ example: "(31) 98888-1111" })
  @IsString()
  telefone!: string;

  @ApiPropertyOptional({ example: "https://example.com/foto-maria.jpg" })
  @IsString()
  @IsOptional()
  foto?: string;

  @ApiPropertyOptional({
    enum: [Perfil.ADMIN, Perfil.VOLUNTARIO],
    example: Perfil.VOLUNTARIO,
  })
  @IsEnum(Perfil)
  @IsIn([Perfil.ADMIN, Perfil.VOLUNTARIO])
  @IsOptional()
  perfil?: Perfil;

  @ApiPropertyOptional({ format: "uuid" })
  @IsUUID()
  @IsOptional()
  churchId?: string;
}
