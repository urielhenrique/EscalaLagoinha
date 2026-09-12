import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { IsStrongPassword } from "../../common/validators/is-strong-password.validator";

export class ResetPasswordDto {
  @ApiProperty({ description: "Token recebido por email" })
  @IsString()
  token!: string;

  @ApiProperty({ example: "NovaSenha@123", minLength: 8 })
  @IsString()
  @IsStrongPassword()
  novaSenha!: string;
}
