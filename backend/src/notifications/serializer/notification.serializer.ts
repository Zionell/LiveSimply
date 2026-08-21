import { I18nService } from "nestjs-i18n";
import { Notification } from "../../../generated/prisma/client";
import { ENotificationType, ISerializedNotification } from "../types";

const KNOWN_TYPES: string[] = Object.values(ENotificationType);

export class NotificationSerializer {
	static serialize(
		notification: Notification,
		i18n: I18nService,
		lang: string
	): ISerializedNotification | null {
		if (!KNOWN_TYPES.includes(notification.type)) {
			console.warn(
				"[NotificationSerializer / serialize]: unknown type ",
				notification.type
			);
			return null;
		}

		const args = (notification.params ?? {}) as Record<string, unknown>;

		return {
			id: notification.id,
			type: notification.type,
			title: i18n.translate(
				`notification.${notification.type}.title`,
				{ lang, args }
			),
			text: i18n.translate(
				`notification.${notification.type}.text`,
				{ lang, args }
			),
			isReaded: notification.isReaded,
			createdAt: notification.createdAt,
		};
	}

	static serializeMany(
		notifications: Notification[],
		i18n: I18nService,
		lang: string
	): ISerializedNotification[] {
		return notifications
			.map((n) => this.serialize(n, i18n, lang))
			.filter((n): n is ISerializedNotification => n !== null);
	}
}
