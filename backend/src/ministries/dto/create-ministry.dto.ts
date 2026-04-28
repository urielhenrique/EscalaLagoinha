import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class CreateMinistryDto {
  @ApiProperty({ example: "Transmissão" })
  @IsString()
  @MaxLength(120)
  nome!: string;

  @ApiProperty({ example: "Equipe responsável pela transmissão online." })
  @IsString()
  @MaxLength(500)
  descricao!: string;

  @ApiPropertyOptional({ example: "a7b5b9b7-2f4d-4e38-9828-12ab34cd56ef" })
  @IsUUID()
  @IsOptional()
  leaderId?: string;

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
