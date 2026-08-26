import { HealthBodySerializer } from "./health-body.serializer";

const entry = (overrides: Record<string, unknown> = {}) => ({
	id: "e1",
	date: new Date("2026-08-24T00:00:00.000Z"),
	weightKg: 74,
	chestCm: null,
	waistCm: null,
	armCm: null,
	note: null,
	...overrides,
});

describe("HealthBodySerializer", () => {
	it("keeps only weighed days on the weight chart and stamps every point with the target", () => {
		const result = HealthBodySerializer.serialize(
			[
				entry(),
				entry({
					id: "e2",
					date: new Date("2026-08-25T00:00:00.000Z"),
					weightKg: null,
					waistCm: 88,
				}),
			],
			66
		);

		expect(result.weightChart).toEqual([
			{ date: "2026-08-24", weight: 74, target: 66 },
		]);
	});

	it("puts a measurement-only day on the measurement chart", () => {
		const result = HealthBodySerializer.serialize(
			[
				entry({
					id: "e2",
					date: new Date("2026-08-25T00:00:00.000Z"),
					weightKg: null,
					waistCm: 88,
				}),
			],
			66
		);

		expect(result.measurementChart).toEqual([
			{ date: "2026-08-25", chest: null, waist: 88, arm: null },
		]);
	});

	it("leaves a weight-only day out of the measurement chart", () => {
		const result = HealthBodySerializer.serialize([entry()], 66);

		expect(result.measurementChart).toEqual([]);
	});

	it("returns entries newest first while the charts stay chronological", () => {
		const result = HealthBodySerializer.serialize(
			[
				entry(),
				entry({
					id: "e2",
					date: new Date("2026-08-25T00:00:00.000Z"),
					weightKg: 73.5,
				}),
			],
			66
		);

		expect(result.entries.map((item) => item.date)).toEqual([
			"2026-08-25",
			"2026-08-24",
		]);
		expect(result.weightChart.map((point) => point.date)).toEqual([
			"2026-08-24",
			"2026-08-25",
		]);
	});
});
