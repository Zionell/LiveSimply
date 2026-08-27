import { EDeviationStatus } from "../../types/health";
import {
	calcDeviationStatus,
	calcItemMacros,
	sumMacros,
} from "./nutrition.calculator";

const chickenBreast = {
	kcalPer100: 113,
	proteinPer100: 23.6,
	fatPer100: 1.9,
	carbsPer100: 0.4,
};

const oliveOil = {
	kcalPer100: 884,
	proteinPer100: 0,
	fatPer100: 100,
	carbsPer100: 0,
};

describe("nutrition calculator", () => {
	describe("calcItemMacros", () => {
		it("scales the per-100g figures by the weight eaten", () => {
			expect(calcItemMacros({ product: chickenBreast, grams: 200 })).toEqual({
				kcal: 226,
				proteinG: 47.2,
				fatG: 3.8,
				carbsG: 0.8,
			});
		});

		it("rounds calories to whole numbers and grams to one decimal", () => {
			expect(calcItemMacros({ product: chickenBreast, grams: 65 })).toEqual({
				kcal: 73,
				proteinG: 15.3,
				fatG: 1.2,
				carbsG: 0.3,
			});
		});

		it("handles a product that is pure fat", () => {
			expect(calcItemMacros({ product: oliveOil, grams: 10 })).toEqual({
				kcal: 88,
				proteinG: 0,
				fatG: 10,
				carbsG: 0,
			});
		});

		it("returns zeroes for a zero weight rather than NaN", () => {
			expect(calcItemMacros({ product: chickenBreast, grams: 0 })).toEqual({
				kcal: 0,
				proteinG: 0,
				fatG: 0,
				carbsG: 0,
			});
		});
	});

	describe("sumMacros", () => {
		it("adds already-rounded parts so the total matches what the rows show", () => {
			expect(
				sumMacros([
					{ kcal: 226, proteinG: 47.2, fatG: 3.8, carbsG: 0.8 },
					{ kcal: 88, proteinG: 0, fatG: 10, carbsG: 0 },
				])
			).toEqual({ kcal: 314, proteinG: 47.2, fatG: 13.8, carbsG: 0.8 });
		});

		it("does not accumulate floating point noise across many parts", () => {
			const part = { kcal: 1, proteinG: 0.1, fatG: 0.1, carbsG: 0.1 };

			expect(sumMacros(Array(3).fill(part))).toEqual({
				kcal: 3,
				proteinG: 0.3,
				fatG: 0.3,
				carbsG: 0.3,
			});
		});

		it("returns zeroes for an empty list", () => {
			expect(sumMacros([])).toEqual({
				kcal: 0,
				proteinG: 0,
				fatG: 0,
				carbsG: 0,
			});
		});
	});

	describe("calcDeviationStatus", () => {
		it("calls a day within five percent of the target on target", () => {
			expect(calcDeviationStatus(1707, 1707)).toBe(EDeviationStatus.OnTarget);
			expect(calcDeviationStatus(1630, 1707)).toBe(EDeviationStatus.OnTarget);
			expect(calcDeviationStatus(1790, 1707)).toBe(EDeviationStatus.OnTarget);
		});

		it("calls a day more than five percent below the target under", () => {
			expect(calcDeviationStatus(1600, 1707)).toBe(EDeviationStatus.Under);
		});

		it("calls a day more than five percent above the target over", () => {
			expect(calcDeviationStatus(1800, 1707)).toBe(EDeviationStatus.Over);
		});

		it("treats an untouched day as under rather than on target", () => {
			expect(calcDeviationStatus(0, 1707)).toBe(EDeviationStatus.Under);
		});

		it("does not divide by a zero target", () => {
			expect(calcDeviationStatus(500, 0)).toBe(EDeviationStatus.Over);
			expect(calcDeviationStatus(0, 0)).toBe(EDeviationStatus.OnTarget);
		});
	});
});
