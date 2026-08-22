import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PlannerService, REMINDER_DAYS_BEFORE } from "./planner.service";
import { daysInMonth } from "../../utils/date";

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

	/**
	 * Cron cannot express "three days before the month ends", so this runs
	 * daily and returns immediately on every other day.
	 */
	@Cron("0 9 * * *", { name: "remindToPlanNextMonth", timeZone: "UTC" })
	async remindToPlanNextMonth(): Promise<void> {
		try {
			const now = new Date();
			const year = now.getUTCFullYear();
			const month = now.getUTCMonth() + 1;

			const reminderDay =
				daysInMonth(year, month) - REMINDER_DAYS_BEFORE;

			if (now.getUTCDate() !== reminderDay) {
				return;
			}

			await this.plannerService.remindToPlanNextMonth(year, month);
		} catch (e) {
			console.warn("[PlannerCron / remindToPlanNextMonth]: ", e);
		}
	}
}
