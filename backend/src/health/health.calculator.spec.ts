import { EActivityLevel, EHealthSex, EProteinBasis } from "../../types/health";
import {
	calcAge,
	calcBmr,
	calcMacroTargets,
	calcProgress,
	calcTargetKcal,
	calcTdee,
} from "./health.calculator";

describe("health calculator", () => {
	describe("calcAge", () => {
		it("does not count a birthday that has not happened yet this year", () => {
			const age = calcAge(
				new Date("1996-08-27T00:00:00.000Z"),
				new Date("2026-08-26T00:00:00.000Z")
			);

			expect(age).toBe(29);
		});

		it("counts the birthday on the day itself", () => {
			const age = calcAge(
				new Date("1996-08-26T00:00:00.000Z"),
				new Date("2026-08-26T00:00:00.000Z")
			);

			expect(age).toBe(30);
		});
	});

	describe("calcBmr", () => {
		it("matches the Mifflin-St Jeor value from the reference spreadsheet", () => {
			expect(
				calcBmr({
					sex: EHealthSex.Male,
					weightKg: 75,
					heightCm: 160,
					age: 30,
				})
			).toBe(1605);
		});

		it("applies the female constant", () => {
			expect(
				calcBmr({
					sex: EHealthSex.Female,
					weightKg: 75,
					heightCm: 160,
					age: 30,
				})
			).toBe(1439);
		});
	});

	describe("calcTdee", () => {
		it("multiplies by the activity factor and rounds like the spreadsheet", () => {
			expect(calcTdee(1605, EActivityLevel.Light)).toBe(2207);
		});
	});

	describe("calcTargetKcal", () => {
		it("subtracts the deficit", () => {
			expect(calcTargetKcal(2207, 500, EHealthSex.Male)).toBe(1707);
		});

		it("never goes below the safe floor for the sex", () => {
			expect(calcTargetKcal(1500, 500, EHealthSex.Female)).toBe(1200);
			expect(calcTargetKcal(1600, 500, EHealthSex.Male)).toBe(1500);
		});
	});

	describe("calcMacroTargets", () => {
		it("takes protein from weight, fat from a share of calories and leaves carbs the remainder", () => {
			expect(
				calcMacroTargets({
					targetKcal: 1707,
					proteinPerKg: 1.8,
					proteinBasis: EProteinBasis.Current,
					currentWeightKg: 75,
					targetWeightKg: 66,
					fatPercent: 0.3,
				})
			).toEqual({
				proteinG: 135,
				fatG: 56.9,
				carbsG: 163.7,
				isMacroConflict: false,
			});
		});

		it("counts protein from the target weight when the basis says so", () => {
			const result = calcMacroTargets({
				targetKcal: 1707,
				proteinPerKg: 1.8,
				proteinBasis: EProteinBasis.Target,
				currentWeightKg: 75,
				targetWeightKg: 66,
				fatPercent: 0.3,
			});

			expect(result.proteinG).toBe(118.8);
		});

		it("clamps carbs at zero and flags the conflict instead of returning a negative", () => {
			const result = calcMacroTargets({
				targetKcal: 1200,
				proteinPerKg: 2.2,
				proteinBasis: EProteinBasis.Current,
				currentWeightKg: 100,
				targetWeightKg: 80,
				fatPercent: 0.3,
			});

			expect(result.carbsG).toBe(0);
			expect(result.isMacroConflict).toBe(true);
		});
	});

	describe("calcProgress", () => {
		it("reports the share of the planned loss already done", () => {
			expect(calcProgress(75, 71, 66)).toBe(0.44);
		});

		it("returns zero when start equals target instead of dividing by zero", () => {
			expect(calcProgress(66, 66, 66)).toBe(0);
		});
	});
});
