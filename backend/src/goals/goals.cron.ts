import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { GoalsService, GOAL_REMINDER_DAYS_BEFORE } from "./goals.service";
import { daysInMonth } from "../../utils/date";

@Injectable()
export class GoalsCron {
	constructor(private readonly goalsService: GoalsService) {}

	@Cron("0 9 * * *", { name: "remindToContribute", timeZone: "UTC" })
	async remindToContribute(): Promise<void> {
		try {
			const now = new Date();
			const year = now.getUTCFullYear();
			const month = now.getUTCMonth() + 1;

			const reminderDay =
				daysInMonth(year, month) - GOAL_REMINDER_DAYS_BEFORE;

			if (now.getUTCDate() !== reminderDay) {
				return;
			}

			await this.goalsService.remindToContribute(year, month);
		} catch (e) {
			console.warn("[GoalsCron / remindToContribute]: ", e);
		}
	}
}
