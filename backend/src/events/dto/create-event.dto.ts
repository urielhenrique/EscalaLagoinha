import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateEventDto {
  @ApiProperty({ example: "Culto Domingo Noite" })
  @IsString()
  @MaxLength(120)
  nome!: string;

  @ApiProperty({ example: "Celebração principal de domingo à noite." })
  @IsString()
  @MaxLength(800)
  descricao!: string;

  @ApiProperty({ example: "2026-05-03T19:00:00.000Z" })
  @IsDateString()
  dataInicio!: string;

  @ApiProperty({ example: "2026-05-03T21:00:00.000Z" })
  @IsDateString()
  dataFim!: string;

  @ApiPropertyOptional({ example: "SEMANAL" })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  recorrencia?: string;
}
