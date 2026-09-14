import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class UpdateMinistryDto {
  @ApiPropertyOptional({ example: "Projeção" })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  nome?: string;

  @ApiPropertyOptional({
    example: "Equipe responsável por projeção de letras e mídia.",
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  descricao?: string;

  @ApiPropertyOptional({
    example: "a7b5b9b7-2f4d-4e38-9828-12ab34cd56ef",
    nullable: true,
  })
  @ValidateIf((o) => o.leaderId !== null)
  @IsUUID()
  @IsOptional()
  leaderId?: string | null;

  @ApiPropertyOptional({
    example: ["a7b5b9b7-2f4d-4e38-9828-12ab34cd56ef"],
    type: [String],
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  @IsOptional()
  memberIds?: string[];
}
