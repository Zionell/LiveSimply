import { Module } from "@nestjs/common";
import { PlannerService } from "./planner.service";
import { PlannerController } from "./planner.controller";
import { RatesModule } from "../rates/rates.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { BudgetAlertService } from "./budget-alert.service";
import { PlannerCron } from "./planner.cron";

@Module({
	imports: [RatesModule, NotificationsModule],
	controllers: [PlannerController],
	providers: [PlannerService, BudgetAlertService, PlannerCron],
	exports: [PlannerService, BudgetAlertService],
})
export class PlannerModule {}
