import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class CreateSwapRequestDto {
  @ApiProperty({ example: "9be63ab4-8b94-4fd7-a2ad-e57cb45f6f35" })
  @IsUUID()
  requesterShiftId!: string;

  @ApiProperty({ example: "c3a21cb5-3ce2-4d8d-bcde-b50319d802f1" })
  @IsUUID()
  requestedShiftId!: string;

  @ApiProperty({ example: "9d8449fb-a4ac-4ea1-bf0d-7d15ec4180e2" })
  @IsUUID()
  requestedVolunteerId!: string;
}
