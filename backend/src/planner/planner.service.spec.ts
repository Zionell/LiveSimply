import { ConflictException, NotFoundException } from "@nestjs/common";
import { PlannerService } from "./planner.service";

const buildPrismaMock = () => ({
	financePlanner: {
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		findMany: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
	},
	budgetItem: {
		findUnique: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		createMany: jest.fn(),
	},
	financeItem: {
		findMany: jest.fn().mockResolvedValue([]),
		aggregate: jest.fn().mockResolvedValue({ _sum: { convertedPrice: 0 } }),
	},
	notification: {
		findMany: jest.fn().mockResolvedValue([]),
	},
});

const ratesMock = {
	convertPrice: jest.fn(),
};

const budgetAlertMock = {
	checkAfterExpense: jest.fn(),
	resetAfterChange: jest.fn(),
};

const notificationsMock = {
	create: jest.fn(),
};

const req = { payload: { id: "u1", exchange: "EUR" } };

const plannerRecord = {
	id: "p1",
	userId: "u1",
	year: 2026,
	month: 8,
	curIncome: 5000,
	currencyFromId: "USD",
	convertedIncome: 4600,
	currencyToId: "EUR",
	alertThreshold: 0.7,
	notifiedThreshold: null,
	isRegular: false,
	items: [],
};

