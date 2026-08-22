import { Injectable, NotFoundException } from "@nestjs/common";
import { I18nContext, I18nService } from "nestjs-i18n";
import { PrismaService } from "../prisma.service";
import { NotificationSerializer } from "./serializer/notification.serializer";
import { MailService } from "../mail/mail.service";
import { Notification } from "../../generated/prisma/client";
import { normalizeLanguage } from "../../utils/language";
import { UpdateNotificationSettingsDto } from "./dto/update-notification-settings.dto";
import {
	AVAILABLE_GROUPS,
	ENotificationType,
	INotificationGroupSetting,
	INotificationParams,
	ISerializedNotification,
	NOTIFICATION_GROUPS,
} from "./types";

interface ICreateNotification {
	userId: string;
	type: ENotificationType;
	params: INotificationParams;
	lang?: string;
}

@Injectable()
export class NotificationsService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly i18nService: I18nService,
		private readonly mailService: MailService
	) {}

	private currentLang(fallback?: string): string {
		return fallback || I18nContext.current()?.lang || "en";
	}

	async create({
		userId,
		type,
		params,
		lang,
	}: ICreateNotification): Promise<ISerializedNotification | null> {
		try {
			const notification = await this.prismaService.notification.create({
				data: {
					userId,
					type,
					params: params as unknown as object,
				},
			});

			const serialized = NotificationSerializer.serialize(
				notification,
				this.i18nService,
				this.currentLang(lang)
			);

			// Email is best-effort and must never hold up the request that
			// produced the notification.
			void this.emailIfEnabled(notification);

			return serialized;
		} catch (e) {
			console.warn("[NotificationsService / create]: ", e);
			throw new Error(e);
		}
	}

	private readGroupSettings(
		user: { emailNotifications?: unknown } | null
	): Record<string, boolean> {
		return (user?.emailNotifications || {}) as Record<string, boolean>;
	}

	private toSettingsList(
		stored: Record<string, boolean>
	): INotificationGroupSetting[] {
		return AVAILABLE_GROUPS.map(group => ({
			group,
			isEmailEnabled: stored[group] === true,
		}));
	}

	/**
	 * Renders the notification again in the recipient's own language: the
	 * request language is wrong for anything a cron produced.
	 */
	async emailIfEnabled(notification: Notification): Promise<void> {
		try {
			const user = await this.prismaService.user.findUnique({
				where: { id: notification.userId },
				select: {
					email: true,
					emailVerified: true,
					emailNotifications: true,
					language: true,
				},
			});

			if (!user?.email || !user.emailVerified) {
				return;
			}

			const group =
				NOTIFICATION_GROUPS[notification.type as ENotificationType];

			if (this.readGroupSettings(user)[group] !== true) {
				return;
			}

			const language = normalizeLanguage(
				user.language || this.currentLang()
			);

			const rendered = NotificationSerializer.serialize(
				notification,
				this.i18nService,
				language
			);

			if (!rendered) {
				return;
			}

			await this.mailService.sendEmail({
				to: user.email,
				template: "notification",
				locale: language,
				subject: rendered.title,
				props: {
					title: rendered.title,
					text: rendered.text,
				},
			});
		} catch (e) {
			console.warn("[NotificationsService / emailIfEnabled]: ", e);
		}
	}

	async getSettings(
		req: Record<string, any>
	): Promise<INotificationGroupSetting[]> {
		const userId: string = req.payload.id;

		const user = await this.prismaService.user.findUnique({
			where: { id: userId },
			select: { emailNotifications: true },
		});

		return this.toSettingsList(this.readGroupSettings(user));
	}

	async updateSettings(
		dto: UpdateNotificationSettingsDto,
		req: Record<string, any>
	): Promise<INotificationGroupSetting[]> {
		const userId: string = req.payload.id;

		const user = await this.prismaService.user.findUnique({
			where: { id: userId },
			select: { emailNotifications: true },
		});

		const updated = {
			...this.readGroupSettings(user),
			[dto.group]: dto.isEmailEnabled,
		};

		await this.prismaService.user.update({
			where: { id: userId },
			data: {
				emailNotifications: updated,
				updatedAt: new Date(),
			},
		});

		return this.toSettingsList(updated);
	}

	async findAll(req: Record<string, any>) {
		try {
			const userId: string = req.payload.id;

			const [result, unreadCount] = await Promise.all([
				this.prismaService.notification.findMany({
					where: { userId },
					orderBy: { createdAt: "desc" },
					take: 50,
				}),
				this.prismaService.notification.count({
					where: { userId, isReaded: false },
				}),
			]);

			return {
				result: NotificationSerializer.serializeMany(
					result,
					this.i18nService,
					this.currentLang()
				),
				unreadCount,
			};
		} catch (e) {
			console.warn("[NotificationsService / findAll]: ", e);
			throw new Error(e);
		}
	}

	async markRead(id: string, req: Record<string, any>): Promise<void> {
		const userId: string = req.payload.id;

		const notification = await this.prismaService.notification.findUnique({
			where: { id },
		});

		if (!notification || notification.userId !== userId) {
			throw new NotFoundException();
		}

		await this.prismaService.notification.update({
			where: { id },
			data: { isReaded: true, updatedAt: new Date() },
		});
	}

	async markAllRead(req: Record<string, any>): Promise<void> {
		const userId: string = req.payload.id;

		await this.prismaService.notification.updateMany({
			where: { userId, isReaded: false },
			data: { isReaded: true, updatedAt: new Date() },
		});
	}
}
