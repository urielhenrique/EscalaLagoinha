import { ApiPropertyOptional } from "@nestjs/swagger";
import { ApprovalPolicy } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class UpdateChurchSettingsDto {
  @ApiPropertyOptional({ example: "Lagoinha Jardim Atlantico" })
  @IsString()
  @IsOptional()
  customChurchName?: string;

  @ApiPropertyOptional({ example: "Escala Pro" })
  @IsString()
  @IsOptional()
  customPlatformName?: string;

  @ApiPropertyOptional({ example: "https://cdn.exemplo.com/logo.png" })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ example: "#0EA5E9" })
  @IsString()
  @IsOptional()
  primaryColor?: string;

  @ApiPropertyOptional({ example: "#22D3EE" })
  @IsString()
  @IsOptional()
  secondaryColor?: string;

  @ApiPropertyOptional({ example: "#F59E0B" })
  @IsString()
  @IsOptional()
  accentColor?: string;

  @ApiPropertyOptional({ example: "contato@igreja.com.br" })
  @IsString()
  @IsOptional()
  defaultEmailFrom?: string;

  @ApiPropertyOptional({ enum: ApprovalPolicy, example: ApprovalPolicy.MANUAL })
  @IsEnum(ApprovalPolicy)
  @IsOptional()
  approvalPolicy?: ApprovalPolicy;

  @ApiPropertyOptional({ example: 1440 })
  @IsInt()
  @Min(15)
  @IsOptional()
  reminderLeadMinutes?: number;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  swapRules?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  scoreRules?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Array })
  @IsOptional()
  defaultServiceDays?: unknown;

  @ApiPropertyOptional({ example: "escala.suaigreja.com" })
  @IsString()
  @IsOptional()
  customDomain?: string;
}
