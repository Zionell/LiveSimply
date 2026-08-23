import { ERole } from "../../types/user";

export enum ENotificationType {
	BudgetItemThreshold = "budget.item.threshold",
	BudgetTotalThreshold = "budget.total.threshold",
	PlannerReminder = "planner.reminder",
	GoalContributionReminder = "goal.contribution.reminder",
	RatesUpdate = "rates.update",
	RatesUpdateError = "rates.updateError",
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

export interface IGoalContributionParams {
	goalId: string;
	title: string;
	amount: number;
	currency: string;
	days: number;
}

export interface IRatesUpdateParams {
	error?: string;
	errorMsg?: string;
}

export type INotificationParams =
	| IBudgetThresholdParams
	| IPlannerReminderParams
	| IGoalContributionParams
	| IRatesUpdateParams;

export enum ENotificationGroup {
	Finance = "finance",
	Planner = "planner",
	Goals = "goals",
	Rates = "rates",
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
	[ENotificationType.GoalContributionReminder]: ENotificationGroup.Goals,
	[ENotificationType.RatesUpdate]: ENotificationGroup.Rates,
	[ENotificationType.RatesUpdateError]: ENotificationGroup.Rates,
};

export const AVAILABLE_GROUPS: ENotificationGroup[] = [
	...new Set(Object.values(NOTIFICATION_GROUPS)),
];

/**
 * Rate updates are a health signal about the exchange-rate cron, and only
 * admins are ever notified about them, so the group stays off the settings
 * screen for everyone else.
 */
export const ADMIN_ONLY_GROUPS: ENotificationGroup[] = [
	ENotificationGroup.Rates,
];

export const groupsForRole = (role?: string): ENotificationGroup[] => {
	if (role === ERole.ADMIN) {
		return AVAILABLE_GROUPS;
	}

	return AVAILABLE_GROUPS.filter(
		group => !ADMIN_ONLY_GROUPS.includes(group)
	);
};

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
