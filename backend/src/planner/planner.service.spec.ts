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
		groupBy: jest.fn().mockResolvedValue([]),
		aggregate: jest.fn().mockResolvedValue({ _sum: { convertedPrice: 0 } }),
	},
});

const ratesMock = {
	convertPrice: jest.fn(),
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
		service = new PlannerService(prisma as any, ratesMock as any);
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
			expect(result.income.converted).toBe(0);
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

		it("clears notifiedThreshold when the planned amount grows past the threshold", async () => {
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
			prisma.financeItem.aggregate.mockResolvedValue({
				_sum: { convertedPrice: 700 },
			});
			ratesMock.convertPrice.mockResolvedValue(2000);
			prisma.financePlanner.findUnique.mockResolvedValue(plannerRecord);
			prisma.budgetItem.update.mockResolvedValue({});

			await service.updateItem("i1", { curAmount: 2000 }, req);

			expect(prisma.budgetItem.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						convertedAmount: 2000,
						notifiedThreshold: null,
					}),
				})
			);
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
