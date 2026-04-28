import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBooleanString, IsOptional } from "class-validator";

export class ListNotificationsDto {
  @ApiPropertyOptional({
    description: "Filtrar somente não lidas",
    example: "true",
  })
  @IsBooleanString()
  @IsOptional()
  unreadOnly?: string;
}
