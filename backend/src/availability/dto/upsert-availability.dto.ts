import { ApiProperty } from "@nestjs/swagger";
import {
  AvailabilityDayOfWeek,
  AvailabilityPeriod,
  AvailabilityPreference,
} from "@prisma/client";
import { IsArray, IsEnum, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class AvailabilitySlotDto {
  @ApiProperty({ enum: AvailabilityDayOfWeek })
  @IsEnum(AvailabilityDayOfWeek)
  dayOfWeek!: AvailabilityDayOfWeek;

  @ApiProperty({ enum: AvailabilityPeriod })
  @IsEnum(AvailabilityPeriod)
  period!: AvailabilityPeriod;

  @ApiProperty({ enum: AvailabilityPreference })
  @IsEnum(AvailabilityPreference)
  preference!: AvailabilityPreference;
}

export class UpsertAvailabilityDto {
  @ApiProperty({ type: [AvailabilitySlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  slots!: AvailabilitySlotDto[];
}
