import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString } from "class-validator";
import { IsStrongPassword } from "../../common/validators/is-strong-password.validator";

export class RegisterDto {
  @ApiProperty({ example: "Admin Principal" })
  @IsString()
  nome!: string;

  @ApiProperty({ example: "admin@schedulewell.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Admin@123", minLength: 8 })
  @IsString()
  @IsStrongPassword()
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
