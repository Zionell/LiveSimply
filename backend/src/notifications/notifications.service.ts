import { Injectable, NotFoundException } from "@nestjs/common";
import { I18nContext, I18nService } from "nestjs-i18n";
import { PrismaService } from "../prisma.service";
import { NotificationSerializer } from "./serializer/notification.serializer";
import {
	ENotificationType,
	INotificationParams,
	ISerializedNotification,
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
		private readonly i18nService: I18nService
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

			return NotificationSerializer.serialize(
				notification,
				this.i18nService,
				this.currentLang(lang)
			);
		} catch (e) {
			console.warn("[NotificationsService / create]: ", e);
			throw new Error(e);
		}
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
