import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches } from "class-validator";

export class CreateChurchDto {
  @ApiProperty({ example: "Lagoinha Jardim Atlantico" })
  @IsString()
  nome!: string;

  @ApiProperty({ example: "lagoinha-jardim-atlantico" })
  @IsString()
  @Matches(/^[a-z0-9-]{3,64}$/)
  slug!: string;

  @ApiPropertyOptional({ example: "Av. Principal, 100" })
  @IsString()
  @IsOptional()
  endereco?: string;

  @ApiPropertyOptional({ example: "Belo Horizonte" })
  @IsString()
  @IsOptional()
  cidade?: string;

  @ApiPropertyOptional({ example: "MG" })
  @IsString()
  @IsOptional()
  estado?: string;

  @ApiPropertyOptional({ example: "https://cdn.exemplo.com/logo.png" })
  @IsString()
  @IsOptional()
  logo?: string;

  @ApiPropertyOptional({ example: "Pastor Fulano" })
  @IsString()
  @IsOptional()
  responsavelPrincipal?: string;
}
