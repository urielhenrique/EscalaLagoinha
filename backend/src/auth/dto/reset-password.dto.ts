import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class ResetPasswordDto {
  @ApiProperty({ description: "Token recebido por email" })
  @IsString()
  token!: string;

  @ApiProperty({ example: "NovaSenha@123", minLength: 8 })
  @IsString()
  @MinLength(8)
  novaSenha!: string;
}
