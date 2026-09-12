import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export enum RecurrenceTypeDto {
  NONE = "NONE",
  WEEKLY = "WEEKLY",
}

export class RecurrenceConfigDto {
  @ApiProperty({ example: "WEEKLY", enum: RecurrenceTypeDto })
  @IsEnum(RecurrenceTypeDto)
  type!: RecurrenceTypeDto;

  @ApiProperty({ example: "2026-10-04T00:00:00.000Z" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: "2026-12-27T00:00:00.000Z" })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ example: ["DOMINGO"], isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  daysOfWeek!: string[];
}

export class CreateEventDto {
  @ApiProperty({ example: "Culto Domingo Noite" })
  @IsString()
  @MaxLength(120)
  nome!: string;

  @ApiProperty({ example: "Celebração principal de domingo à noite." })
  @IsString()
  @MaxLength(800)
  descricao!: string;

  @ApiProperty({ example: "2026-10-04T19:00:00.000Z" })
  @IsDateString()
  dataInicio!: string;

  @ApiProperty({ example: "2026-10-04T21:00:00.000Z" })
  @IsDateString()
  dataFim!: string;

  @ApiPropertyOptional({ example: "SEMANAL" })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  recorrencia?: string;

  @ApiPropertyOptional({ type: RecurrenceConfigDto })
  @ValidateNested()
  @Type(() => RecurrenceConfigDto)
  @IsOptional()
  recurrence?: RecurrenceConfigDto;
}
