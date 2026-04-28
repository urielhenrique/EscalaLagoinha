import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class GenerateSmartScheduleDto {
  @ApiPropertyOptional({
    description:
      "Ministérios-alvo. Se omitido, considera todos os ministérios.",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID("4", { each: true })
  ministryIds?: string[];

  @ApiPropertyOptional({
    description: "Quantidade de voluntários por ministério.",
    example: 1,
    minimum: 1,
    maximum: 8,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  slotsPerMinistry?: number;
}
