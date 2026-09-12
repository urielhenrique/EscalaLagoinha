import { Module } from "@nestjs/common";
import { SmartSchedulerController } from "./smart-scheduler.controller";
import { SmartSchedulerService } from "./smart-scheduler.service";

@Module({
  controllers: [SmartSchedulerController],
  providers: [SmartSchedulerService],
  exports: [SmartSchedulerService],
})
export class SmartSchedulerModule {}
