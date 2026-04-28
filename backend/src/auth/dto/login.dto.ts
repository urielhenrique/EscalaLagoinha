import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "admin@schedulewell.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "admin123", minLength: 6 })
  @IsString()
  @MinLength(6)
  senha!: string;
}
