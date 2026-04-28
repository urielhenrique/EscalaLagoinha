import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { ChurchesController } from "./churches.controller";
import { ChurchesService } from "./churches.service";

@Module({
  imports: [AuditLogsModule],
  controllers: [ChurchesController],
  providers: [ChurchesService],
  exports: [ChurchesService],
})
export class ChurchesModule {}
