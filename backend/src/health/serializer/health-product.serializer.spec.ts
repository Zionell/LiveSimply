import { HealthProductSerializer } from "./health-product.serializer";

const record = (overrides: Record<string, unknown> = {}) => ({
	id: "pr1",
	value: "chicken-breast",
	kcalPer100: 113,
	proteinPer100: 23.6,
	fatPer100: 1.9,
	carbsPer100: 0.4,
	category: "meat",
	label: [{ label: "Куриная грудка" }],
	...overrides,
});

describe("HealthProductSerializer", () => {
	it("uses the label loaded for the requested language", () => {
		const result = HealthProductSerializer.serialize(record());

		expect(result.title).toBe("Куриная грудка");
	});

	it("falls back to the slug when no label exists for the language", () => {
		const result = HealthProductSerializer.serialize(record({ label: [] }));

		expect(result.title).toBe("chicken-breast");
	});

	it("passes the per-100g figures through untouched", () => {
		const result = HealthProductSerializer.serialize(record());

		expect(result).toMatchObject({
			id: "pr1",
			value: "chicken-breast",
			kcalPer100: 113,
			proteinPer100: 23.6,
			fatPer100: 1.9,
			carbsPer100: 0.4,
			category: "meat",
		});
	});

	it("reports a missing category as null rather than undefined", () => {
		const result = HealthProductSerializer.serialize(
			record({ category: null })
		);

		expect(result.category).toBeNull();
	});
});
