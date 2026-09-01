import { NotFoundException } from "@nestjs/common";
import { GoalsService } from "./goals.service";

const buildPrismaMock = () => ({
	goal: {
		findUnique: jest.fn(),
		findMany: jest.fn().mockResolvedValue([]),
		create: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
	},
	notification: {
		findMany: jest.fn().mockResolvedValue([]),
	},
});

const notificationsMock = {
	create: jest.fn(),
};

const goalRecord = (overrides: Record<string, unknown> = {}) => ({
	id: "g1",
	userId: "u1",
	title: "Car",
	untilAt: new Date("2026-12-31T00:00:00.000Z"),
	total: 12000,
	amount: 2000,
	exchangeId: "EUR",
	isCompleted: false,
	lastAmountAt: new Date("2026-07-10T00:00:00.000Z"),
	createdAt: new Date("2026-01-05T00:00:00.000Z"),
	updatedAt: new Date("2026-07-10T00:00:00.000Z"),
	...overrides,
});

describe("GoalsService", () => {
	let prisma: ReturnType<typeof buildPrismaMock>;
	let service: GoalsService;

	beforeEach(() => {
		prisma = buildPrismaMock();
		notificationsMock.create.mockReset().mockResolvedValue(null);
		service = new GoalsService(prisma as any, notificationsMock as any);
	});

	describe("update", () => {
		it("stamps the contribution date when the amount moves", async () => {
			prisma.goal.findUnique.mockResolvedValue(goalRecord());

			await service.update("g1", { amount: 3000 } as any);

			expect(prisma.goal.update).toHaveBeenCalledWith({
				where: { id: "g1" },
				data: expect.objectContaining({
					amount: 3000,
					lastAmountAt: expect.any(Date),
				}),
			});
		});

		it("leaves the contribution date alone when only the title changes", async () => {
			prisma.goal.findUnique.mockResolvedValue(goalRecord());

			await service.update("g1", { title: "New car" } as any);

			const data = prisma.goal.update.mock.calls[0][0].data;
			expect(data).not.toHaveProperty("lastAmountAt");
		});

		it("does not treat resubmitting the same amount as a contribution", async () => {
			prisma.goal.findUnique.mockResolvedValue(goalRecord());

			await service.update("g1", { amount: 2000 } as any);

			const data = prisma.goal.update.mock.calls[0][0].data;
			expect(data).not.toHaveProperty("lastAmountAt");
		});

		it("does not treat money leaving the goal as a contribution", async () => {
			prisma.goal.findUnique.mockResolvedValue(goalRecord());

			await service.update("g1", { amount: 1300 } as any);

			const data = prisma.goal.update.mock.calls[0][0].data;
			expect(data).not.toHaveProperty("lastAmountAt");
		});

		it("rejects an unknown goal", async () => {
			prisma.goal.findUnique.mockResolvedValue(null);

			await expect(
				service.update("nope", { amount: 1 } as any)
			).rejects.toBeInstanceOf(NotFoundException);
		});
	});

	describe("remindToContribute", () => {
		beforeEach(() => {
			jest.useFakeTimers().setSystemTime(
				new Date("2026-08-26T09:00:00.000Z")
			);
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it("nudges a goal that saw no money this month", async () => {
			prisma.goal.findMany.mockResolvedValue([goalRecord()]);

			const sent = await service.remindToContribute(2026, 8);

			expect(sent).toBe(1);
			expect(notificationsMock.create).toHaveBeenCalledWith({
				userId: "u1",
				type: "goal.contribution.reminder",
				params: {
					goalId: "g1",
					title: "Car",
					// 10000 left over August..December inclusive
					amount: 2000,
					currency: "EUR",
					days: 5,
				},
			});
		});

		it("stays quiet when the amount already moved this month", async () => {
			prisma.goal.findMany.mockResolvedValue([
				goalRecord({
					lastAmountAt: new Date("2026-08-03T00:00:00.000Z"),
				}),
			]);

			const sent = await service.remindToContribute(2026, 8);

			expect(sent).toBe(0);
			expect(notificationsMock.create).not.toHaveBeenCalled();
		});

		it("treats a goal opened this month as already funded", async () => {
			prisma.goal.findMany.mockResolvedValue([
				goalRecord({
					lastAmountAt: null,
					createdAt: new Date("2026-08-02T00:00:00.000Z"),
				}),
			]);

			expect(await service.remindToContribute(2026, 8)).toBe(0);
		});

		it("falls back to the creation date for a goal never topped up", async () => {
			prisma.goal.findMany.mockResolvedValue([
				goalRecord({ lastAmountAt: null }),
			]);

			expect(await service.remindToContribute(2026, 8)).toBe(1);
		});

		it("skips a goal that already reached its target", async () => {
			prisma.goal.findMany.mockResolvedValue([
				goalRecord({ amount: 12000 }),
			]);

			expect(await service.remindToContribute(2026, 8)).toBe(0);
		});

		it("asks only for what is left when the deadline is this month", async () => {
			prisma.goal.findMany.mockResolvedValue([
				goalRecord({ untilAt: new Date("2026-08-31T00:00:00.000Z") }),
			]);

			await service.remindToContribute(2026, 8);

			expect(notificationsMock.create).toHaveBeenCalledWith(
				expect.objectContaining({
					params: expect.objectContaining({ amount: 10000 }),
				})
			);
		});

		it("does not send a second reminder in the same month", async () => {
			prisma.goal.findMany.mockResolvedValue([goalRecord()]);
			prisma.notification.findMany.mockResolvedValue([
				{ params: { goalId: "g1" } },
			]);

			const sent = await service.remindToContribute(2026, 8);

			expect(sent).toBe(0);
			expect(notificationsMock.create).not.toHaveBeenCalled();
		});

		it("still reminds about the other goals of the same user", async () => {
			prisma.goal.findMany.mockResolvedValue([
				goalRecord(),
				goalRecord({ id: "g2", title: "Bike" }),
			]);
			prisma.notification.findMany.mockResolvedValue([
				{ params: { goalId: "g1" } },
			]);

			const sent = await service.remindToContribute(2026, 8);

			expect(sent).toBe(1);
			expect(notificationsMock.create).toHaveBeenCalledWith(
				expect.objectContaining({
					params: expect.objectContaining({ goalId: "g2" }),
				})
			);
		});

		it("leaves completed and expired goals to the database filter", async () => {
			await service.remindToContribute(2026, 8);

			expect(prisma.goal.findMany).toHaveBeenCalledWith({
				where: {
					isCompleted: false,
					untilAt: { gt: expect.any(Date) },
				},
			});
		});

		it("does not let a failure escape", async () => {
			prisma.goal.findMany.mockRejectedValue(new Error("db down"));
			const warnSpy = jest.spyOn(console, "warn").mockImplementation();

			await expect(service.remindToContribute(2026, 8)).resolves.toBe(0);

			warnSpy.mockRestore();
		});
	});
});
