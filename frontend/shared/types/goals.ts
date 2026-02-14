export interface IGoal {
	id: string;
	userId: string;
	title: string;
	createdAt: Date;
	untilAt: Date;
	total: number;
	amount: number;
	exchangeId: string;
	isCompleted: boolean;
}
