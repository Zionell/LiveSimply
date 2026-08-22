import { PlannerCron } from "./planner.cron";

describe("PlannerCron", () => {
	const plannerService = { copyRegularPlanners: jest.fn() };
	let cron: PlannerCron;

	beforeEach(() => {
		plannerService.copyRegularPlanners.mockReset().mockResolvedValue(undefined);
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
});
