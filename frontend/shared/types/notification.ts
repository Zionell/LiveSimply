export interface INotification {
	id: string;
	type: string;
	title: string;
	text: string;
	isReaded: boolean;
	createdAt: string;
}

export interface INotificationSetting {
	group: string;
	isEmailEnabled: boolean;
}
