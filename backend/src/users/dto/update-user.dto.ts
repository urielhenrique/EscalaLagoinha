import { ApiPropertyOptional } from "@nestjs/swagger";
import { Perfil } from "@prisma/client";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from "class-validator";

export class UpdateUserDto {
  @ApiPropertyOptional({ example: "Maria Souza Lima" })
  @IsString()
  @IsOptional()
  nome?: string;

  @ApiPropertyOptional({ example: "maria.lima@schedulewell.com" })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: "(31) 97777-2222" })
  @IsString()
  @IsOptional()
  telefone?: string;

  @ApiPropertyOptional({ example: "https://example.com/foto-maria-nova.jpg" })
  @IsString()
  @IsOptional()
  foto?: string;

  @ApiPropertyOptional({ enum: Perfil, example: Perfil.VOLUNTARIO })
  @IsEnum(Perfil)
  @IsOptional()
  perfil?: Perfil;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}
