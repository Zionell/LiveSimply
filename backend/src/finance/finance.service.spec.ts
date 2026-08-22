import { FinanceService } from "./finance.service";

const buildPrismaMock = () => ({
	financeItem: {
		findUnique: jest.fn(),
		update: jest.fn(),
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
	});
});
