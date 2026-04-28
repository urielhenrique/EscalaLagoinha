import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength, Matches } from "class-validator";

export class OnboardingChurchDto {
  @ApiProperty({ example: "Lagoinha Campinas" })
  @IsString()
  churchName!: string;

  @ApiProperty({ example: "lagoinha-campinas" })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Slug deve conter apenas letras minúsculas, números e hífens.",
  })
  churchSlug!: string;

  @ApiProperty({ example: "Rua Exemplo, 100" })
  @IsString()
  churchAddress!: string;

  @ApiProperty({ example: "Campinas" })
  @IsString()
  churchCity!: string;

  @ApiProperty({ example: "SP" })
  @IsString()
  churchState!: string;

  @ApiProperty({ example: "Pastor(a) João" })
  @IsString()
  responsibleName!: string;

  @ApiProperty({ example: "Ana Admin" })
  @IsString()
  adminName!: string;

  @ApiProperty({ example: "ana@igreja.com" })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ example: "(11) 99999-9999" })
  @IsString()
  adminPhone!: string;

  @ApiProperty({ example: "senhaForte123", minLength: 6 })
  @IsString()
  @MinLength(6)
  adminPassword!: string;
}
