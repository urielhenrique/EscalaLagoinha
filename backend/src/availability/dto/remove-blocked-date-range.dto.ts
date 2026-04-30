import { ApiProperty } from "@nestjs/swagger";
import { IsDateString } from "class-validator";

export class RemoveBlockedDateRangeDto {
  @ApiProperty({ example: "2026-05-01" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: "2026-05-03" })
  @IsDateString()
  endDate!: string;
}
