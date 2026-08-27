import { BadRequestException, NotFoundException } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
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

	afterEach(() => {
		jest.restoreAllMocks();
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

		it("looks up product labels in the default language when no i18n context is active", async () => {
			await service.createMeal(
				{
					date: "2026-08-26",
					mealType: EMealType.Breakfast,
					items: [{ productId: "pr1", grams: 80 }],
				},
				req
			);

			expect(prisma.healthProduct.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					include: { label: { where: { lang: "en" } } },
				})
			);
		});

		it("resolves the product label in the current i18n language rather than a fixed one", async () => {
			jest
				.spyOn(I18nContext, "current")
				.mockReturnValue({ lang: "ru" } as any);

			await service.createMeal(
				{
					date: "2026-08-26",
					mealType: EMealType.Breakfast,
					items: [{ productId: "pr1", grams: 80 }],
				},
				req
			);

			expect(prisma.healthProduct.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					include: { label: { where: { lang: "ru" } } },
				})
			);
		});

		it("falls back to the default language instead of forwarding an unsupported cookie value verbatim", async () => {
			// CookieResolver hands back i18n_redirected verbatim, unvalidated.
			// An unsupported value must not reach the Prisma query as-is, or
			// the label lookup silently returns [] and the diary permanently
			// snapshots the product slug instead of a real title.
			jest
				.spyOn(I18nContext, "current")
				.mockReturnValue({ lang: "fr-CA" } as any);

			await service.createMeal(
				{
					date: "2026-08-26",
					mealType: EMealType.Breakfast,
					items: [{ productId: "pr1", grams: 80 }],
				},
				req
			);

			expect(prisma.healthProduct.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					include: { label: { where: { lang: "en" } } },
				})
			);
		});

		it("returns the meal re-read after recalculation, with its items, not the pre-recalc create() result", async () => {
			// createMeal used to return the object handed back by
			// healthMeal.create(), captured BEFORE recalcMeal wrote the
			// totals — so the 201 body always carried zeroed macros and no
			// items. This proves it now matches updateMeal's re-read.
			prisma.healthMeal.create.mockResolvedValue({
				id: "m1",
				entryId: "n1",
				mealType: EMealType.Breakfast,
				kcal: 0,
				proteinG: 0,
				fatG: 0,
				carbsG: 0,
			});
			prisma.healthMeal.findUnique.mockResolvedValue({
				id: "m1",
				entryId: "n1",
				mealType: EMealType.Breakfast,
				kcal: 246,
				proteinG: 10.1,
				fatG: 2.6,
				carbsG: 45.7,
				items: [
					{
						id: "i1",
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

			const meal = await service.createMeal(
				{
					date: "2026-08-26",
					mealType: EMealType.Breakfast,
					items: [{ productId: "pr1", grams: 80 }],
				},
				req
			);

			expect(meal).toEqual(
				expect.objectContaining({
					kcal: 246,
					proteinG: 10.1,
					fatG: 2.6,
					carbsG: 45.7,
					items: [
						expect.objectContaining({
							productId: "pr1",
							grams: 80,
							kcal: 246,
						}),
					],
				})
			);
			expect(prisma.healthMeal.findUnique).toHaveBeenCalledWith({
				where: { id: "m1" },
				include: { items: true },
			});
		});
	});

	describe("createMeal races the unique index (ensureDay P2002)", () => {
		beforeEach(() => {
			prisma.healthProduct.findMany.mockResolvedValue([buckwheat]);
		});

		it("re-reads and uses the winning day when a concurrent create loses the unique-index race", async () => {
			prisma.healthNutritionEntry.findUnique
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce({ id: "n1", userId: "u1" });
			prisma.healthNutritionEntry.create.mockRejectedValue({
				code: "P2002",
			});
			prisma.healthMeal.findUnique.mockResolvedValue({
				id: "m1",
				items: [],
			});

			const meal = await service.createMeal(
				{
					date: "2026-08-26",
					mealType: EMealType.Breakfast,
					items: [{ productId: "pr1", grams: 80 }],
				},
				req
			);

			expect(meal).toEqual({ id: "m1", items: [] });
			expect(prisma.healthNutritionEntry.findUnique).toHaveBeenCalledTimes(
				2
			);
			expect(prisma.healthMeal.create).toHaveBeenCalledWith({
				data: { entryId: "n1", mealType: EMealType.Breakfast },
			});
		});

		it("propagates a non-P2002 error from create instead of swallowing it", async () => {
			prisma.healthNutritionEntry.findUnique.mockResolvedValue(null);
			prisma.healthNutritionEntry.create.mockRejectedValue(
				new Error("boom")
			);

			await expect(
				service.createMeal(
					{
						date: "2026-08-26",
						mealType: EMealType.Breakfast,
						items: [{ productId: "pr1", grams: 80 }],
					},
					req
				)
			).rejects.toThrow("boom");

			expect(prisma.healthMeal.create).not.toHaveBeenCalled();
		});

		it("propagates the original P2002 if the re-read still finds nothing", async () => {
			prisma.healthNutritionEntry.findUnique.mockResolvedValue(null);
			prisma.healthNutritionEntry.create.mockRejectedValue({
				code: "P2002",
			});

			await expect(
				service.createMeal(
					{
						date: "2026-08-26",
						mealType: EMealType.Breakfast,
						items: [{ productId: "pr1", grams: 80 }],
					},
					req
				)
			).rejects.toMatchObject({ code: "P2002" });
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

	describe("applyTargets", () => {
		it("scopes its updateMany to the authenticated user and the requested date range", async () => {
			await service.applyTargets(
				{ from: "2026-08-01", to: "2026-08-26" },
				req
			);

			expect(prisma.healthNutritionEntry.updateMany).toHaveBeenCalledWith({
				where: {
					userId: "u1",
					date: {
						gte: new Date("2026-08-01T00:00:00.000Z"),
						lte: new Date("2026-08-26T00:00:00.000Z"),
					},
				},
				data: {
					targetKcal: 1707,
					targetProteinG: 135,
					targetFatG: 56.9,
					targetCarbsG: 163.7,
				},
			});
		});

		it("scopes the updateMany to whichever user made the request, not a fixed user", async () => {
			const other = { payload: { id: "u2" } };

			await service.applyTargets(
				{ from: "2026-08-01", to: "2026-08-26" },
				other
			);

			expect(prisma.healthNutritionEntry.updateMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ userId: "u2" }),
				})
			);
		});
	});

	describe("updateDay", () => {
		it("refuses to touch a day belonging to somebody else", async () => {
			prisma.healthNutritionEntry.findUnique.mockResolvedValue({
				id: "n1",
				userId: "u2",
			});

			await expect(
				service.updateDay("n1", { targetKcal: 2000 }, req)
			).rejects.toBeInstanceOf(NotFoundException);
			expect(prisma.healthNutritionEntry.update).not.toHaveBeenCalled();
		});

		it("never takes userId from the request body, and writes only the whitelisted fields", async () => {
			prisma.healthNutritionEntry.findUnique.mockResolvedValue({
				id: "n1",
				userId: "u1",
			});

			await service.updateDay(
				"n1",
				{ targetKcal: 2000, userId: "VICTIM" } as any,
				req
			);

			expect(prisma.healthNutritionEntry.update).toHaveBeenCalledWith({
				where: { id: "n1" },
				data: { targetKcal: 2000 },
			});
		});
	});

	describe("removeDay", () => {
		it("refuses to delete a day belonging to somebody else", async () => {
			prisma.healthNutritionEntry.findUnique.mockResolvedValue({
				id: "n1",
				userId: "u2",
			});

			await expect(service.removeDay("n1", req)).rejects.toBeInstanceOf(
				NotFoundException
			);
			expect(prisma.healthNutritionEntry.delete).not.toHaveBeenCalled();
		});

		it("deletes the day once ownership is confirmed", async () => {
			prisma.healthNutritionEntry.findUnique.mockResolvedValue({
				id: "n1",
				userId: "u1",
			});

			await service.removeDay("n1", req);

			expect(prisma.healthNutritionEntry.delete).toHaveBeenCalledWith({
				where: { id: "n1" },
			});
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