describe("PlannerService", () => {
	let prisma: ReturnType<typeof buildPrismaMock>;
	let service: PlannerService;

	beforeEach(() => {
		prisma = buildPrismaMock();
		ratesMock.convertPrice.mockReset();
		budgetAlertMock.checkAfterExpense.mockReset();
		budgetAlertMock.resetAfterChange.mockReset();
		notificationsMock.create.mockReset().mockResolvedValue(null);
		service = new PlannerService(
			prisma as any,
			ratesMock as any,
			budgetAlertMock as any,
			notificationsMock as any
		);
	});

	describe("getOrCreate", () => {
		it("returns the existing planner for the requested month", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue(plannerRecord);

			const result = await service.getOrCreate(
				{ year: 2026, month: 8 },
				req
			);

			expect(prisma.financePlanner.findUnique).toHaveBeenCalledWith({
				where: {
					userId_year_month: { userId: "u1", year: 2026, month: 8 },
				},
				include: expect.any(Object),
			});
			expect(prisma.financePlanner.create).not.toHaveBeenCalled();
			expect(result.id).toBe("p1");
		});

		it("creates an empty planner in the user base currency when none exists", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue(null);
			prisma.financePlanner.create.mockResolvedValue({
				...plannerRecord,
				curIncome: 0,
				currencyFromId: "EUR",
				convertedIncome: 0,
			});

			const result = await service.getOrCreate(
				{ year: 2026, month: 8 },
				req
			);

			expect(prisma.financePlanner.create).toHaveBeenCalledWith({
				data: {
					userId: "u1",
					year: 2026,
					month: 8,
					curIncome: 0,
					currencyFromId: "EUR",
					convertedIncome: 0,
					currencyToId: "EUR",
				},
				include: expect.any(Object),
			});
			expect(result.expectedIncome.converted).toBe(0);
		});

		it("returns the winning planner when a concurrent create loses the unique-constraint race", async () => {
			prisma.financePlanner.findUnique
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(plannerRecord);
			prisma.financePlanner.create.mockRejectedValue({ code: "P2002" });

			const result = await service.getOrCreate(
				{ year: 2026, month: 8 },
				req
			);

			expect(prisma.financePlanner.findUnique).toHaveBeenCalledTimes(2);
			expect(result.id).toBe("p1");
		});
	});

	describe("month facts", () => {
		const row = (
			day: number,
			operationCategoryId: string,
			convertedPrice: number,
			expenseCategoryId: string | null = null
		) => ({
			createdAt: new Date(Date.UTC(2026, 7, day, 12)),
			convertedPrice,
			operationCategoryId,
			expenseCategoryId,
		});

		beforeEach(() => {
			jest.useFakeTimers().setSystemTime(
				new Date("2026-09-10T00:00:00.000Z")
			);
			prisma.financePlanner.findUnique.mockResolvedValue(plannerRecord);
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it("reads both expenses and income for the planner's month", async () => {
			await service.getOrCreate({ year: 2026, month: 8 }, req);

			expect(prisma.financeItem.findMany).toHaveBeenCalledWith({
				where: {
					userId: "u1",
					operationCategoryId: { in: ["expense", "income"] },
					createdAt: {
						gte: new Date("2026-08-01T00:00:00.000Z"),
						lt: new Date("2026-09-01T00:00:00.000Z"),
					},
				},
				select: {
					createdAt: true,
					convertedPrice: true,
					operationCategoryId: true,
					expenseCategoryId: true,
				},
			});
		});

		it("sums earned income separately from spending", async () => {
			prisma.financeItem.findMany.mockResolvedValue([
				row(3, "income", 2000),
				row(5, "income", 500),
				row(6, "expense", 120, "food"),
			]);

			const result = await service.getOrCreate(
				{ year: 2026, month: 8 },
				req
			);

			expect(result.actualIncome).toBe(2500);
			expect(result.totalSpent).toBe(120);
			expect(result.expectedIncome.converted).toBe(4600);
		});

		it("accumulates several expenses in one category instead of overwriting them", async () => {
			prisma.financeItem.findMany.mockResolvedValue([
				row(2, "expense", 100, "food"),
				row(9, "expense", 40, "food"),
				row(9, "expense", 25, "travel"),
			]);
			prisma.financePlanner.findUnique.mockResolvedValue({
				...plannerRecord,
				items: [
					{
						id: "i1",
						label: "Food",
						curAmount: 200,
						currencyFromId: "EUR",
						convertedAmount: 200,
						currencyToId: "EUR",
						expenseCategoryId: "food",
						isRequired: true,
					},
				],
			});

			const result = await service.getOrCreate(
				{ year: 2026, month: 8 },
				req
			);

			expect(result.required[0].spent).toBe(140);
			expect(result.totalSpent).toBe(165);
		});

		it("builds a cumulative daily series covering every day of a finished month", async () => {
			prisma.financeItem.findMany.mockResolvedValue([
				row(1, "income", 1000),
				row(2, "expense", 300),
				row(4, "expense", 200),
			]);

			const result = await service.getOrCreate(
				{ year: 2026, month: 8 },
				req
			);

			expect(result.chart).toHaveLength(31);
			expect(result.chart.slice(0, 5)).toEqual([
				{ day: 1, income: 1000, expense: 0 },
				{ day: 2, income: 1000, expense: 300 },
				{ day: 3, income: 1000, expense: 300 },
				{ day: 4, income: 1000, expense: 500 },
				{ day: 5, income: 1000, expense: 500 },
			]);
			expect(result.chart[30]).toEqual({
				day: 31,
				income: 1000,
				expense: 500,
			});
		});

		it("stops the series at today for the month still in progress", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue({
				...plannerRecord,
				month: 9,
			});
			prisma.financeItem.findMany.mockResolvedValue([]);

			const result = await service.getOrCreate(
				{ year: 2026, month: 9 },
				req
			);

			expect(result.chart).toHaveLength(10);
			expect(result.chart[9]).toEqual({
				day: 10,
				income: 0,
				expense: 0,
			});
		});
	});

	describe("update", () => {
		it("reconverts the income when the amount changes", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue(plannerRecord);
			ratesMock.convertPrice.mockResolvedValue(5520);
			prisma.financePlanner.update.mockResolvedValue({
				...plannerRecord,
				curIncome: 6000,
				convertedIncome: 5520,
			});

			await service.update("p1", { curIncome: 6000 }, req);

			expect(ratesMock.convertPrice).toHaveBeenCalledWith({
				from: "USD",
				to: "EUR",
				price: 6000,
			});
			expect(prisma.financePlanner.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						curIncome: 6000,
						convertedIncome: 5520,
					}),
				})
			);
		});

		it("clears notifiedThreshold when the threshold itself changes", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue({
				...plannerRecord,
				notifiedThreshold: 0.7,
			});
			prisma.financePlanner.update.mockResolvedValue(plannerRecord);

			await service.update("p1", { alertThreshold: 0.5 }, req);

			expect(prisma.financePlanner.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						alertThreshold: 0.5,
						notifiedThreshold: null,
					}),
				})
			);
		});

		it("rejects a planner that belongs to someone else", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue({
				...plannerRecord,
				userId: "someone-else",
			});

			await expect(
				service.update("p1", { curIncome: 1 }, req)
			).rejects.toBeInstanceOf(NotFoundException);
		});
	});

	describe("addItem", () => {
		it("converts the planned amount into the planner currency", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue(plannerRecord);
			ratesMock.convertPrice.mockResolvedValue(920);
			prisma.budgetItem.create.mockResolvedValue({});

			await service.addItem(
				"p1",
				{
					label: "Vacation",
					curAmount: 1000,
					currencyFromId: "USD",
					expenseCategoryId: "travel",
				},
				req
			);

			expect(ratesMock.convertPrice).toHaveBeenCalledWith({
				from: "USD",
				to: "EUR",
				price: 1000,
			});
			expect(prisma.budgetItem.create).toHaveBeenCalledWith({
				data: {
					plannerId: "p1",
					label: "Vacation",
					curAmount: 1000,
					currencyFromId: "USD",
					convertedAmount: 920,
					currencyToId: "EUR",
					expenseCategoryId: "travel",
					isRequired: false,
				},
			});
		});

		it("rejects a second item on the same expense category", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue({
				...plannerRecord,
				items: [{ id: "i1", expenseCategoryId: "travel" }],
			});

			await expect(
				service.addItem(
					"p1",
					{
						label: "Another trip",
						curAmount: 500,
						currencyFromId: "EUR",
						expenseCategoryId: "travel",
					},
					req
				)
			).rejects.toBeInstanceOf(ConflictException);
			expect(prisma.budgetItem.create).not.toHaveBeenCalled();
		});
	});

	describe("remove", () => {
		it("deletes the owned planner", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue(plannerRecord);

			await service.remove("p1", req);

			expect(prisma.financePlanner.delete).toHaveBeenCalledWith({
				where: { id: "p1" },
			});
		});

		it("rejects a planner that belongs to someone else", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue({
				...plannerRecord,
				userId: "someone-else",
			});

			await expect(service.remove("p1", req)).rejects.toBeInstanceOf(
				NotFoundException
			);
			expect(prisma.financePlanner.delete).not.toHaveBeenCalled();
		});
	});

	describe("updateItem", () => {
		it("rejects an item whose planner belongs to someone else", async () => {
			prisma.budgetItem.findUnique.mockResolvedValue({
				id: "i1",
				plannerId: "p1",
				planner: { ...plannerRecord, userId: "someone-else" },
			});

			await expect(
				service.updateItem("i1", { curAmount: 100 }, req)
			).rejects.toBeInstanceOf(NotFoundException);
			expect(prisma.budgetItem.update).not.toHaveBeenCalled();
		});

		it("delegates to resetAfterChange when the planned amount changes, instead of computing progress inline", async () => {
			prisma.budgetItem.findUnique.mockResolvedValue({
				id: "i1",
				plannerId: "p1",
				curAmount: 1000,
				currencyFromId: "EUR",
				convertedAmount: 1000,
				currencyToId: "EUR",
				expenseCategoryId: "travel",
				notifiedThreshold: 0.7,
				planner: plannerRecord,
			});
			ratesMock.convertPrice.mockResolvedValue(2000);
			prisma.financePlanner.findUnique.mockResolvedValue(plannerRecord);
			prisma.budgetItem.update.mockResolvedValue({});

			await service.updateItem("i1", { curAmount: 2000 }, req);

			const updateCall = prisma.budgetItem.update.mock.calls[0][0];

			expect(updateCall.data).toEqual(
				expect.objectContaining({ convertedAmount: 2000 })
			);
			expect(updateCall.data).not.toHaveProperty("notifiedThreshold");

			expect(budgetAlertMock.resetAfterChange).toHaveBeenCalledWith({
				userId: "u1",
				expenseCategoryId: "travel",
				date: new Date(
					Date.UTC(plannerRecord.year, plannerRecord.month - 1, 1)
				),
			});
		});

		it("never writes notifiedThreshold directly from an item update, regardless of progress", async () => {
			prisma.budgetItem.findUnique.mockResolvedValue({
				id: "i1",
				plannerId: "p1",
				curAmount: 1000,
				currencyFromId: "EUR",
				convertedAmount: 1000,
				currencyToId: "EUR",
				expenseCategoryId: "travel",
				notifiedThreshold: 0.7,
				planner: plannerRecord,
			});
			ratesMock.convertPrice.mockResolvedValue(900);
			prisma.financePlanner.findUnique.mockResolvedValue(plannerRecord);
			prisma.budgetItem.update.mockResolvedValue({});

			await service.updateItem("i1", { curAmount: 900 }, req);

			const updateCall = prisma.budgetItem.update.mock.calls[0][0];

			expect(updateCall.data).not.toHaveProperty("notifiedThreshold");
		});

		it("does not call resetAfterChange when only non-amount fields change", async () => {
			prisma.budgetItem.findUnique.mockResolvedValue({
				id: "i1",
				plannerId: "p1",
				curAmount: 1000,
				currencyFromId: "EUR",
				convertedAmount: 1000,
				currencyToId: "EUR",
				expenseCategoryId: "travel",
				notifiedThreshold: 0.7,
				planner: plannerRecord,
			});
			prisma.financePlanner.findUnique.mockResolvedValue(plannerRecord);
			prisma.budgetItem.update.mockResolvedValue({});

			await service.updateItem("i1", { label: "Renamed" }, req);

			expect(budgetAlertMock.resetAfterChange).not.toHaveBeenCalled();
		});
	});

	describe("removeItem", () => {
		it("deletes the owned item", async () => {
			prisma.budgetItem.findUnique.mockResolvedValue({
				id: "i1",
				plannerId: "p1",
				planner: plannerRecord,
			});

			await service.removeItem("i1", req);

			expect(prisma.budgetItem.delete).toHaveBeenCalledWith({
				where: { id: "i1" },
			});
		});

		it("rejects an item whose planner belongs to someone else", async () => {
			prisma.budgetItem.findUnique.mockResolvedValue({
				id: "i1",
				plannerId: "p1",
				planner: { ...plannerRecord, userId: "someone-else" },
			});

			await expect(service.removeItem("i1", req)).rejects.toBeInstanceOf(
				NotFoundException
			);
			expect(prisma.budgetItem.delete).not.toHaveBeenCalled();
		});
	});

	describe("remindToPlanNextMonth", () => {
		const filled = (userId: string, overrides = {}) => ({
			userId,
			convertedIncome: 3000,
			isRegular: false,
			items: [],
			...overrides,
		});

		beforeEach(() => {
			jest.useFakeTimers().setSystemTime(
				new Date("2026-08-28T09:00:00.000Z")
			);
			prisma.notification.findMany.mockResolvedValue([]);
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it("notifies a planner whose next month is still untouched", async () => {
			prisma.financePlanner.findMany
				.mockResolvedValueOnce([filled("u1")])
				.mockResolvedValueOnce([]);

			const sent = await service.remindToPlanNextMonth(2026, 8);

			expect(sent).toBe(1);
			expect(notificationsMock.create).toHaveBeenCalledWith({
				userId: "u1",
				type: "planner.reminder",
				params: { days: 3 },
			});
		});

		it("looks the next month up under the following year in December", async () => {
			prisma.financePlanner.findMany
				.mockResolvedValueOnce([filled("u1")])
				.mockResolvedValueOnce([]);

			await service.remindToPlanNextMonth(2026, 12);

			expect(prisma.financePlanner.findMany).toHaveBeenLastCalledWith({
				where: {
					userId: { in: ["u1"] },
					year: 2027,
					month: 1,
				},
				include: { items: { select: { id: true } } },
			});
		});

		it("skips a user whose next month already has income or items", async () => {
			prisma.financePlanner.findMany
				.mockResolvedValueOnce([filled("u1"), filled("u2")])
				.mockResolvedValueOnce([
					{ userId: "u1", convertedIncome: 4000, items: [] },
					{
						userId: "u2",
						convertedIncome: 0,
						items: [{ id: "i1" }],
					},
				]);

			const sent = await service.remindToPlanNextMonth(2026, 8);

			expect(sent).toBe(0);
			expect(notificationsMock.create).not.toHaveBeenCalled();
		});

		it("still notifies a user whose next-month planner was auto-created but left empty", async () => {
			prisma.financePlanner.findMany
				.mockResolvedValueOnce([filled("u1")])
				.mockResolvedValueOnce([
					{ userId: "u1", convertedIncome: 0, items: [] },
				]);

			const sent = await service.remindToPlanNextMonth(2026, 8);

			expect(sent).toBe(1);
		});

		it("skips the owner of a regular plan, which is copied automatically", async () => {
			prisma.financePlanner.findMany
				.mockResolvedValueOnce([filled("u1", { isRegular: true })])
				.mockResolvedValueOnce([]);

			const sent = await service.remindToPlanNextMonth(2026, 8);

			expect(sent).toBe(0);
			expect(notificationsMock.create).not.toHaveBeenCalled();
		});

		it("skips a user who never filled the current month in", async () => {
			prisma.financePlanner.findMany
				.mockResolvedValueOnce([
					filled("u1", { convertedIncome: 0, items: [] }),
				])
				.mockResolvedValueOnce([]);

			const sent = await service.remindToPlanNextMonth(2026, 8);

			expect(sent).toBe(0);
		});

		it("does not send a second reminder on a re-run the same day", async () => {
			prisma.financePlanner.findMany
				.mockResolvedValueOnce([filled("u1")])
				.mockResolvedValueOnce([]);
			prisma.notification.findMany.mockResolvedValue([{ userId: "u1" }]);

			const sent = await service.remindToPlanNextMonth(2026, 8);

			expect(sent).toBe(0);
			expect(prisma.notification.findMany).toHaveBeenCalledWith({
				where: {
					userId: { in: ["u1"] },
					type: "planner.reminder",
					createdAt: { gte: new Date("2026-08-28T00:00:00.000Z") },
				},
				select: { userId: true },
			});
		});

		it("does not let a failure escape", async () => {
			prisma.financePlanner.findMany.mockRejectedValue(
				new Error("db down")
			);
			const warnSpy = jest.spyOn(console, "warn").mockImplementation();

			await expect(service.remindToPlanNextMonth(2026, 8)).resolves.toBe(
				0
			);

			warnSpy.mockRestore();
		});
	});

	describe("copyRegularPlanners", () => {
		it("copies items into the next month without carrying notifiedThreshold", async () => {
			prisma.financePlanner.findMany.mockResolvedValue([
				{
					...plannerRecord,
					isRegular: true,
					notifiedThreshold: 0.7,
					items: [
						{
							label: "Rent",
							curAmount: 1200,
							currencyFromId: "EUR",
							convertedAmount: 1200,
							currencyToId: "EUR",
							expenseCategoryId: "housing",
							isRequired: true,
							notifiedThreshold: 0.7,
						},
					],
				},
			]);
			prisma.financePlanner.findUnique.mockResolvedValue(null);
			prisma.financePlanner.create.mockResolvedValue({ id: "p2" });

			await service.copyRegularPlanners(2026, 9);

			expect(prisma.financePlanner.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					year: 2026,
					month: 9,
					notifiedThreshold: null,
					isRegular: true,
				}),
			});
			expect(prisma.budgetItem.createMany).toHaveBeenCalledWith({
				data: [
					{
						plannerId: "p2",
						label: "Rent",
						curAmount: 1200,
						currencyFromId: "EUR",
						convertedAmount: 1200,
						currencyToId: "EUR",
						expenseCategoryId: "housing",
						isRequired: true,
					},
				],
			});
		});

		it("skips a month that already has a planner", async () => {
			prisma.financePlanner.findMany.mockResolvedValue([
				{ ...plannerRecord, isRegular: true, items: [] },
			]);
			prisma.financePlanner.findUnique.mockResolvedValue({
				id: "existing",
			});

			await service.copyRegularPlanners(2026, 9);

			expect(prisma.financePlanner.create).not.toHaveBeenCalled();
		});
	});
});
