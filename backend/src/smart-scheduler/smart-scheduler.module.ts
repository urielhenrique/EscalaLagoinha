import { Module } from "@nestjs/common";
import { SmartSchedulerAiEnhancerService } from "./smart-scheduler.ai-enhancer.service";
import { SmartSchedulerController } from "./smart-scheduler.controller";
import { SmartSchedulerService } from "./smart-scheduler.service";

@Module({
  controllers: [SmartSchedulerController],
  providers: [SmartSchedulerService, SmartSchedulerAiEnhancerService],
  exports: [SmartSchedulerService],
})
export class SmartSchedulerModule {}
