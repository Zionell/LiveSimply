import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ENotificationType, ISerializedNotification } from "../notifications/types";
import { getMonthRange } from "../../utils/date";

interface ICheckArgs {
	userId: string;
	expenseCategoryId: string | null;
	date?: Date;
}

const round = (value: number): number => +value.toFixed(2);

@Injectable()
export class BudgetAlertService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly notificationsService: NotificationsService
	) {}

	private async loadPlanner(userId: string, date: Date) {
		const year = date.getUTCFullYear();
		const month = date.getUTCMonth() + 1;

		const planner = await this.prismaService.financePlanner.findUnique({
			where: { userId_year_month: { userId, year, month } },
			include: { items: true },
		});

		return { planner, year, month };
	}

	private async sumExpenses(
		userId: string,
		year: number,
		month: number,
		expenseCategoryId?: string
	): Promise<number> {
		const where: Record<string, any> = {
			userId,
			operationCategoryId: "expense",
			createdAt: getMonthRange(year, month),
		};

		if (expenseCategoryId) {
			where.expenseCategoryId = expenseCategoryId;
		}

		const result = await this.prismaService.financeItem.aggregate({
			where,
			_sum: { convertedPrice: true },
		});

		return result._sum.convertedPrice || 0;
	}

	async checkAfterExpense({
		userId,
		expenseCategoryId,
		date = new Date(),
	}: ICheckArgs): Promise<ISerializedNotification[]> {
		try {
			const { planner, year, month } = await this.loadPlanner(userId, date);

			if (!planner) {
				return [];
			}

			const threshold = planner.alertThreshold;
			const notifications: ISerializedNotification[] = [];

			const item = expenseCategoryId
				? (planner.items || []).find(
						(i: Record<string, any>) =>
							i.expenseCategoryId === expenseCategoryId
					)
				: undefined;

			if (item && item.convertedAmount > 0) {
				const spent = await this.sumExpenses(
					userId,
					year,
					month,
					expenseCategoryId
				);
				const progress = spent / item.convertedAmount;

				if (
					progress >= threshold &&
					item.notifiedThreshold !== threshold
				) {
					const notification =
						await this.notificationsService.create({
							userId,
							type: ENotificationType.BudgetItemThreshold,
							params: {
								label: item.label,
								percent: Math.round(progress * 100),
								spent: round(spent),
								planned: item.convertedAmount,
								currency: planner.currencyToId,
							},
						});

					await this.prismaService.budgetItem.update({
						where: { id: item.id },
						data: {
							notifiedThreshold: threshold,
							updatedAt: new Date(),
						},
					});

					if (notification) {
						notifications.push(notification);
					}
				}
			}

			if (planner.convertedIncome > 0) {
				const totalSpent = await this.sumExpenses(userId, year, month);
				const progress = totalSpent / planner.convertedIncome;

				if (
					progress >= threshold &&
					planner.notifiedThreshold !== threshold
				) {
					const notification =
						await this.notificationsService.create({
							userId,
							type: ENotificationType.BudgetTotalThreshold,
							params: {
								percent: Math.round(progress * 100),
								spent: round(totalSpent),
								planned: planner.convertedIncome,
								currency: planner.currencyToId,
							},
						});

					await this.prismaService.financePlanner.update({
						where: { id: planner.id },
						data: {
							notifiedThreshold: threshold,
							updatedAt: new Date(),
						},
					});

					if (notification) {
						notifications.push(notification);
					}
				}
			}

			return notifications;
		} catch (e) {
			console.warn("[BudgetAlertService / checkAfterExpense]: ", e);
			return [];
		}
	}

	async resetAfterChange({
		userId,
		expenseCategoryId,
		date = new Date(),
	}: ICheckArgs): Promise<void> {
		try {
			const { planner, year, month } = await this.loadPlanner(userId, date);

			if (!planner) {
				return;
			}

			const threshold = planner.alertThreshold;

			const item = expenseCategoryId
				? (planner.items || []).find(
						(i: Record<string, any>) =>
							i.expenseCategoryId === expenseCategoryId
					)
				: undefined;

			if (
				item &&
				item.notifiedThreshold !== null &&
				item.convertedAmount > 0
			) {
				const spent = await this.sumExpenses(
					userId,
					year,
					month,
					expenseCategoryId
				);

				if (spent / item.convertedAmount < threshold) {
					await this.prismaService.budgetItem.update({
						where: { id: item.id },
						data: {
							notifiedThreshold: null,
							updatedAt: new Date(),
						},
					});
				}
			}

			if (
				planner.notifiedThreshold !== null &&
				planner.convertedIncome > 0
			) {
				const totalSpent = await this.sumExpenses(userId, year, month);

				if (totalSpent / planner.convertedIncome < threshold) {
					await this.prismaService.financePlanner.update({
						where: { id: planner.id },
						data: {
							notifiedThreshold: null,
							updatedAt: new Date(),
						},
					});
				}
			}
		} catch (e) {
			console.warn("[BudgetAlertService / resetAfterChange]: ", e);
		}
	}
}
