import { GoalsCron } from "./goals.cron";

describe("GoalsCron", () => {
	const goalsService = {
		remindToContribute: jest.fn(),
	};
	let cron: GoalsCron;

	beforeEach(() => {
		goalsService.remindToContribute.mockReset().mockResolvedValue(0);
		cron = new GoalsCron(goalsService as any);
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("runs five days before a 31-day month ends", async () => {
		jest.setSystemTime(new Date("2026-08-26T09:00:00.000Z"));

		await cron.remindToContribute();

		expect(goalsService.remindToContribute).toHaveBeenCalledWith(2026, 8);
	});

	it("runs five days before a 30-day month ends", async () => {
		jest.setSystemTime(new Date("2026-09-25T09:00:00.000Z"));

		await cron.remindToContribute();

		expect(goalsService.remindToContribute).toHaveBeenCalledWith(2026, 9);
	});

	it("runs five days before February ends", async () => {
		jest.setSystemTime(new Date("2026-02-23T09:00:00.000Z"));

		await cron.remindToContribute();

		expect(goalsService.remindToContribute).toHaveBeenCalledWith(2026, 2);
	});

	it("stays idle on every other day", async () => {
		jest.setSystemTime(new Date("2026-08-25T09:00:00.000Z"));

		await cron.remindToContribute();

		jest.setSystemTime(new Date("2026-08-31T09:00:00.000Z"));

		await cron.remindToContribute();

		expect(goalsService.remindToContribute).not.toHaveBeenCalled();
	});

	it("does not let a failure escape the cron handler", async () => {
		jest.setSystemTime(new Date("2026-08-26T09:00:00.000Z"));
		goalsService.remindToContribute.mockRejectedValue(new Error("db down"));
		const warnSpy = jest.spyOn(console, "warn").mockImplementation();

		await expect(cron.remindToContribute()).resolves.toBeUndefined();

		warnSpy.mockRestore();
	});
});
