import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "Admin Principal" })
  @IsString()
  nome!: string;

  @ApiProperty({ example: "admin@schedulewell.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "admin123", minLength: 6 })
  @IsString()
  @MinLength(6)
  senha!: string;

  @ApiProperty({ example: "(31) 99999-0001" })
  @IsString()
  telefone!: string;

  @ApiPropertyOptional({ example: "https://example.com/foto-admin.jpg" })
  @IsString()
  @IsOptional()
  foto?: string;

  @ApiPropertyOptional({ example: "lagoinha-sede" })
  @IsString()
  @IsOptional()
  churchSlug?: string;
}
