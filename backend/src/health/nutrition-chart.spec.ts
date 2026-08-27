import { EGranularity } from "../../types/health";
import { aggregateNutritionPoints, bucketStart } from "./nutrition-chart";

const day = (date: string, kcal: number, target = 1700) =>
	({
		id: date,
		date,
		fact: { kcal, proteinG: 0, fatG: 0, carbsG: 0 },
		target: { kcal: target, proteinG: 0, fatG: 0, carbsG: 0 },
		deviationKcal: kcal - target,
		status: "onTarget",
		note: null,
		meals: [],
	}) as any;

describe("bucketStart", () => {
	it("keeps the day itself for day granularity", () => {
		expect(
			bucketStart(new Date("2026-08-26T00:00:00.000Z"), EGranularity.Day)
		).toEqual(new Date("2026-08-26T00:00:00.000Z"));
	});

	it("snaps to the Monday of the ISO week", () => {
		// 2026-08-26 is a Wednesday; its week starts Monday the 24th.
		expect(
			bucketStart(new Date("2026-08-26T00:00:00.000Z"), EGranularity.Week)
		).toEqual(new Date("2026-08-24T00:00:00.000Z"));
	});

	it("treats Sunday as the end of its week, not the start of the next", () => {
		// 2026-08-30 is a Sunday; it still belongs to the week of the 24th.
		expect(
			bucketStart(new Date("2026-08-30T00:00:00.000Z"), EGranularity.Week)
		).toEqual(new Date("2026-08-24T00:00:00.000Z"));
	});

	it("snaps to the first day of the calendar month", () => {
		expect(
			bucketStart(new Date("2026-08-26T00:00:00.000Z"), EGranularity.Month)
		).toEqual(new Date("2026-08-01T00:00:00.000Z"));
	});
});

describe("aggregateNutritionPoints", () => {
	it("returns one point per day at day granularity", () => {
		const result = aggregateNutritionPoints(
			[day("2026-08-24", 1600), day("2026-08-25", 1800)],
			EGranularity.Day
		);

		expect(result).toEqual([
			{ date: "2026-08-24", kcal: 1600, target: 1700 },
			{ date: "2026-08-25", kcal: 1800, target: 1700 },
		]);
	});

	it("averages a week rather than summing it, so it stays comparable to the daily target", () => {
		const result = aggregateNutritionPoints(
			[
				day("2026-08-24", 1600),
				day("2026-08-25", 1800),
				day("2026-08-26", 1700),
			],
			EGranularity.Week
		);

		expect(result).toEqual([
			{ date: "2026-08-24", kcal: 1700, target: 1700 },
		]);
	});

	it("splits days that fall into different weeks", () => {
		const result = aggregateNutritionPoints(
			[day("2026-08-30", 1600), day("2026-08-31", 1800)],
			EGranularity.Week
		);

		expect(result.map(point => point.date)).toEqual([
			"2026-08-24",
			"2026-08-31",
		]);
	});

	it("averages a calendar month", () => {
		const result = aggregateNutritionPoints(
			[day("2026-08-01", 1500), day("2026-08-20", 1900)],
			EGranularity.Month
		);

		expect(result).toEqual([
			{ date: "2026-08-01", kcal: 1700, target: 1700 },
		]);
	});

	it("skips days with nothing logged so a gap does not drag the average down", () => {
		const result = aggregateNutritionPoints(
			[
				day("2026-08-24", 1600),
				day("2026-08-25", 0),
				day("2026-08-26", 1800),
			],
			EGranularity.Week
		);

		expect(result).toEqual([
			{ date: "2026-08-24", kcal: 1700, target: 1700 },
		]);
	});

	it("returns an empty list when nothing was logged at all", () => {
		expect(
			aggregateNutritionPoints([day("2026-08-24", 0)], EGranularity.Day)
		).toEqual([]);
	});

	it("returns points in chronological order regardless of input order", () => {
		const result = aggregateNutritionPoints(
			[day("2026-08-26", 1700), day("2026-08-24", 1600)],
			EGranularity.Day
		);

		expect(result.map(point => point.date)).toEqual([
			"2026-08-24",
			"2026-08-26",
		]);
	});
});
