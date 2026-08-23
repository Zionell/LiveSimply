export interface ISerializedBudgetItem {
	id: string;
	label: string;
	expenseCategory: {
		value: string;
		label: string;
		color: string;
	};
	curAmount: number;
	currency: string;
	convertedAmount: number;
	spent: number;
	progress: number;
	isRequired: boolean;
}

export interface ISerializedChartPoint {
	day: number;
	income: number;
	expense: number;
}

export interface IMonthFacts {
	spentByCategory: Record<string, number>;
	totalSpent: number;
	actualIncome: number;
	chart: ISerializedChartPoint[];
}

export interface ISerializedPlanner {
	id: string;
	year: number;
	month: number;
	currency: string;
	alertThreshold: number;
	isRegular: boolean;
	expectedIncome: {
		cur: number;
		currency: string;
		converted: number;
	};
	actualIncome: number;
	planned: number;
	totalSpent: number;
	unallocated: number;
	progress: number;
	required: ISerializedBudgetItem[];
	additional: ISerializedBudgetItem[];
	chart: ISerializedChartPoint[];
}

const round = (value: number): number => +value.toFixed(2);

export class PlannerSerializer {
	private static serializeItem(
		item: Record<string, any>,
		spent: number
	): ISerializedBudgetItem {
		return {
			id: item.id,
			label: item.label,
			expenseCategory: {
				value: item.expenseCategoryId,
				label:
					item.expenseCategory?.label?.[0]?.label ||
					item.expenseCategoryId,
				color: item.expenseCategory?.color || "#fff",
			},
			curAmount: item.curAmount,
			currency: item.currencyFromId,
			convertedAmount: item.convertedAmount,
			spent: round(spent),
			progress:
				item.convertedAmount > 0
					? round(spent / item.convertedAmount)
					: 0,
			isRequired: item.isRequired,
		};
	}

	static serialize(
		planner: Record<string, any>,
		facts: IMonthFacts
	): ISerializedPlanner {
		const { spentByCategory, totalSpent, actualIncome, chart } = facts;
		const items: Record<string, any>[] = planner.items || [];

		const planned = items.reduce(
			(acc, item) => acc + item.convertedAmount,
			0
		);

		const serializedItems = items.map(item =>
			this.serializeItem(
				item,
				spentByCategory[item.expenseCategoryId] || 0
			)
		);

		return {
			id: planner.id,
			year: planner.year,
			month: planner.month,
			currency: planner.currencyToId,
			alertThreshold: planner.alertThreshold,
			isRegular: planner.isRegular,
			expectedIncome: {
				cur: planner.curIncome,
				currency: planner.currencyFromId,
				converted: planner.convertedIncome,
			},
			actualIncome: round(actualIncome),
			planned: round(planned),
			totalSpent: round(totalSpent),
			unallocated: round(planner.convertedIncome - planned),
			progress:
				planner.convertedIncome > 0
					? round(totalSpent / planner.convertedIncome)
					: 0,
			required: serializedItems.filter(i => i.isRequired),
			additional: serializedItems.filter(i => !i.isRequired),
			chart: chart.map(point => ({
				day: point.day,
				income: round(point.income),
				expense: round(point.expense),
			})),
		};
	}
}
