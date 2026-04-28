import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateEventDto {
  @ApiPropertyOptional({ example: "Culto Domingo Manhã" })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  nome?: string;

  @ApiPropertyOptional({ example: "Celebração dominical da manhã." })
  @IsString()
  @IsOptional()
  @MaxLength(800)
  descricao?: string;

  @ApiPropertyOptional({ example: "2026-05-03T09:00:00.000Z" })
  @IsDateString()
  @IsOptional()
  dataInicio?: string;

  @ApiPropertyOptional({ example: "2026-05-03T11:00:00.000Z" })
  @IsDateString()
  @IsOptional()
  dataFim?: string;

  @ApiPropertyOptional({ example: "SEMANAL" })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  recorrencia?: string;
}
