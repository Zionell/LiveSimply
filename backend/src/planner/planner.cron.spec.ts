import { PlannerCron } from "./planner.cron";

describe("PlannerCron", () => {
	const plannerService = {
		copyRegularPlanners: jest.fn(),
		remindToPlanNextMonth: jest.fn(),
	};
	let cron: PlannerCron;

	beforeEach(() => {
		plannerService.copyRegularPlanners.mockReset().mockResolvedValue(undefined);
		plannerService.remindToPlanNextMonth.mockReset().mockResolvedValue(0);
		cron = new PlannerCron(plannerService as any);
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("copies planners into the month it is running in", async () => {
		jest.setSystemTime(new Date("2026-09-01T00:05:00.000Z"));

		await cron.copyRegularPlanners();

		expect(plannerService.copyRegularPlanners).toHaveBeenCalledWith(2026, 9);
	});

	it("handles the January run, whose source is the previous December", async () => {
		jest.setSystemTime(new Date("2027-01-01T00:05:00.000Z"));

		await cron.copyRegularPlanners();

		expect(plannerService.copyRegularPlanners).toHaveBeenCalledWith(2027, 1);
	});

	it("does not let a failure escape the cron handler", async () => {
		jest.setSystemTime(new Date("2026-09-01T00:05:00.000Z"));
		plannerService.copyRegularPlanners.mockRejectedValue(new Error("db down"));
		const warnSpy = jest.spyOn(console, "warn").mockImplementation();

		await expect(cron.copyRegularPlanners()).resolves.toBeUndefined();

		warnSpy.mockRestore();
	});

	describe("remindToPlanNextMonth", () => {
		it("runs three days before a 31-day month ends", async () => {
			jest.setSystemTime(new Date("2026-08-28T09:00:00.000Z"));

			await cron.remindToPlanNextMonth();

			expect(plannerService.remindToPlanNextMonth).toHaveBeenCalledWith(
				2026,
				8
			);
		});

		it("runs three days before a 30-day month ends", async () => {
			jest.setSystemTime(new Date("2026-09-27T09:00:00.000Z"));

			await cron.remindToPlanNextMonth();

			expect(plannerService.remindToPlanNextMonth).toHaveBeenCalledWith(
				2026,
				9
			);
		});

		it("follows the short February rather than a fixed day of the month", async () => {
			jest.setSystemTime(new Date("2027-02-25T09:00:00.000Z"));

			await cron.remindToPlanNextMonth();

			expect(plannerService.remindToPlanNextMonth).toHaveBeenCalledWith(
				2027,
				2
			);
		});

		it("does nothing on any other day", async () => {
			jest.setSystemTime(new Date("2026-08-27T09:00:00.000Z"));

			await cron.remindToPlanNextMonth();

			jest.setSystemTime(new Date("2026-08-29T09:00:00.000Z"));

			await cron.remindToPlanNextMonth();

			expect(plannerService.remindToPlanNextMonth).not.toHaveBeenCalled();
		});

		it("does not let a failure escape the cron handler", async () => {
			jest.setSystemTime(new Date("2026-08-28T09:00:00.000Z"));
			plannerService.remindToPlanNextMonth.mockRejectedValue(
				new Error("db down")
			);
			const warnSpy = jest.spyOn(console, "warn").mockImplementation();

			await expect(cron.remindToPlanNextMonth()).resolves.toBeUndefined();

			warnSpy.mockRestore();
		});
	});
});
