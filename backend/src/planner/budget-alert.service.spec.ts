import { BudgetAlertService } from "./budget-alert.service";
import { ENotificationType } from "../notifications/types";

const plannerWithItem = (overrides: Record<string, any> = {}) => ({
	id: "p1",
	userId: "u1",
	year: 2026,
	month: 8,
	convertedIncome: 5000,
	currencyToId: "EUR",
	alertThreshold: 0.7,
	notifiedThreshold: null,
	items: [
		{
			id: "i1",
			label: "Vacation",
			expenseCategoryId: "travel",
			convertedAmount: 1000,
			notifiedThreshold: null,
		},
	],
	...overrides,
});

const buildMocks = () => {
	const prisma = {
		financePlanner: {
			findUnique: jest.fn(),
			update: jest.fn().mockResolvedValue({}),
		},
		budgetItem: {
			update: jest.fn().mockResolvedValue({}),
		},
		financeItem: {
			aggregate: jest.fn(),
			groupBy: jest.fn().mockResolvedValue([]),
		},
	};

	const notifications = {
		create: jest.fn().mockImplementation(async ({ type }) => ({
			id: "n1",
			type,
			title: "t",
			text: "x",
			isReaded: false,
			createdAt: new Date(),
		})),
	};

	return { prisma, notifications };
};

const args = {
	userId: "u1",
	expenseCategoryId: "travel",
	date: new Date("2026-08-15T12:00:00.000Z"),
};

/**
 * spentByCategory drives the per-item aggregate, totalSpent drives the
 * plan-wide aggregate. The service calls aggregate for the category first
 * and for the whole month second.
 */
const stubSpend = (
	prisma: ReturnType<typeof buildMocks>["prisma"],
	categorySpent: number,
	totalSpent: number
) => {
	prisma.financeItem.aggregate
		.mockResolvedValueOnce({ _sum: { convertedPrice: categorySpent } })
		.mockResolvedValueOnce({ _sum: { convertedPrice: totalSpent } });
};

