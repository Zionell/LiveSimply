import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PlannerService } from "./planner.service";

@Injectable()
export class PlannerCron {
	constructor(private readonly plannerService: PlannerService) {}

	@Cron("5 0 1 * *", { name: "copyRegularPlanners", timeZone: "UTC" })
	async copyRegularPlanners(): Promise<void> {
		try {
			const now = new Date();

			await this.plannerService.copyRegularPlanners(
				now.getUTCFullYear(),
				now.getUTCMonth() + 1
			);
		} catch (e) {
			console.warn("[PlannerCron / copyRegularPlanners]: ", e);
		}
	}
}
