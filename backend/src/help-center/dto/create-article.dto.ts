import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { ArticleCategory } from "@prisma/client";

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  titulo: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  conteudo: string;

  @IsEnum(ArticleCategory)
  @IsOptional()
  categoria?: ArticleCategory;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsBoolean()
  @IsOptional()
  publicado?: boolean;

  @IsString()
  @IsNotEmpty()
  slug: string;
}
