export interface IBudgetItem {
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

export interface IPlannerChartPoint {
	day: number;
	income: number;
	expense: number;
}

export interface IPlanner {
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
	required: IBudgetItem[];
	additional: IBudgetItem[];
	chart: IPlannerChartPoint[];
}
