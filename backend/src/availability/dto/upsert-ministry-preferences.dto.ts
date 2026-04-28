import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsUUID } from "class-validator";

export class UpsertMinistryPreferencesDto {
  @ApiProperty({ type: [String], default: [] })
  @IsArray()
  @IsUUID("4", { each: true })
  preferredMinistryIds!: string[];

  @ApiProperty({ type: [String], default: [] })
  @IsArray()
  @IsUUID("4", { each: true })
  unavailableMinistryIds!: string[];
}
