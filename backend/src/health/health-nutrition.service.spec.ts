import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EGranularity, EMealType } from "../../types/health";
import { HealthNutritionService } from "./health-nutrition.service";

const buildPrismaMock = () => ({
	healthNutritionEntry: {
		findMany: jest.fn().mockResolvedValue([]),
		findUnique: jest.fn(),
		findFirst: jest.fn().mockResolvedValue(null),
		create: jest.fn(),
		update: jest.fn(),
		updateMany: jest.fn().mockResolvedValue({ count: 0 }),
		delete: jest.fn(),
	},
	healthMeal: {
		findUnique: jest.fn(),
		create: jest.fn().mockResolvedValue({ id: "m1" }),
		update: jest.fn(),
		delete: jest.fn(),
		findMany: jest.fn().mockResolvedValue([]),
	},
	healthMealItem: {
		createMany: jest.fn(),
		deleteMany: jest.fn(),
		findMany: jest.fn().mockResolvedValue([]),
	},
	healthProduct: {
		findMany: jest.fn().mockResolvedValue([]),
	},
});

const profileRecord = {
	id: "p1",
	userId: "u1",
	sex: "male",
	birthDate: new Date("1996-08-26T00:00:00.000Z"),
	heightCm: 160,
	activityLevel: "light",
	startWeightKg: 75,
	targetWeightKg: 66,
	startedAt: new Date("2026-08-01T00:00:00.000Z"),
	dailyDeficit: 500,
	proteinPerKg: 1.8,
	proteinBasis: "current",
	fatPercent: 0.3,
};

const profileServiceMock = {
	loadProfile: jest.fn(),
	currentWeight: jest.fn(),
};

const req = { payload: { id: "u1" } };

const buckwheat = {
	id: "pr1",
	value: "buckwheat",
	kcalPer100: 308,
	proteinPer100: 12.6,
	fatPer100: 3.3,
	carbsPer100: 57.1,
	label: [{ label: "Гречка, сухая" }],
};