describe("BudgetAlertService", () => {
	let prisma: ReturnType<typeof buildMocks>["prisma"];
	let notifications: ReturnType<typeof buildMocks>["notifications"];
	let service: BudgetAlertService;

	beforeEach(() => {
		({ prisma, notifications } = buildMocks());
		service = new BudgetAlertService(prisma as any, notifications as any);
	});

	it("stays silent at 69.9% of the item plan", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(plannerWithItem());
		stubSpend(prisma, 699, 699);

		const result = await service.checkAfterExpense(args);

		expect(notifications.create).not.toHaveBeenCalled();
		expect(result).toEqual([]);
	});

	it("fires exactly at 70% of the item plan", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(plannerWithItem());
		stubSpend(prisma, 700, 700);

		const result = await service.checkAfterExpense(args);

		expect(notifications.create).toHaveBeenCalledWith({
			userId: "u1",
			type: ENotificationType.BudgetItemThreshold,
			params: {
				label: "Vacation",
				percent: 70,
				spent: 700,
				planned: 1000,
				currency: "EUR",
			},
		});
		expect(prisma.budgetItem.update).toHaveBeenCalledWith({
			where: { id: "i1" },
			data: { notifiedThreshold: 0.7, updatedAt: expect.any(Date) },
		});
		expect(result).toHaveLength(1);
	});

	it("fires above the threshold too", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(plannerWithItem());
		stubSpend(prisma, 701, 701);

		await service.checkAfterExpense(args);

		expect(notifications.create).toHaveBeenCalledTimes(1);
	});

	it("does not fire twice for the same threshold", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(
			plannerWithItem({
				items: [
					{
						id: "i1",
						label: "Vacation",
						expenseCategoryId: "travel",
						convertedAmount: 1000,
						notifiedThreshold: 0.7,
					},
				],
			})
		);
		stubSpend(prisma, 850, 850);

		const result = await service.checkAfterExpense(args);

		expect(notifications.create).not.toHaveBeenCalled();
		expect(prisma.budgetItem.update).not.toHaveBeenCalled();
		expect(result).toEqual([]);
	});

	it("fires again after the threshold is lowered", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(
			plannerWithItem({
				alertThreshold: 0.5,
				items: [
					{
						id: "i1",
						label: "Vacation",
						expenseCategoryId: "travel",
						convertedAmount: 1000,
						notifiedThreshold: 0.7,
					},
				],
			})
		);
		stubSpend(prisma, 600, 600);

		await service.checkAfterExpense(args);

		expect(notifications.create).toHaveBeenCalledTimes(1);
		expect(prisma.budgetItem.update).toHaveBeenCalledWith({
			where: { id: "i1" },
			data: { notifiedThreshold: 0.5, updatedAt: expect.any(Date) },
		});
	});

	it("fires for the overall budget when total spending crosses the threshold", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(
			plannerWithItem({ items: [] })
		);
		prisma.financeItem.aggregate.mockResolvedValue({
			_sum: { convertedPrice: 3500 },
		});

		const result = await service.checkAfterExpense(args);

		expect(notifications.create).toHaveBeenCalledWith({
			userId: "u1",
			type: ENotificationType.BudgetTotalThreshold,
			params: {
				percent: 70,
				spent: 3500,
				planned: 5000,
				currency: "EUR",
			},
		});
		expect(result).toHaveLength(1);
	});

	it("can fire for the item and the overall budget at once", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(plannerWithItem());
		stubSpend(prisma, 700, 3500);

		const result = await service.checkAfterExpense(args);

		expect(result).toHaveLength(2);
	});

	it("does nothing when the user has no planner for that month", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(null);

		const result = await service.checkAfterExpense(args);

		expect(result).toEqual([]);
		expect(prisma.financeItem.aggregate).not.toHaveBeenCalled();
	});

	it("resolves to an empty array instead of rejecting when the database throws", async () => {
		prisma.financePlanner.findUnique.mockRejectedValue(new Error("boom"));

		const result = await service.checkAfterExpense(args);

		expect(result).toEqual([]);
	});

	it("skips an item with a zero planned amount", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(
			plannerWithItem({
				convertedIncome: 0,
				items: [
					{
						id: "i1",
						label: "Vacation",
						expenseCategoryId: "travel",
						convertedAmount: 0,
						notifiedThreshold: null,
					},
				],
			})
		);
		stubSpend(prisma, 500, 500);

		const result = await service.checkAfterExpense(args);

		expect(notifications.create).not.toHaveBeenCalled();
		expect(result).toEqual([]);
	});

	it("ignores an expense in a category that is not planned", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(plannerWithItem());
		prisma.financeItem.aggregate.mockResolvedValue({
			_sum: { convertedPrice: 900 },
		});

		const result = await service.checkAfterExpense({
			...args,
			expenseCategoryId: "food",
		});

		expect(notifications.create).not.toHaveBeenCalled();
		expect(result).toEqual([]);
	});

	it("tolerates an expense with no category at all", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(plannerWithItem());
		prisma.financeItem.aggregate.mockResolvedValue({
			_sum: { convertedPrice: 900 },
		});

		const result = await service.checkAfterExpense({
			...args,
			expenseCategoryId: null,
		});

		expect(result).toEqual([]);
	});

	describe("resetAfterChange", () => {
		it("clears notifiedThreshold once spending drops below the threshold", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue(
				plannerWithItem({
					notifiedThreshold: 0.7,
					items: [
						{
							id: "i1",
							label: "Vacation",
							expenseCategoryId: "travel",
							convertedAmount: 1000,
							notifiedThreshold: 0.7,
						},
					],
				})
			);
			stubSpend(prisma, 300, 300);

			await service.resetAfterChange(args);

			expect(prisma.budgetItem.update).toHaveBeenCalledWith({
				where: { id: "i1" },
				data: { notifiedThreshold: null, updatedAt: expect.any(Date) },
			});
			expect(prisma.financePlanner.update).toHaveBeenCalledWith({
				where: { id: "p1" },
				data: { notifiedThreshold: null, updatedAt: expect.any(Date) },
			});
		});

		it("leaves notifiedThreshold alone while spending is still above the threshold", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue(
				plannerWithItem({
					notifiedThreshold: 0.7,
					items: [
						{
							id: "i1",
							label: "Vacation",
							expenseCategoryId: "travel",
							convertedAmount: 1000,
							notifiedThreshold: 0.7,
						},
					],
				})
			);
			stubSpend(prisma, 900, 4500);

			await service.resetAfterChange(args);

			expect(prisma.budgetItem.update).not.toHaveBeenCalled();
			expect(prisma.financePlanner.update).not.toHaveBeenCalled();
		});

		it("skips the aggregate query and update entirely when nothing was ever flagged", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue(
				plannerWithItem()
			);

			await service.resetAfterChange(args);

			expect(prisma.financeItem.aggregate).not.toHaveBeenCalled();
			expect(prisma.budgetItem.update).not.toHaveBeenCalled();
			expect(prisma.financePlanner.update).not.toHaveBeenCalled();
		});
	});
});
