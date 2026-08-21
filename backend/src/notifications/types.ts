export enum ENotificationType {
	BudgetItemThreshold = "budget.item.threshold",
	BudgetTotalThreshold = "budget.total.threshold",
}

export interface INotificationParams {
	label?: string;
	percent: number;
	spent: number;
	planned: number;
	currency: string;
}

export interface ISerializedNotification {
	id: string;
	type: string;
	title: string;
	text: string;
	isReaded: boolean;
	createdAt: Date;
}