describe("HealthNutritionService", () => {
	let prisma: ReturnType<typeof buildPrismaMock>;
	let service: HealthNutritionService;

	beforeEach(() => {
		prisma = buildPrismaMock();
		profileServiceMock.loadProfile.mockReset().mockResolvedValue(profileRecord);
		profileServiceMock.currentWeight.mockReset().mockResolvedValue(75);
		service = new HealthNutritionService(
			prisma as any,
			profileServiceMock as any
		);
	});

	describe("createMeal", () => {
		beforeEach(() => {
			prisma.healthProduct.findMany.mockResolvedValue([buckwheat]);
			prisma.healthNutritionEntry.findUnique.mockResolvedValue({
				id: "n1",
				userId: "u1",
			});
		});

		it("computes and snapshots the macros of every item from the product", async () => {
			await service.createMeal(
				{
					date: "2026-08-26",
					mealType: EMealType.Breakfast,
					items: [{ productId: "pr1", grams: 80 }],
				},
				req
			);

			expect(prisma.healthMealItem.createMany).toHaveBeenCalledWith({
				data: [
					{
						mealId: "m1",
						productId: "pr1",
						title: "Гречка, сухая",
						grams: 80,
						kcal: 246,
						proteinG: 10.1,
						fatG: 2.6,
						carbsG: 45.7,
					},
				],
			});
		});

		it("refuses an item whose product does not exist", async () => {
			prisma.healthProduct.findMany.mockResolvedValue([]);

			await expect(
				service.createMeal(
					{
						date: "2026-08-26",
						mealType: EMealType.Breakfast,
						items: [{ productId: "pr404", grams: 80 }],
					},
					req
				)
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it("creates the day with targets frozen from the current profile", async () => {
			prisma.healthNutritionEntry.findUnique.mockResolvedValue(null);
			prisma.healthNutritionEntry.create.mockResolvedValue({
				id: "n1",
				userId: "u1",
			});

			await service.createMeal(
				{
					date: "2026-08-26",
					mealType: EMealType.Breakfast,
					items: [{ productId: "pr1", grams: 80 }],
				},
				req
			);

			expect(prisma.healthNutritionEntry.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					userId: "u1",
					targetKcal: 1707,
					targetProteinG: 135,
					targetFatG: 56.9,
					targetCarbsG: 163.7,
				}),
			});
		});

		it("refuses to log food before the profile is configured", async () => {
			// День ещё не заведён — иначе ensureDay вернётся раньше, чем дойдёт
			// до профиля, и проверка никогда не сработает.
			prisma.healthNutritionEntry.findUnique.mockResolvedValue(null);
			profileServiceMock.loadProfile.mockResolvedValue(null);

			await expect(
				service.createMeal(
					{
						date: "2026-08-26",
						mealType: EMealType.Breakfast,
						items: [{ productId: "pr1", grams: 80 }],
					},
					req
				)
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it("refuses a future date", async () => {
			jest.useFakeTimers().setSystemTime(
				new Date("2026-08-26T10:00:00.000Z")
			);

			await expect(
				service.createMeal(
					{
						date: "2026-08-27",
						mealType: EMealType.Breakfast,
						items: [{ productId: "pr1", grams: 80 }],
					},
					req
				)
			).rejects.toBeInstanceOf(BadRequestException);

			jest.useRealTimers();
		});

		it("never takes userId from the request body", async () => {
			prisma.healthNutritionEntry.findUnique.mockResolvedValue(null);
			prisma.healthNutritionEntry.create.mockResolvedValue({
				id: "n1",
				userId: "u1",
			});

			await service.createMeal(
				{
					date: "2026-08-26",
					mealType: EMealType.Breakfast,
					items: [{ productId: "pr1", grams: 80 }],
					userId: "VICTIM",
				} as any,
				req
			);

			expect(prisma.healthNutritionEntry.create).toHaveBeenCalledWith({
				data: expect.objectContaining({ userId: "u1" }),
			});
		});
	});

	describe("updateMeal", () => {
		it("refuses to touch a meal belonging to somebody else", async () => {
			prisma.healthMeal.findUnique.mockResolvedValue({
				id: "m1",
				entry: { id: "n1", userId: "u2" },
			});

			await expect(
				service.updateMeal("m1", { mealType: EMealType.Lunch }, req)
			).rejects.toBeInstanceOf(NotFoundException);
			expect(prisma.healthMeal.update).not.toHaveBeenCalled();
		});

		it("replaces the whole composition rather than merging it", async () => {
			prisma.healthMeal.findUnique.mockResolvedValue({
				id: "m1",
				entry: { id: "n1", userId: "u1" },
			});
			prisma.healthProduct.findMany.mockResolvedValue([buckwheat]);

			await service.updateMeal(
				"m1",
				{ items: [{ productId: "pr1", grams: 100 }] },
				req
			);

			expect(prisma.healthMealItem.deleteMany).toHaveBeenCalledWith({
				where: { mealId: "m1" },
			});
			expect(prisma.healthMealItem.createMany).toHaveBeenCalled();
		});
	});

	describe("removeMeal", () => {
		it("refuses to delete a meal belonging to somebody else", async () => {
			prisma.healthMeal.findUnique.mockResolvedValue({
				id: "m1",
				entry: { id: "n1", userId: "u2" },
			});

			await expect(service.removeMeal("m1", req)).rejects.toBeInstanceOf(
				NotFoundException
			);
			expect(prisma.healthMeal.delete).not.toHaveBeenCalled();
		});
	});

	describe("list", () => {
		it("defaults to the last 90 days ending today", async () => {
			jest.useFakeTimers().setSystemTime(
				new Date("2026-08-26T10:00:00.000Z")
			);

			await service.list({}, req);

			expect(prisma.healthNutritionEntry.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						userId: "u1",
						date: {
							gte: new Date("2026-05-28T00:00:00.000Z"),
							lte: new Date("2026-08-26T00:00:00.000Z"),
						},
					},
				})
			);

			jest.useRealTimers();
		});

		it("defaults to day granularity when none is asked for", async () => {
			const result = await service.list({}, req);

			expect(result.granularity).toBe(EGranularity.Day);
		});
	});
});
