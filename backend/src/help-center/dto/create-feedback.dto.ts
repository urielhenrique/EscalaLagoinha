import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { FeedbackType } from "@prisma/client";

export class CreateFeedbackDto {
  @IsEnum(FeedbackType)
  tipo: FeedbackType;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  titulo: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  descricao: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  paginaOrigem?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  avaliacao?: number;
}
