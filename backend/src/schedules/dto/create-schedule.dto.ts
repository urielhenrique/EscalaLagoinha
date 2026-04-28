import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ScheduleStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsUUID } from "class-validator";

export class CreateScheduleDto {
  @ApiProperty({ example: "9be63ab4-8b94-4fd7-a2ad-e57cb45f6f35" })
  @IsUUID()
  eventId!: string;

  @ApiProperty({ example: "b2ee0a0f-36d2-4ff7-a1b2-aa0192f4f204" })
  @IsUUID()
  ministryId!: string;

  @ApiProperty({ example: "9d8449fb-a4ac-4ea1-bf0d-7d15ec4180e2" })
  @IsUUID()
  volunteerId!: string;

  @ApiPropertyOptional({
    enum: ScheduleStatus,
    example: ScheduleStatus.PENDENTE,
  })
  @IsEnum(ScheduleStatus)
  @IsOptional()
  status?: ScheduleStatus;
}
