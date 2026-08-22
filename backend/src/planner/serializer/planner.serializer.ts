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

export interface ISerializedPlanner {
	id: string;
	year: number;
	month: number;
	currency: string;
	alertThreshold: number;
	isRegular: boolean;
	income: {
		cur: number;
		currency: string;
		converted: number;
	};
	planned: number;
	totalSpent: number;
	unallocated: number;
	progress: number;
	required: ISerializedBudgetItem[];
	additional: ISerializedBudgetItem[];
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
		spentByCategory: Record<string, number>,
		totalSpent: number
	): ISerializedPlanner {
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
			income: {
				cur: planner.curIncome,
				currency: planner.currencyFromId,
				converted: planner.convertedIncome,
			},
			planned: round(planned),
			totalSpent: round(totalSpent),
			unallocated: round(planner.convertedIncome - planned),
			progress:
				planner.convertedIncome > 0
					? round(totalSpent / planner.convertedIncome)
					: 0,
			required: serializedItems.filter(i => i.isRequired),
			additional: serializedItems.filter(i => !i.isRequired),
		};
	}
}
