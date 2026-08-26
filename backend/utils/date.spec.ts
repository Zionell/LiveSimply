import { addUtcDays, getMonthRange } from "./date";

describe("getMonthRange", () => {
	it("returns the first instant of the month and the first instant of the next month", () => {
		const range = getMonthRange(2026, 8);

		expect(range.gte.toISOString()).toBe("2026-08-01T00:00:00.000Z");
		expect(range.lt.toISOString()).toBe("2026-09-01T00:00:00.000Z");
	});

	it("rolls over into the next year for December", () => {
		const range = getMonthRange(2026, 12);

		expect(range.gte.toISOString()).toBe("2026-12-01T00:00:00.000Z");
		expect(range.lt.toISOString()).toBe("2027-01-01T00:00:00.000Z");
	});

	it("covers the 29th of February in a leap year", () => {
		const range = getMonthRange(2024, 2);

		expect(range.gte.toISOString()).toBe("2024-02-01T00:00:00.000Z");
		expect(range.lt.toISOString()).toBe("2024-03-01T00:00:00.000Z");
		expect(new Date("2024-02-29T23:59:59.000Z") < range.lt).toBe(true);
	});

	it("includes an expense made on the last day of the month", () => {
		const range = getMonthRange(2026, 8);
		const lastDayExpense = new Date("2026-08-31T18:30:00.000Z");

		expect(lastDayExpense >= range.gte && lastDayExpense < range.lt).toBe(true);
	});
});

describe("addUtcDays", () => {
	it("shifts forward across a month boundary", () => {
		expect(addUtcDays(new Date("2026-08-30T00:00:00.000Z"), 3)).toEqual(
			new Date("2026-09-02T00:00:00.000Z")
		);
	});

	it("shifts backwards with a negative step", () => {
		expect(addUtcDays(new Date("2026-08-01T00:00:00.000Z"), -1)).toEqual(
			new Date("2026-07-31T00:00:00.000Z")
		);
	});

	it("does not mutate the date it was given", () => {
		const original = new Date("2026-08-01T00:00:00.000Z");

		addUtcDays(original, 5);

		expect(original).toEqual(new Date("2026-08-01T00:00:00.000Z"));
	});
});
