import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateMeDto {
  @ApiPropertyOptional({ example: "Maria Souza Lima" })
  @IsString()
  @IsOptional()
  nome?: string;

  @ApiPropertyOptional({ example: "(31) 97777-2222" })
  @IsString()
  @IsOptional()
  telefone?: string;

  @ApiPropertyOptional({ example: "https://example.com/foto-maria-nova.jpg" })
  @IsString()
  @IsOptional()
  foto?: string;
}
