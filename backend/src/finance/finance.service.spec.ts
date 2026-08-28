import { NotFoundException } from "@nestjs/common";

import { FinanceService } from "./finance.service";

const buildPrismaMock = () => ({
	financeItem: {
		findUnique: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
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

const ratesMock = {
	convertPrice: jest.fn(),
};

const usersMock = {
	update: jest.fn(),
};
const goalsMock = {
	findOne: jest.fn(),
	update: jest.fn(),
};

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
		ratesMock.convertPrice.mockReset();
		// Every fixture is already in the user's currency, so a conversion is
		// the identity unless a test says otherwise.
		ratesMock.convertPrice.mockImplementation(
			async ({ price }: { price: number }) => price
		);
		goalsMock.findOne.mockReset();
		goalsMock.findOne.mockResolvedValue(null);
		goalsMock.update.mockReset();
		goalsMock.update.mockResolvedValue(undefined);
		usersMock.update.mockClear();
		usersMock.update.mockResolvedValue(undefined);
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

	describe("create", () => {
		const req = {
			payload: { id: "u1", exchange: "EUR", total: 1000 },
		};

		const expenseDto = {
			curPrice: 700,
			currencyFromId: "EUR",
			operationCategoryId: "expense",
		};

		beforeEach(() => {
			prisma.financeItem.create.mockResolvedValue(originalExpense);
		});

		it("remembers which goal it fed and how much reached it", async () => {
			goalsMock.findOne.mockResolvedValue({
				id: "g1",
				amount: 1000,
				total: 12000,
				exchangeId: "USD",
			});
			ratesMock.convertPrice
				.mockResolvedValueOnce(700)
				.mockResolvedValueOnce(650);

			await service.create({ ...expenseDto, goalsId: "g1" } as any, req);

			expect(prisma.financeItem.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					goalsId: "g1",
					goalConvertedPrice: 650,
				}),
			});
			expect(goalsMock.update).toHaveBeenCalledWith("g1", {
				amount: 1650,
				isCompleted: false,
			});
		});

		it("leaves the goal columns empty for an unlinked record", async () => {
			await service.create({ ...expenseDto } as any, req);

			expect(prisma.financeItem.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					goalsId: null,
					goalConvertedPrice: null,
				}),
			});
			expect(goalsMock.update).not.toHaveBeenCalled();
		});

		it("still refuses a contribution that overshoots the goal", async () => {
			goalsMock.findOne.mockResolvedValue({
				id: "g1",
				amount: 11800,
				total: 12000,
				exchangeId: "EUR",
			});

			await expect(
				service.create({ ...expenseDto, goalsId: "g1" } as any, req)
			).rejects.toThrow("Cant be greater than total");
			expect(prisma.financeItem.create).not.toHaveBeenCalled();
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
		const req = {
			payload: { id: "u1", exchange: "EUR", total: 1000 },
		};

		it("re-evaluates the alert state, using the item's original createdAt, when an expense is edited down", async () => {
			prisma.financeItem.findUnique.mockResolvedValue(originalExpense);
			prisma.financeItem.update.mockResolvedValue({
				...originalExpense,
				curPrice: 100,
				convertedPrice: 100,
			});

			const result = await service.update(
				"f1",
				{ curPrice: 100 } as any,
				req
			);

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

			const result = await service.update(
				"f1",
				{ curPrice: 900 } as any,
				req
			);

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

			await service.update(
				"f1",
				{ expenseCategoryId: "food" } as any,
				req
			);

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

			const result = await service.update(
				"f1",
				{ curPrice: 100 } as any,
				req
			);

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

			await service.update(
				"f1",
				{
					operationCategoryId: "expense",
					expenseCategoryId: "travel",
				} as any,
				req
			);

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

			await service.update(
				"f1",
				{
					operationCategoryId: "income",
					expenseCategoryId: null,
				} as any,
				req
			);

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

		it("recomputes the stored converted price when the amount changes", async () => {
			prisma.financeItem.findUnique.mockResolvedValue(originalExpense);
			prisma.financeItem.update.mockResolvedValue(originalExpense);
			ratesMock.convertPrice.mockResolvedValue(100);

			await service.update("f1", { curPrice: 100 } as any, req);

			expect(ratesMock.convertPrice).toHaveBeenCalledWith({
				from: "EUR",
				to: "EUR",
				price: 100,
			});
			expect(prisma.financeItem.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ convertedPrice: 100 }),
				})
			);
		});

		it("puts the difference back on the balance when an expense is edited down", async () => {
			prisma.financeItem.findUnique.mockResolvedValue(originalExpense);
			prisma.financeItem.update.mockResolvedValue(originalExpense);

			await service.update("f1", { curPrice: 100 } as any, req);

			expect(usersMock.update).toHaveBeenCalledWith({ total: 1600 }, req);
		});

		it("takes the extra off the balance when an expense is edited up", async () => {
			prisma.financeItem.findUnique.mockResolvedValue(originalExpense);
			prisma.financeItem.update.mockResolvedValue(originalExpense);

			await service.update("f1", { curPrice: 900 } as any, req);

			expect(usersMock.update).toHaveBeenCalledWith({ total: 800 }, req);
		});

		it("swings the balance twice when an expense becomes an income", async () => {
			prisma.financeItem.findUnique.mockResolvedValue(originalExpense);
			prisma.financeItem.update.mockResolvedValue({
				...originalExpense,
				operationCategoryId: "income",
			});

			await service.update(
				"f1",
				{ operationCategoryId: "income" } as any,
				req
			);

			expect(usersMock.update).toHaveBeenCalledWith({ total: 2400 }, req);
		});

		it("leaves the balance alone when only the category changes", async () => {
			prisma.financeItem.findUnique.mockResolvedValue(originalExpense);
			prisma.financeItem.update.mockResolvedValue(originalExpense);

			await service.update(
				"f1",
				{ expenseCategoryId: "food" } as any,
				req
			);

			expect(usersMock.update).not.toHaveBeenCalled();
		});

		it("refuses to edit a record that belongs to somebody else", async () => {
			prisma.financeItem.findUnique.mockResolvedValue({
				...originalExpense,
				userId: "u2",
			});

			await expect(
				service.update("f1", { curPrice: 100 } as any, req)
			).rejects.toThrow(NotFoundException);
			expect(prisma.financeItem.update).not.toHaveBeenCalled();
			expect(usersMock.update).not.toHaveBeenCalled();
		});

		it("moves the goal on to the new amount when a linked record is edited", async () => {
			prisma.financeItem.findUnique.mockResolvedValue({
				...originalExpense,
				goalsId: "g1",
				goalConvertedPrice: 700,
			});
			prisma.financeItem.update.mockResolvedValue(originalExpense);
			goalsMock.findOne.mockResolvedValue({
				id: "g1",
				amount: 1700,
				total: 12000,
				exchangeId: "EUR",
			});

			await service.update("f1", { curPrice: 100 } as any, req);

			expect(goalsMock.update).toHaveBeenCalledTimes(1);
			expect(goalsMock.update).toHaveBeenCalledWith("g1", {
				amount: 1100,
				isCompleted: false,
			});
			expect(prisma.financeItem.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ goalConvertedPrice: 100 }),
				})
			);
		});

		it("leaves the goal alone when the edited amount overshoots it", async () => {
			prisma.financeItem.findUnique.mockResolvedValue({
				...originalExpense,
				goalsId: "g1",
				goalConvertedPrice: 700,
			});
			goalsMock.findOne.mockResolvedValue({
				id: "g1",
				amount: 1700,
				total: 12000,
				exchangeId: "EUR",
			});

			await expect(
				service.update("f1", { curPrice: 12000 } as any, req)
			).rejects.toThrow("Cant be greater than total");
			expect(goalsMock.update).not.toHaveBeenCalled();
			expect(prisma.financeItem.update).not.toHaveBeenCalled();
			expect(usersMock.update).not.toHaveBeenCalled();
		});

		it("keeps the money in the old goal when the new one cannot take it", async () => {
			prisma.financeItem.findUnique.mockResolvedValue({
				...originalExpense,
				goalsId: "g1",
				goalConvertedPrice: 700,
			});
			goalsMock.findOne.mockImplementation(async (id: string) =>
				id === "g1"
					? {
							id: "g1",
							amount: 1700,
							total: 12000,
							exchangeId: "EUR",
						}
					: { id: "g2", amount: 900, total: 1000, exchangeId: "EUR" }
			);

			await expect(
				service.update("f1", { goalsId: "g2" } as any, req)
			).rejects.toThrow("Cant be greater than total");
			expect(goalsMock.update).not.toHaveBeenCalled();
			expect(prisma.financeItem.update).not.toHaveBeenCalled();
		});

		it("gives the contribution back when the goal link is dropped", async () => {
			prisma.financeItem.findUnique.mockResolvedValue({
				...originalExpense,
				goalsId: "g1",
				goalConvertedPrice: 700,
			});
			prisma.financeItem.update.mockResolvedValue(originalExpense);
			goalsMock.findOne.mockResolvedValue({
				id: "g1",
				amount: 1700,
				total: 12000,
				exchangeId: "EUR",
			});

			await service.update("f1", { goalsId: "" } as any, req);

			expect(goalsMock.update).toHaveBeenCalledTimes(1);
			expect(goalsMock.update).toHaveBeenCalledWith("g1", {
				amount: 1000,
				isCompleted: false,
			});
			expect(prisma.financeItem.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						goalsId: null,
						goalConvertedPrice: null,
					}),
				})
			);
		});
	});

	describe("remove", () => {
		const req = {
			payload: { id: "u1", exchange: "EUR", total: 1000 },
		};

		beforeEach(() => {
			prisma.financeItem.delete.mockResolvedValue(originalExpense);
		});

		it("gives the spent amount back to the balance when an expense is deleted", async () => {
			prisma.financeItem.findUnique.mockResolvedValue(originalExpense);

			await service.remove("f1", req);

			expect(prisma.financeItem.delete).toHaveBeenCalledWith({
				where: { id: "f1" },
			});
			expect(usersMock.update).toHaveBeenCalledWith({ total: 1700 }, req);
		});

		it("takes the earned amount back off the balance when an income is deleted", async () => {
			prisma.financeItem.findUnique.mockResolvedValue({
				...originalExpense,
				operationCategoryId: "income",
				expenseCategoryId: null,
			});

			await service.remove("f1", req);

			expect(usersMock.update).toHaveBeenCalledWith({ total: 300 }, req);
			expect(budgetAlertMock.resetAfterChange).not.toHaveBeenCalled();
		});

		it("converts the stored amount when the user switched currency after the record was made", async () => {
			prisma.financeItem.findUnique.mockResolvedValue({
				...originalExpense,
				currencyToId: "USD",
			});
			ratesMock.convertPrice.mockResolvedValue(650);

			await service.remove("f1", {
				payload: { id: "u1", exchange: "EUR", total: 1000 },
			});

			expect(ratesMock.convertPrice).toHaveBeenCalledWith({
				from: "USD",
				to: "EUR",
				price: 700,
			});
			expect(usersMock.update).toHaveBeenCalledWith(
				{ total: 1650 },
				expect.anything()
			);
		});

		it("treats a missing balance as zero", async () => {
			prisma.financeItem.findUnique.mockResolvedValue(originalExpense);

			await service.remove("f1", {
				payload: { id: "u1", exchange: "EUR", total: null },
			});

			expect(usersMock.update).toHaveBeenCalledWith(
				{ total: 700 },
				expect.anything()
			);
		});

		it("refuses to delete a record that belongs to somebody else", async () => {
			prisma.financeItem.findUnique.mockResolvedValue({
				...originalExpense,
				userId: "u2",
			});

			await expect(service.remove("f1", req)).rejects.toThrow(
				NotFoundException
			);
			expect(prisma.financeItem.delete).not.toHaveBeenCalled();
			expect(usersMock.update).not.toHaveBeenCalled();
		});

		it("reports a missing record instead of touching the balance", async () => {
			prisma.financeItem.findUnique.mockResolvedValue(null);

			await expect(service.remove("f1", req)).rejects.toThrow(
				NotFoundException
			);
			expect(usersMock.update).not.toHaveBeenCalled();
		});

		it("re-evaluates the budget alerts of the deleted expense", async () => {
			prisma.financeItem.findUnique.mockResolvedValue(originalExpense);

			await service.remove("f1", req);

			expect(budgetAlertMock.resetAfterChange).toHaveBeenCalledWith({
				userId: "u1",
				expenseCategoryId: "travel",
				date: originalExpense.createdAt,
			});
		});

		it("takes the contribution back out of the goal when a linked record is deleted", async () => {
			prisma.financeItem.findUnique.mockResolvedValue({
				...originalExpense,
				goalsId: "g1",
				goalConvertedPrice: 650,
			});
			goalsMock.findOne.mockResolvedValue({
				id: "g1",
				amount: 1650,
				total: 12000,
				exchangeId: "USD",
			});

			await service.remove("f1", req);

			expect(goalsMock.findOne).toHaveBeenCalledWith("g1");
			expect(goalsMock.update).toHaveBeenCalledWith("g1", {
				amount: 1000,
				isCompleted: false,
			});
		});

		it("reopens a goal that the deleted contribution had completed", async () => {
			prisma.financeItem.findUnique.mockResolvedValue({
				...originalExpense,
				goalsId: "g1",
				goalConvertedPrice: 700,
			});
			goalsMock.findOne.mockResolvedValue({
				id: "g1",
				amount: 12000,
				total: 12000,
				exchangeId: "EUR",
				isCompleted: true,
			});

			await service.remove("f1", req);

			expect(goalsMock.update).toHaveBeenCalledWith("g1", {
				amount: 11300,
				isCompleted: false,
			});
		});

		it("leaves the goals alone for a record that never fed one", async () => {
			prisma.financeItem.findUnique.mockResolvedValue(originalExpense);

			await service.remove("f1", req);

			expect(goalsMock.update).not.toHaveBeenCalled();
		});

		it("still deletes the record when its goal is already gone", async () => {
			prisma.financeItem.findUnique.mockResolvedValue({
				...originalExpense,
				goalsId: "g1",
				goalConvertedPrice: 650,
			});
			goalsMock.findOne.mockResolvedValue(null);

			await service.remove("f1", req);

			expect(prisma.financeItem.delete).toHaveBeenCalled();
			expect(goalsMock.update).not.toHaveBeenCalled();
			expect(usersMock.update).toHaveBeenCalledWith({ total: 1700 }, req);
		});
	});
});
