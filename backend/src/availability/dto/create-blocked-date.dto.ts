import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateBlockedDateDto {
  @ApiProperty({ example: "2026-08-12" })
  @IsDateString()
  date!: string;

  @ApiProperty({
    example: "2026-08-14",
    required: false,
    description: "Data final opcional para bloquear um período (inclusivo).",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ example: "Viagem em família" })
  @IsString()
  @MaxLength(180)
  reason!: string;
}
