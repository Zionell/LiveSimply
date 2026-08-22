import { FinanceService } from "./finance.service";

const buildPrismaMock = () => ({
	financeItem: {
		findUnique: jest.fn(),
		update: jest.fn(),
		deleteMany: jest.fn(),
	},
	financePlanner: {
		findMany: jest.fn(),
		updateMany: jest.fn(),
	},
	budgetItem: {
		updateMany: jest.fn(),
	},
	expenseCategory: {
		findUnique: jest.fn(),
		create: jest.fn(),
	},
});

const ratesMock = {};
const usersMock = {};
const goalsMock = {};

const budgetAlertMock = {
	checkAfterExpense: jest.fn().mockResolvedValue([]),
	resetAfterChange: jest.fn().mockResolvedValue(undefined),
};

const originalExpense = {
	id: "f1",
	userId: "u1",
	curPrice: 700,
	convertedPrice: 700,
	currencyFromId: "EUR",
	currencyToId: "EUR",
	expenseCategoryId: "travel",
	operationCategoryId: "expense",
	createdAt: new Date("2026-08-15T12:00:00.000Z"),
};

describe("FinanceService", () => {
	let prisma: ReturnType<typeof buildPrismaMock>;
	let service: FinanceService;

	beforeEach(() => {
		prisma = buildPrismaMock();
		budgetAlertMock.checkAfterExpense.mockClear();
		budgetAlertMock.resetAfterChange.mockClear();
		budgetAlertMock.checkAfterExpense.mockResolvedValue([]);
		budgetAlertMock.resetAfterChange.mockResolvedValue(undefined);

		service = new FinanceService(
			prisma as any,
			ratesMock as any,
			usersMock as any,
			goalsMock as any,
			budgetAlertMock as any
		);
	});

	describe("createExpenseCategory", () => {
		it("slugs the label into a value and stores it for every language", async () => {
			prisma.expenseCategory.findUnique.mockResolvedValue(null);
			prisma.expenseCategory.create.mockResolvedValue({
				value: "kofe-i-zavtraki",
				label: [{ label: "Кофе и завтраки" }],
			});

			const result = await service.createExpenseCategory({
				label: "Кофе и завтраки",
				color: "#A1B2C3",
			});

			expect(prisma.expenseCategory.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						value: "kofe-i-zavtraki",
						color: "#A1B2C3",
						label: {
							create: [
								{ label: "Кофе и завтраки", lang: "en" },
								{ label: "Кофе и завтраки", lang: "ru" },
							],
						},
					}),
				})
			);
			expect(result).toEqual({
				label: "Кофе и завтраки",
				value: "kofe-i-zavtraki",
			});
		});

		it("returns the existing category instead of hitting the unique constraint", async () => {
			prisma.expenseCategory.findUnique.mockResolvedValue({
				value: "travel",
				label: [{ label: "Путешествия" }],
			});

			const result = await service.createExpenseCategory({
				label: " Travel ",
			});

			expect(prisma.expenseCategory.findUnique).toHaveBeenCalledWith(
				expect.objectContaining({ where: { value: "travel" } })
			);
			expect(prisma.expenseCategory.create).not.toHaveBeenCalled();
			expect(result).toEqual({ label: "Путешествия", value: "travel" });
		});

		it("falls back to a generated value when the label has no latin equivalent", async () => {
			prisma.expenseCategory.findUnique.mockResolvedValue(null);
			prisma.expenseCategory.create.mockImplementation(
				({ data }: any) => ({
					value: data.value,
					label: [{ label: data.label.create[0].label }],
				})
			);

			const result = await service.createExpenseCategory({
				label: "日本語",
			});

			expect(result.value).toMatch(/^category-[0-9a-f]{8}$/);
			expect(result.label).toBe("日本語");
		});

		it("rejects a blank label", async () => {
			await expect(
				service.createExpenseCategory({ label: "   " })
			).rejects.toThrow("Expense category label is required");
			expect(prisma.expenseCategory.create).not.toHaveBeenCalled();
		});

		it("leaves the color to the schema default when none is sent", async () => {
			prisma.expenseCategory.findUnique.mockResolvedValue(null);
			prisma.expenseCategory.create.mockResolvedValue({
				value: "sport",
				label: [{ label: "Sport" }],
			});

			await service.createExpenseCategory({ label: "Sport" });

			const { data } = prisma.expenseCategory.create.mock.calls[0][0];
			expect(data).not.toHaveProperty("color");
		});
	});

	describe("resetAll", () => {
		const req = { payload: { id: "u1" } };

		beforeEach(() => {
			prisma.financeItem.deleteMany.mockResolvedValue({ count: 3 });
			prisma.financePlanner.findMany.mockResolvedValue([]);
			prisma.financePlanner.updateMany.mockResolvedValue({ count: 0 });
			prisma.budgetItem.updateMany.mockResolvedValue({ count: 0 });
		});

		it("deletes only the requesting user's finance items and reports how many", async () => {
			const result = await service.resetAll(req);

			expect(prisma.financeItem.deleteMany).toHaveBeenCalledWith({
				where: { userId: "u1" },
			});
			expect(result).toEqual({ count: 3 });
		});

		it("clears the notified threshold on the user's planners", async () => {
			await service.resetAll(req);

			expect(prisma.financePlanner.updateMany).toHaveBeenCalledWith({
				where: { userId: "u1", notifiedThreshold: { not: null } },
				data: {
					notifiedThreshold: null,
					updatedAt: expect.any(Date),
				},
			});
		});

		it("clears the notified threshold on the items of those planners only", async () => {
			prisma.financePlanner.findMany.mockResolvedValue([
				{ id: "p1" },
				{ id: "p2" },
			]);

			await service.resetAll(req);

			expect(prisma.financePlanner.findMany).toHaveBeenCalledWith({
				where: { userId: "u1" },
				select: { id: true },
			});
			expect(prisma.budgetItem.updateMany).toHaveBeenCalledWith({
				where: {
					plannerId: { in: ["p1", "p2"] },
					notifiedThreshold: { not: null },
				},
				data: {
					notifiedThreshold: null,
					updatedAt: expect.any(Date),
				},
			});
		});

		it("skips the budget item update when the user has no planners", async () => {
			await service.resetAll(req);

			expect(prisma.budgetItem.updateMany).not.toHaveBeenCalled();
		});
	});

	describe("update", () => {
		it("re-evaluates the alert state, using the item's original createdAt, when an expense is edited down", async () => {
			prisma.financeItem.findUnique.mockResolvedValue(originalExpense);
			prisma.financeItem.update.mockResolvedValue({
				...originalExpense,
				curPrice: 100,
				convertedPrice: 100,
			});

			const result = await service.update("f1", { curPrice: 100 } as any);

			expect(budgetAlertMock.resetAfterChange).toHaveBeenCalledWith({
				userId: "u1",
				expenseCategoryId: "travel",
				date: originalExpense.createdAt,
			});
			expect(budgetAlertMock.checkAfterExpense).toHaveBeenCalledWith({
				userId: "u1",
				expenseCategoryId: "travel",
				date: originalExpense.createdAt,
			});
			expect(result.notifications).toEqual([]);
		});

		it("fires an alert when an expense is edited up across the threshold", async () => {
			prisma.financeItem.findUnique.mockResolvedValue(originalExpense);
			prisma.financeItem.update.mockResolvedValue({
				...originalExpense,
				curPrice: 900,
				convertedPrice: 900,
			});

			const notification = {
				id: "n1",
				type: "budget.item.threshold",
				title: "t",
				text: "x",
				isReaded: false,
				createdAt: new Date(),
			};
			budgetAlertMock.checkAfterExpense.mockResolvedValue([notification]);

			const result = await service.update("f1", { curPrice: 900 } as any);

			expect(budgetAlertMock.resetAfterChange).toHaveBeenCalledTimes(1);
			expect(budgetAlertMock.checkAfterExpense).toHaveBeenCalledTimes(1);
			expect(result.notifications).toEqual([notification]);
		});

		it("re-evaluates both the old and the new category when expenseCategoryId changes", async () => {
			prisma.financeItem.findUnique.mockResolvedValue(originalExpense);
			prisma.financeItem.update.mockResolvedValue({
				...originalExpense,
				expenseCategoryId: "food",
			});

			await service.update("f1", {
				expenseCategoryId: "food",
			} as any);

			expect(budgetAlertMock.resetAfterChange).toHaveBeenCalledTimes(2);
			expect(budgetAlertMock.checkAfterExpense).toHaveBeenCalledTimes(2);

			const resetCategories =
				budgetAlertMock.resetAfterChange.mock.calls.map(
					call => call[0].expenseCategoryId
				);
			const checkCategories =
				budgetAlertMock.checkAfterExpense.mock.calls.map(
					call => call[0].expenseCategoryId
				);

			expect(resetCategories.sort()).toEqual(["food", "travel"]);
			expect(checkCategories.sort()).toEqual(["food", "travel"]);

			for (const call of [
				...budgetAlertMock.resetAfterChange.mock.calls,
				...budgetAlertMock.checkAfterExpense.mock.calls,
			]) {
				expect(call[0].userId).toBe("u1");
				expect(call[0].date).toEqual(originalExpense.createdAt);
			}
		});

		it("does not touch the alert state for a non-expense record", async () => {
			prisma.financeItem.findUnique.mockResolvedValue({
				...originalExpense,
				operationCategoryId: "income",
				expenseCategoryId: null,
			});
			prisma.financeItem.update.mockResolvedValue({
				...originalExpense,
				operationCategoryId: "income",
				expenseCategoryId: null,
				curPrice: 100,
			});

			const result = await service.update("f1", { curPrice: 100 } as any);

			expect(budgetAlertMock.resetAfterChange).not.toHaveBeenCalled();
			expect(budgetAlertMock.checkAfterExpense).not.toHaveBeenCalled();
			expect(result.notifications).toEqual([]);
		});

		it("triggers re-evaluation when an income record is edited to expense", async () => {
			const originalIncome = {
				...originalExpense,
				operationCategoryId: "income",
				expenseCategoryId: null,
			};
			prisma.financeItem.findUnique.mockResolvedValue(originalIncome);
			prisma.financeItem.update.mockResolvedValue({
				...originalExpense,
				operationCategoryId: "expense",
				expenseCategoryId: "travel",
			});

			await service.update("f1", {
				operationCategoryId: "expense",
				expenseCategoryId: "travel",
			} as any);

			expect(budgetAlertMock.resetAfterChange).toHaveBeenCalledWith({
				userId: "u1",
				expenseCategoryId: "travel",
				date: originalExpense.createdAt,
			});
			expect(budgetAlertMock.checkAfterExpense).toHaveBeenCalledWith({
				userId: "u1",
				expenseCategoryId: "travel",
				date: originalExpense.createdAt,
			});
		});

		it("still re-evaluates the original category when an expense is edited to income", async () => {
			prisma.financeItem.findUnique.mockResolvedValue(originalExpense);
			prisma.financeItem.update.mockResolvedValue({
				...originalExpense,
				operationCategoryId: "income",
				expenseCategoryId: null,
			});

			await service.update("f1", {
				operationCategoryId: "income",
				expenseCategoryId: null,
			} as any);

			expect(budgetAlertMock.resetAfterChange).toHaveBeenCalledWith({
				userId: "u1",
				expenseCategoryId: "travel",
				date: originalExpense.createdAt,
			});
			expect(budgetAlertMock.checkAfterExpense).toHaveBeenCalledWith({
				userId: "u1",
				expenseCategoryId: "travel",
				date: originalExpense.createdAt,
			});
		});
	});
});
