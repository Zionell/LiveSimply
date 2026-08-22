import { IMonthFacts, PlannerSerializer } from "./planner.serializer";

const facts = (overrides: Partial<IMonthFacts> = {}): IMonthFacts => ({
	spentByCategory: {},
	totalSpent: 0,
	actualIncome: 0,
	chart: [],
	...overrides,
});

const plannerRecord = {
	id: "p1",
	year: 2026,
	month: 8,
	currencyFromId: "USD",
	currencyToId: "EUR",
	curIncome: 5000,
	convertedIncome: 1000,
	alertThreshold: 0.7,
	isRegular: false,
	items: [] as Record<string, any>[],
};

describe("PlannerSerializer", () => {
	it("does not clamp unallocated to zero when items overspend the income", () => {
		const planner = {
			...plannerRecord,
			convertedIncome: 1000,
			items: [
				{
					id: "i1",
					label: "Rent",
					curAmount: 1200,
					currencyFromId: "EUR",
					convertedAmount: 1200,
					currencyToId: "EUR",
					expenseCategoryId: "housing",
					isRequired: true,
				},
			],
		};

		const result = PlannerSerializer.serialize(planner, facts());

		expect(result.planned).toBe(1200);
		expect(result.unallocated).toBe(-200);
	});

	it("returns zero progress for an item with a zero convertedAmount instead of dividing by zero", () => {
		const planner = {
			...plannerRecord,
			items: [
				{
					id: "i1",
					label: "Free item",
					curAmount: 0,
					currencyFromId: "EUR",
					convertedAmount: 0,
					currencyToId: "EUR",
					expenseCategoryId: "misc",
					isRequired: false,
				},
			],
		};

		const result = PlannerSerializer.serialize(
			planner,
			facts({ spentByCategory: { misc: 50 }, totalSpent: 50 })
		);

		expect(result.additional[0].progress).toBe(0);
		expect(Number.isFinite(result.additional[0].progress)).toBe(true);
	});

	it("reports the manually planned income and the income actually earned separately", () => {
		const result = PlannerSerializer.serialize(
			plannerRecord,
			facts({ actualIncome: 812.345 })
		);

		expect(result.expectedIncome).toEqual({
			cur: 5000,
			currency: "USD",
			converted: 1000,
		});
		expect(result.actualIncome).toBe(812.35);
	});

	it("rounds every chart point it passes through", () => {
		const result = PlannerSerializer.serialize(
			plannerRecord,
			facts({
				chart: [
					{ day: 1, income: 100.126, expense: 33.333 },
					{ day: 2, income: 100.126, expense: 66.666 },
				],
			})
		);

		expect(result.chart).toEqual([
			{ day: 1, income: 100.13, expense: 33.33 },
			{ day: 2, income: 100.13, expense: 66.67 },
		]);
	});
});
