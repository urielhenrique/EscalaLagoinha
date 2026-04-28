import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Perfil } from "@prisma/client";
import {
  IsEmail,
  IsIn,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";

export class CreateUserDto {
  @ApiProperty({ example: "Maria Souza" })
  @IsString()
  nome!: string;

  @ApiProperty({ example: "maria@schedulewell.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "voluntario123", minLength: 6 })
  @IsString()
  @MinLength(6)
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
