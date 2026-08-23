import {
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import { PrismaService } from "../prisma.service";
import { RatesService } from "../rates/rates.service";
import { BudgetAlertService } from "./budget-alert.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ENotificationType } from "../notifications/types";
import {
	daysInMonth,
	getMonthRange,
	startOfUtcDay,
} from "../../utils/date";
import { CreateBudgetItemDto } from "./dto/create-budget-item.dto";
import { UpdateBudgetItemDto } from "./dto/update-budget-item.dto";
import { UpdatePlannerDto } from "./dto/update-planner.dto";
import { FindPlannerDto } from "./dto/find-planner.dto";
import {
	IMonthFacts,
	ISerializedChartPoint,
	ISerializedPlanner,
	PlannerSerializer,
} from "./serializer/planner.serializer";

const DEFAULT_CURRENCY = "EUR";

export const REMINDER_DAYS_BEFORE = 3;

@Injectable()
export class PlannerService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly ratesService: RatesService,
		private readonly budgetAlertService: BudgetAlertService,
		private readonly notificationsService: NotificationsService
	) {}

	private itemsInclude() {
		const lang = I18nContext.current()?.lang || "en";

		return {
			items: {
				orderBy: { createdAt: "asc" as const },
				include: {
					expenseCategory: {
						include: {
							label: { where: { lang } },
						},
					},
				},
			},
		};
	}

	private baseCurrency(req: Record<string, any>): string {
		return req.payload?.exchange || DEFAULT_CURRENCY;
	}

	private async convert(
		price: number,
		from: string,
		to: string
	): Promise<number> {
		if (from === to) {
			return price;
		}

		return this.ratesService.convertPrice({ from, to, price });
	}

	private async loadOwnedPlanner(id: string, userId: string) {
		const planner = await this.prismaService.financePlanner.findUnique({
			where: { id },
			include: this.itemsInclude(),
		});

		if (!planner || planner.userId !== userId) {
			throw new NotFoundException();
		}

		return planner;
	}

	private async loadOwnedItem(itemId: string, userId: string) {
		const item = await this.prismaService.budgetItem.findUnique({
			where: { id: itemId },
			include: { planner: true },
		});

		if (!item || item.planner.userId !== userId) {
			throw new NotFoundException();
		}

		return item;
	}

	/**
	 * The chart stops at today for the month in progress, so the lines do not
	 * run flat into days that have not happened yet.
	 */
	private lastChartDay(year: number, month: number): number {
		const total = daysInMonth(year, month);
		const now = new Date();
		const isCurrentMonth =
			now.getUTCFullYear() === year && now.getUTCMonth() + 1 === month;

		return isCurrentMonth ? Math.min(now.getUTCDate(), total) : total;
	}

	private async collectMonthFacts(
		userId: string,
		year: number,
		month: number
	): Promise<IMonthFacts> {
		const rows = await this.prismaService.financeItem.findMany({
			where: {
				userId,
				operationCategoryId: { in: ["expense", "income"] },
				createdAt: getMonthRange(year, month),
			},
			select: {
				createdAt: true,
				convertedPrice: true,
				operationCategoryId: true,
				expenseCategoryId: true,
			},
		});

		const lastDay = this.lastChartDay(year, month);
		const dailyIncome: number[] = new Array(lastDay + 1).fill(0);
		const dailyExpense: number[] = new Array(lastDay + 1).fill(0);

		const spentByCategory: Record<string, number> = {};
		let totalSpent = 0;
		let actualIncome = 0;

		for (const row of rows) {
			const amount = row.convertedPrice || 0;
			const day = Math.min(row.createdAt.getUTCDate(), lastDay);

			if (row.operationCategoryId === "income") {
				actualIncome += amount;
				dailyIncome[day] += amount;
				continue;
			}

			totalSpent += amount;
			dailyExpense[day] += amount;

			if (row.expenseCategoryId) {
				spentByCategory[row.expenseCategoryId] =
					(spentByCategory[row.expenseCategoryId] || 0) + amount;
			}
		}

		const chart: ISerializedChartPoint[] = [];
		let income = 0;
		let expense = 0;

		for (let day = 1; day <= lastDay; day++) {
			income += dailyIncome[day];
			expense += dailyExpense[day];

			chart.push({ day, income, expense });
		}

		return { spentByCategory, totalSpent, actualIncome, chart };
	}

	private async present(
		planner: Record<string, any>
	): Promise<ISerializedPlanner> {
		const facts = await this.collectMonthFacts(
			planner.userId,
			planner.year,
			planner.month
		);

		return PlannerSerializer.serialize(planner, facts);
	}

	async getOrCreate(
		dto: FindPlannerDto,
		req: Record<string, any>
	): Promise<ISerializedPlanner> {
		try {
			const userId: string = req.payload.id;
			const now = new Date();
			const year = dto.year || now.getUTCFullYear();
			const month = dto.month || now.getUTCMonth() + 1;

			let planner = await this.prismaService.financePlanner.findUnique({
				where: { userId_year_month: { userId, year, month } },
				include: this.itemsInclude(),
			});

			if (!planner) {
				const currency = this.baseCurrency(req);

				try {
					planner = await this.prismaService.financePlanner.create({
						data: {
							userId,
							year,
							month,
							curIncome: 0,
							currencyFromId: currency,
							convertedIncome: 0,
							currencyToId: currency,
						},
						include: this.itemsInclude(),
					});
				} catch (e) {
					if (e?.code !== "P2002") {
						throw e;
					}

					planner =
						await this.prismaService.financePlanner.findUnique({
							where: {
								userId_year_month: { userId, year, month },
							},
							include: this.itemsInclude(),
						});
				}
			}

			return this.present(planner);
		} catch (e) {
			console.warn("[PlannerService / getOrCreate]: ", e);
			throw e;
		}
	}

	async update(
		id: string,
		dto: UpdatePlannerDto,
		req: Record<string, any>
	): Promise<ISerializedPlanner> {
		const userId: string = req.payload.id;
		const planner = await this.loadOwnedPlanner(id, userId);

		const data: Record<string, any> = { updatedAt: new Date() };

		if (dto.isRegular !== undefined) {
			data.isRegular = dto.isRegular;
		}

		if (dto.alertThreshold !== undefined) {
			data.alertThreshold = dto.alertThreshold;

			if (dto.alertThreshold !== planner.alertThreshold) {
				data.notifiedThreshold = null;
			}
		}

		if (dto.curIncome !== undefined || dto.currencyFromId !== undefined) {
			const curIncome =
				dto.curIncome !== undefined ? dto.curIncome : planner.curIncome;
			const currencyFromId = dto.currencyFromId || planner.currencyFromId;

			data.curIncome = curIncome;
			data.currencyFromId = currencyFromId;
			data.convertedIncome = await this.convert(
				curIncome,
				currencyFromId,
				planner.currencyToId
			);
			data.notifiedThreshold = null;
		}

		await this.prismaService.financePlanner.update({
			where: { id },
			data,
		});

		return this.present(await this.loadOwnedPlanner(id, userId));
	}

	async remove(id: string, req: Record<string, any>): Promise<void> {
		const userId: string = req.payload.id;
		await this.loadOwnedPlanner(id, userId);

		await this.prismaService.financePlanner.delete({ where: { id } });
	}

	async addItem(
		plannerId: string,
		dto: CreateBudgetItemDto,
		req: Record<string, any>
	): Promise<ISerializedPlanner> {
		const userId: string = req.payload.id;
		const planner = await this.loadOwnedPlanner(plannerId, userId);

		const isTaken = (planner.items || []).some(
			(item: Record<string, any>) =>
				item.expenseCategoryId === dto.expenseCategoryId
		);

		if (isTaken) {
			throw new ConflictException({
				message: "category_already_planned",
			});
		}

		const convertedAmount = await this.convert(
			dto.curAmount,
			dto.currencyFromId,
			planner.currencyToId
		);

		await this.prismaService.budgetItem.create({
			data: {
				plannerId,
				label: dto.label,
				curAmount: dto.curAmount,
				currencyFromId: dto.currencyFromId,
				convertedAmount,
				currencyToId: planner.currencyToId,
				expenseCategoryId: dto.expenseCategoryId,
				isRequired: dto.isRequired || false,
			},
		});

		return this.present(await this.loadOwnedPlanner(plannerId, userId));
	}

	async updateItem(
		itemId: string,
		dto: UpdateBudgetItemDto,
		req: Record<string, any>
	): Promise<ISerializedPlanner> {
		const userId: string = req.payload.id;

		const item = await this.loadOwnedItem(itemId, userId);

		const data: Record<string, any> = { updatedAt: new Date() };

		if (dto.label !== undefined) {
			data.label = dto.label;
		}

		if (dto.isRequired !== undefined) {
			data.isRequired = dto.isRequired;
		}

		const amountChanged =
			dto.curAmount !== undefined || dto.currencyFromId !== undefined;

		if (amountChanged) {
			const curAmount =
				dto.curAmount !== undefined ? dto.curAmount : item.curAmount;
			const currencyFromId = dto.currencyFromId || item.currencyFromId;

			data.curAmount = curAmount;
			data.currencyFromId = currencyFromId;
			data.convertedAmount = await this.convert(
				curAmount,
				currencyFromId,
				item.currencyToId
			);
		}

		await this.prismaService.budgetItem.update({
			where: { id: itemId },
			data,
		});

		if (amountChanged) {
			await this.budgetAlertService.resetAfterChange({
				userId,
				expenseCategoryId: item.expenseCategoryId,
				date: new Date(
					Date.UTC(item.planner.year, item.planner.month - 1, 1)
				),
			});
		}

		return this.present(
			await this.loadOwnedPlanner(item.plannerId, userId)
		);
	}

	async removeItem(itemId: string, req: Record<string, any>): Promise<void> {
		const userId: string = req.payload.id;

		await this.loadOwnedItem(itemId, userId);

		await this.prismaService.budgetItem.delete({ where: { id: itemId } });
	}

	/**
	 * Nudges the people who plan their budget to fill in the plan for the month
	 * that is about to start. Owners of a regular plan are skipped: their plan
	 * is copied over automatically on the 1st.
	 */
	async remindToPlanNextMonth(year: number, month: number): Promise<number> {
		try {
			const nextYear = month === 12 ? year + 1 : year;
			const nextMonth = month === 12 ? 1 : month + 1;

			const current = await this.prismaService.financePlanner.findMany({
				where: { year, month },
				include: { items: { select: { id: true } } },
			});

			const userIds = current
				.filter(
					(planner: Record<string, any>) =>
						!planner.isRegular && this.isFilledIn(planner)
				)
				.map((planner: Record<string, any>) => planner.userId);

			if (!userIds.length) {
				return 0;
			}

			const [nextPlanners, alreadySent] = await Promise.all([
				this.prismaService.financePlanner.findMany({
					where: {
						userId: { in: userIds },
						year: nextYear,
						month: nextMonth,
					},
					include: { items: { select: { id: true } } },
				}),
				this.prismaService.notification.findMany({
					where: {
						userId: { in: userIds },
						type: ENotificationType.PlannerReminder,
						createdAt: { gte: startOfUtcDay() },
					},
					select: { userId: true },
				}),
			]);

			const planned = new Set<string>(
				nextPlanners
					.filter((planner: Record<string, any>) =>
						this.isFilledIn(planner)
					)
					.map((planner: Record<string, any>) => planner.userId)
			);

			const notified = new Set<string>(
				alreadySent.map(
					(notification: { userId: string }) => notification.userId
				)
			);

			let sent = 0;

			for (const userId of userIds) {
				if (planned.has(userId) || notified.has(userId)) {
					continue;
				}

				await this.notificationsService.create({
					userId,
					type: ENotificationType.PlannerReminder,
					params: { days: REMINDER_DAYS_BEFORE },
				});

				sent += 1;
			}

			return sent;
		} catch (e) {
			console.warn("[PlannerService / remindToPlanNextMonth]: ", e);
			return 0;
		}
	}

	private isFilledIn(planner: Record<string, any>): boolean {
		return planner.convertedIncome > 0 || (planner.items || []).length > 0;
	}

	async copyRegularPlanners(year: number, month: number): Promise<void> {
		const previousMonth = month === 1 ? 12 : month - 1;
		const previousYear = month === 1 ? year - 1 : year;

		const sources = await this.prismaService.financePlanner.findMany({
			where: {
				isRegular: true,
				year: previousYear,
				month: previousMonth,
			},
			include: { items: true },
		});

		for (const source of sources) {
			const existing = await this.prismaService.financePlanner.findUnique(
				{
					where: {
						userId_year_month: {
							userId: source.userId,
							year,
							month,
						},
					},
				}
			);

			if (existing) {
				continue;
			}

			const created = await this.prismaService.financePlanner.create({
				data: {
					userId: source.userId,
					year,
					month,
					curIncome: source.curIncome,
					currencyFromId: source.currencyFromId,
					convertedIncome: source.convertedIncome,
					currencyToId: source.currencyToId,
					alertThreshold: source.alertThreshold,
					notifiedThreshold: null,
					isRegular: true,
				},
			});

			if (!source.items.length) {
				continue;
			}

			await this.prismaService.budgetItem.createMany({
				data: source.items.map((item: Record<string, any>) => ({
					plannerId: created.id,
					label: item.label,
					curAmount: item.curAmount,
					currencyFromId: item.currencyFromId,
					convertedAmount: item.convertedAmount,
					currencyToId: item.currencyToId,
					expenseCategoryId: item.expenseCategoryId,
					isRequired: item.isRequired,
				})),
			});
		}
	}
}
