import { HealthProfileSerializer } from "./health-profile.serializer";

const profileRecord = (overrides: Record<string, unknown> = {}) => ({
	id: "p1",
	sex: "male",
	birthDate: new Date("1996-08-26T00:00:00.000Z"),
	heightCm: 160,
	activityLevel: "light",
	startWeightKg: 75,
	targetWeightKg: 66,
	startedAt: new Date("2026-08-26T00:00:00.000Z"),
	dailyDeficit: 500,
	proteinPerKg: 1.8,
	proteinBasis: "current",
	fatPercent: 0.3,
	...overrides,
});

const NOW = new Date("2026-08-26T00:00:00.000Z");

describe("HealthProfileSerializer", () => {
	it("reproduces the whole chain from the reference spreadsheet", () => {
		const result = HealthProfileSerializer.serialize(
			profileRecord(),
			75,
			NOW
		);

		expect(result.age).toBe(30);
		expect(result.bmr).toBe(1605);
		expect(result.tdee).toBe(2207);
		expect(result.targetKcal).toBe(1707);
	});

	it("recomputes the norm from the current weight, not the start weight", () => {
		const result = HealthProfileSerializer.serialize(
			profileRecord(),
			70,
			NOW
		);

		expect(result.bmr).toBe(1555);
		expect(result.currentWeightKg).toBe(70);
	});

	it("reports lost and remaining kilograms rounded to two decimals", () => {
		const result = HealthProfileSerializer.serialize(
			profileRecord(),
			71.25,
			NOW
		);

		expect(result.lostKg).toBe(3.75);
		expect(result.remainingKg).toBe(5.25);
		expect(result.progress).toBe(0.42);
	});

	it("lets remaining go negative when the target is already beaten", () => {
		const result = HealthProfileSerializer.serialize(
			profileRecord(),
			64,
			NOW
		);

		expect(result.remainingKg).toBe(-2);
	});

	it("passes the macro conflict flag through", () => {
		const result = HealthProfileSerializer.serialize(
			profileRecord({ sex: "female", proteinPerKg: 2.2, dailyDeficit: 1500 }),
			100,
			NOW
		);

		expect(result.isMacroConflict).toBe(true);
		expect(result.macroTargets.carbsG).toBe(0);
	});

	it("emits dates as plain ISO days so the client never parses timestamps", () => {
		const result = HealthProfileSerializer.serialize(
			profileRecord(),
			75,
			NOW
		);

		expect(result.birthDate).toBe("1996-08-26");
		expect(result.startedAt).toBe("2026-08-26");
		expect(result.isConfigured).toBe(true);
	});
});
