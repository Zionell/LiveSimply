import { EDeviationStatus } from "../../../types/health";
import { HealthNutritionSerializer } from "./health-nutrition.serializer";

const entry = (overrides: Record<string, unknown> = {}) => ({
	id: "n1",
	date: new Date("2026-08-26T00:00:00.000Z"),
	kcal: 1700,
	proteinG: 130,
	fatG: 56,
	carbsG: 160,
	targetKcal: 1707,
	targetProteinG: 135,
	targetFatG: 56.9,
	targetCarbsG: 163.7,
	note: null,
	meals: [],
	...overrides,
});

const meal = (overrides: Record<string, unknown> = {}) => ({
	id: "m1",
	mealType: "breakfast",
	kcal: 300,
	proteinG: 20,
	fatG: 10,
	carbsG: 30,
	items: [],
	...overrides,
});

describe("HealthNutritionSerializer", () => {
	describe("serializeDay", () => {
		it("splits fact and target into separate blocks", () => {
			const result = HealthNutritionSerializer.serializeDay(entry());

			expect(result.fact).toEqual({
				kcal: 1700,
				proteinG: 130,
				fatG: 56,
				carbsG: 160,
			});
			expect(result.target).toEqual({
				kcal: 1707,
				proteinG: 135,
				fatG: 56.9,
				carbsG: 163.7,
			});
		});

		it("reports the calorie deviation and its status", () => {
			const result = HealthNutritionSerializer.serializeDay(entry());

			expect(result.deviationKcal).toBe(-7);
			expect(result.status).toBe(EDeviationStatus.OnTarget);
		});

		it("marks a day well over the target", () => {
			const result = HealthNutritionSerializer.serializeDay(
				entry({ kcal: 2400 })
			);

			expect(result.deviationKcal).toBe(693);
			expect(result.status).toBe(EDeviationStatus.Over);
		});

		it("emits the date as a plain ISO day", () => {
			expect(HealthNutritionSerializer.serializeDay(entry()).date).toBe(
				"2026-08-26"
			);
		});

		it("carries meals through with their items", () => {
			const result = HealthNutritionSerializer.serializeDay(
				entry({
					meals: [
						meal({
							items: [
								{
									id: "i1",
									title: "Гречка, сухая",
									grams: 80,
									productId: "pr1",
									kcal: 246,
									proteinG: 10.1,
									fatG: 2.6,
									carbsG: 45.7,
								},
							],
						}),
					],
				})
			);

			expect(result.meals).toHaveLength(1);
			expect(result.meals[0].mealType).toBe("breakfast");
			expect(result.meals[0].items[0]).toEqual({
				id: "i1",
				title: "Гречка, сухая",
				grams: 80,
				productId: "pr1",
				kcal: 246,
				proteinG: 10.1,
				fatG: 2.6,
				carbsG: 45.7,
			});
		});

		it("reports a deleted product as a null productId while keeping the title", () => {
			const result = HealthNutritionSerializer.serializeDay(
				entry({
					meals: [
						meal({
							items: [
								{
									id: "i1",
									title: "Гречка, сухая",
									grams: 80,
									productId: null,
									kcal: 246,
									proteinG: 10.1,
									fatG: 2.6,
									carbsG: 45.7,
								},
							],
						}),
					],
				})
			);

			expect(result.meals[0].items[0].productId).toBeNull();
			expect(result.meals[0].items[0].title).toBe("Гречка, сухая");
		});
	});

	describe("serializeTotals", () => {
		it("averages only the days that were actually logged", () => {
			const days = [
				HealthNutritionSerializer.serializeDay(entry({ kcal: 1600 })),
				HealthNutritionSerializer.serializeDay(
					entry({ id: "n2", kcal: 1800 })
				),
				HealthNutritionSerializer.serializeDay(
					entry({ id: "n3", kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 })
				),
			];

			const totals = HealthNutritionSerializer.serializeTotals(days);

			expect(totals.daysLogged).toBe(2);
			expect(totals.avgKcal).toBe(1700);
		});

		it("counts how many logged days landed on target", () => {
			const days = [
				HealthNutritionSerializer.serializeDay(entry({ kcal: 1700 })),
				HealthNutritionSerializer.serializeDay(
					entry({ id: "n2", kcal: 2400 })
				),
			];

			expect(
				HealthNutritionSerializer.serializeTotals(days).onTargetDays
			).toBe(1);
		});

		it("returns zeroes rather than NaN when nothing was logged", () => {
			const totals = HealthNutritionSerializer.serializeTotals([]);

			expect(totals).toEqual({
				daysLogged: 0,
				onTargetDays: 0,
				avgKcal: 0,
				avgProteinG: 0,
				avgFatG: 0,
				avgCarbsG: 0,
			});
		});
	});
});
