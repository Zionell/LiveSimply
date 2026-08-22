import { PlannerSerializer } from "./planner.serializer";

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

		const result = PlannerSerializer.serialize(planner, {}, 0);

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
			{ misc: 50 },
			50
		);

		expect(result.additional[0].progress).toBe(0);
		expect(Number.isFinite(result.additional[0].progress)).toBe(true);
	});
});
