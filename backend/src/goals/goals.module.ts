import { Module } from "@nestjs/common";
import { GoalsService } from "./goals.service";
import { GoalsController } from "./goals.controller";
import { GoalsCron } from "./goals.cron";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
	imports: [NotificationsModule],
	controllers: [GoalsController],
	providers: [GoalsService, GoalsCron],
	exports: [GoalsService],
})
export class GoalsModule {}
