export enum ENotificationType {
	BudgetItemThreshold = "budget.item.threshold",
	BudgetTotalThreshold = "budget.total.threshold",
	PlannerReminder = "planner.reminder",
}

export interface IBudgetThresholdParams {
	label?: string;
	percent: number;
	spent: number;
	planned: number;
	currency: string;
}

export interface IPlannerReminderParams {
	days: number;
}

export type INotificationParams =
	| IBudgetThresholdParams
	| IPlannerReminderParams;

export enum ENotificationGroup {
	Finance = "finance",
	Planner = "planner",
	Goals = "goals",
}

/**
 * Every notification type belongs to exactly one group. The settings screen is
 * built from this map, so a group only becomes switchable once something can
 * actually notify about it.
 */
export const NOTIFICATION_GROUPS: Record<
	ENotificationType,
	ENotificationGroup
> = {
	[ENotificationType.BudgetItemThreshold]: ENotificationGroup.Finance,
	[ENotificationType.BudgetTotalThreshold]: ENotificationGroup.Finance,
	[ENotificationType.PlannerReminder]: ENotificationGroup.Planner,
};

export const AVAILABLE_GROUPS: ENotificationGroup[] = [
	...new Set(Object.values(NOTIFICATION_GROUPS)),
];

export interface INotificationGroupSetting {
	group: ENotificationGroup;
	isEmailEnabled: boolean;
}

export interface ISerializedNotification {
	id: string;
	type: string;
	title: string;
	text: string;
	isReaded: boolean;
	createdAt: Date;
}
