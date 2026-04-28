import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class CreateInviteLinkDto {
  @ApiPropertyOptional({ example: "Louvor" })
  @IsString()
  @IsOptional()
  ministryName?: string;
}
