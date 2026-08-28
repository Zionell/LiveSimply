import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateFinanceDto } from "./dto/create-finance.dto";
import { CreateExpenseCategoryDto } from "./dto/create-expense-category.dto";
import { UpdateFinanceDto } from "./dto/update-finance.dto";
import { PrismaService } from "../prisma.service";
import { FindAllFinanceDto } from "./dto/find-all-finance.dto";
import { RatesService } from "../rates/rates.service";
import { I18nContext } from "nestjs-i18n";
import { SpecsSerializer } from "./serializer/specs.serializer";
import { UsersService } from "../users/users.service";
import { ListSerializer } from "./serializer/list.serializer";
import { getMonthRange } from "../../utils/date";
import { StatisticsSerializer } from "./serializer/statistics.serializer";
import { FinanceSerializer } from "./serializer/finance.serializer";
import { GoalsService } from "../goals/goals.service";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { ERole } from "../../types/user";
import { BudgetAlertService } from "../planner/budget-alert.service";
import { ISerializedNotification } from "../notifications/types";
import { slugify } from "../../utils/slug";
import { normalizeLanguage, SUPPORTED_LANGUAGES } from "../../utils/language";
import { ISpec } from "../../types/common";
import { randomUUID } from "node:crypto";

@Injectable()
export class FinanceService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly ratesService: RatesService,
		private readonly usersService: UsersService,
		private readonly goalsService: GoalsService,
		private readonly budgetAlertService: BudgetAlertService
	) {}

	async getSpecs(req: Record<string, any>) {
		try {
			const role: ERole = req?.payload?.role;

			const [exchange, expenseCategory, operationCategory, goals] =
				await Promise.all([
					this.ratesService.findAll(role),
					this.prismaService.expenseCategory.findMany({
						include: {
							label: {
								where: {
									lang: I18nContext.current().lang,
								},
								orderBy: {
									label: "asc",
								},
								select: {
									label: true,
								},
							},
						},
					}),
					this.prismaService.operationCategory.findMany({
						include: {
							label: {
								where: {
									lang: I18nContext.current().lang,
								},
								orderBy: {
									label: "asc",
								},
								select: {
									label: true,
								},
							},
						},
					}),
					this.goalsService.getSpecs(req),
				]);

			return SpecsSerializer.serialize(
				exchange,
				expenseCategory,
				operationCategory,
				goals
			);
		} catch (e) {
			console.warn("[FinanceService / getSpecs]: ", e);
			throw new Error(e);
		}
	}

	/**
	 * Creates an expense category on the fly from the "add transaction" and
	 * "add budget item" modals. The catalog is shared, so a label that slugs
	 * into an existing category returns that one instead of failing on the
	 * unique constraint.
	 */
	async createExpenseCategory(dto: CreateExpenseCategoryDto): Promise<ISpec> {
		const label = dto.label?.trim();

		if (!label) {
			throw new BadRequestException("Expense category label is required");
		}

		const lang = normalizeLanguage(I18nContext.current()?.lang);
		const include = {
			label: {
				where: { lang },
				select: { label: true },
			},
		};

		const value = slugify(label) || `category-${randomUUID().slice(0, 8)}`;

		try {
			const existing =
				await this.prismaService.expenseCategory.findUnique({
					where: { value },
					include,
				});

			if (existing) {
				return SpecsSerializer.serializeCategory(existing);
			}

			const created = await this.prismaService.expenseCategory.create({
				data: {
					value,
					...(dto.color ? { color: dto.color } : {}),
					label: {
						create: SUPPORTED_LANGUAGES.map(itemLang => ({
							label,
							lang: itemLang,
						})),
					},
				},
				include,
			});

			return SpecsSerializer.serializeCategory(created);
		} catch (e) {
			console.warn("[FinanceService / createExpenseCategory]: ", e);
			throw new Error(e);
		}
	}

	async getStatistics(req: Record<string, any>) {
		try {
			const userId: ERole = req?.payload?.id;

			const date = new Date();
			const period = getMonthRange(
				date.getUTCFullYear(),
				date.getUTCMonth() + 1
			);

			const [rates, finances, financesChart, expenseCategories] =
				await Promise.all([
					this.ratesService.findCurrent(req),
					this.prismaService.financeItem.groupBy({
						by: ["operationCategoryId"],
						where: {
							userId: userId,
							operationCategoryId: { in: ["expense", "income"] },
							createdAt: period,
						},
						_sum: {
							convertedPrice: true,
						},
					}),
					this.prismaService.financeItem.groupBy({
						by: ["expenseCategoryId"],
						where: {
							userId: userId,
							operationCategoryId: { in: ["expense"] },
							createdAt: period,
						},
						_sum: {
							convertedPrice: true,
						},
					}),
					this.prismaService.expenseCategory.findMany({
						include: {
							label: {
								where: {
									lang: I18nContext.current().lang,
								},
								select: {
									label: true,
								},
							},
						},
					}),
				]);

			return {
				finances: FinanceSerializer.serialize(finances),
				rates: rates,
				chart: StatisticsSerializer.serialize(
					financesChart,
					expenseCategories
				),
			};
		} catch (e) {
			console.warn("[FinanceService / getStatistics]: ", e);
			throw new Error(e);
		}
	}

	async create(
		createFinanceDto: CreateFinanceDto,
		req: Record<string, any>
	): Promise<{ notifications: ISerializedNotification[] }> {
		const user: Record<string, any> = req.payload;
		const currencyToId = user.exchange || "EUR";

		const {
			currencyFromId: from,
			curPrice: price,
			operationCategoryId,
			goalsId,
		} = createFinanceDto;

		const convertedPrice: number = await this.ratesService.convertPrice({
			from,
			to: currencyToId,
			price,
		});

		const goalConvertedPrice: number | null = goalsId
			? await this.contributeToGoal(goalsId, { from, price })
			: null;

		const total =
			operationCategoryId === "income"
				? user.total + convertedPrice
				: user.total - convertedPrice;

		const created = await this.prismaService.financeItem.create({
			data: {
				...createFinanceDto,
				expenseCategoryId: createFinanceDto.expenseCategoryId || null,
				currencyToId: currencyToId,
				convertedPrice,
				goalsId: goalsId || null,
				goalConvertedPrice,
				userId: user.id,
			},
		});

		await this.usersService.update({ total }, req);

		if (operationCategoryId !== "expense") {
			return { notifications: [] };
		}

		const notifications = await this.budgetAlertService.checkAfterExpense({
			userId: user.id,
			expenseCategoryId: createFinanceDto.expenseCategoryId || null,
			date: created.createdAt,
		});

		return { notifications };
	}

	/**
	 * Moves money into a goal and reports how much of it landed there, in the
	 * goal's own currency. Stored on the record so the same amount can be
	 * taken back out later, whatever the rates do in between.
	 */
	private async contributeToGoal(
		goalsId: string,
		{
			from,
			price,
			releasing = 0,
		}: { from: string; price: number; releasing?: number }
	): Promise<number> {
		const goal = await this.goalsService.findOne(goalsId);

		if (!goal) {
			throw new NotFoundException({ message: "Goal not found" });
		}

		const goalConvertedPrice: number = await this.ratesService.convertPrice(
			{
				from,
				to: goal.exchangeId,
				price,
			}
		);
		// An edit replaces its own earlier contribution, so that one steps
		// aside before the new amount is measured against the target.
		const newAmount = goal.amount - releasing + goalConvertedPrice;

		if (Math.round(newAmount) > Math.ceil(goal.total)) {
			throw new BadRequestException({
				message: "Cant be greater than total",
			});
		}

		await this.goalsService.update(goalsId, {
			amount: newAmount,
			isCompleted: newAmount === goal.total,
		});

		return goalConvertedPrice;
	}

	/**
	 * Gives a contribution back to the goal it came from. A goal that the
	 * contribution had completed reopens.
	 */
	private async releaseFromGoal(
		goalsId: string | null,
		contributed: number | null
	): Promise<void> {
		if (!goalsId || !contributed) {
			return;
		}

		const goal = await this.goalsService.findOne(goalsId);

		if (!goal) {
			return;
		}

		const amount = goal.amount - contributed;

		await this.goalsService.update(goalsId, {
			amount,
			isCompleted: amount >= goal.total,
		});
	}

	/**
	 * What a record actually did to the balance, expressed in the currency the
	 * user holds today. The stored amount is exact while the currency has not
	 * changed; after a switch it has to be carried over.
	 */
	private async appliedPrice(
		item: { convertedPrice: number; currencyToId: string },
		currencyToId: string
	): Promise<number> {
		if (item.currencyToId === currencyToId) {
			return item.convertedPrice;
		}

		return this.ratesService.convertPrice({
			from: item.currencyToId,
			to: currencyToId,
			price: item.convertedPrice,
		});
	}

	async resetAll(req: Record<string, any>): Promise<{ count: number }> {
		try {
			const userId: string = req.payload.id;

			const { count } = await this.prismaService.financeItem.deleteMany({
				where: { userId },
			});

			const planners = await this.prismaService.financePlanner.findMany({
				where: { userId },
				select: { id: true },
			});

			await this.prismaService.financePlanner.updateMany({
				where: { userId, notifiedThreshold: { not: null } },
				data: { notifiedThreshold: null, updatedAt: new Date() },
			});

			if (planners.length) {
				await this.prismaService.budgetItem.updateMany({
					where: {
						plannerId: {
							in: planners.map(
								(planner: { id: string }) => planner.id
							),
						},
						notifiedThreshold: { not: null },
					},
					data: { notifiedThreshold: null, updatedAt: new Date() },
				});
			}

			return { count };
		} catch (e) {
			console.warn("[FinanceService / resetAll]: ", e);
			throw new Error(e);
		}
	}

	async findAll(
		{ offset, limit, sort }: FindAllFinanceDto,
		req: Record<string, any>
	) {
		try {
			const userId: string = req.payload.id;
			const lang = I18nContext.current().lang;

			const result = await this.prismaService.financeItem.findMany({
				skip: offset,
				take: limit,
				where: { userId },
				orderBy: {
					createdAt: sort,
				},
				include: {
					exchangeItemFrom: {
						select: {
							label: {
								where: { lang },
							},
						},
					},
					exchangeItemTo: {
						select: {
							label: {
								where: { lang },
							},
						},
					},
					expenseCategory: {
						select: {
							label: {
								where: { lang },
							},
						},
					},
					operationCategory: {
						select: {
							label: {
								where: { lang },
							},
						},
					},
				},
			});
			const count = await this.prismaService.financeItem.count({
				where: {
					userId: userId,
				},
			});

			const serializedResults = ListSerializer.serialize(result);

			return {
				result: serializedResults,
				count,
				hasNext: count - limit - offset > 0,
			};
		} catch (e) {
			console.warn("[FinanceService / findAll]: ", e);
			throw new Error(e);
		}
	}

	async findOne(id: string) {
		try {
			return this.prismaService.financeItem.findUnique({
				where: { id },
			});
		} catch (e) {
			console.warn("[FinanceService / findOne]: ", e);
			throw new Error(e);
		}
	}

	async update(
		id: string,
		updateFinanceDto: UpdateFinanceDto,
		req: Record<string, any>
	): Promise<
		Record<string, any> & { notifications: ISerializedNotification[] }
	> {
		const user: Record<string, any> = req.payload;

		const original = await this.prismaService.financeItem.findUnique({
			where: { id },
		});

		if (!original || original.userId !== user.id) {
			throw new NotFoundException({ message: "Finance item not found" });
		}

		try {
			const currencyToId = user.exchange || "EUR";
			const { goalsId, ...financeData } = updateFinanceDto;

			const curPrice = financeData.curPrice ?? original.curPrice;
			const currencyFromId =
				financeData.currencyFromId ?? original.currencyFromId;
			const operationCategoryId =
				financeData.operationCategoryId ?? original.operationCategoryId;

			const priceChanged =
				curPrice !== original.curPrice ||
				currencyFromId !== original.currencyFromId ||
				currencyToId !== original.currencyToId;

			const convertedPrice: number = priceChanged
				? await this.ratesService.convertPrice({
						from: currencyFromId,
						to: currencyToId,
						price: curPrice,
					})
				: original.convertedPrice;

			// The goal keeps whatever it was given until the money itself
			// moves: renaming a category must not shuffle a contribution.
			const nextGoalsId =
				goalsId !== undefined ? goalsId || null : original.goalsId;
			const goalChanged =
				nextGoalsId !== original.goalsId ||
				(priceChanged && Boolean(nextGoalsId));

			let goalConvertedPrice = original.goalConvertedPrice;

			if (goalChanged && nextGoalsId === original.goalsId) {
				goalConvertedPrice = await this.contributeToGoal(nextGoalsId, {
					from: currencyFromId,
					price: curPrice,
					releasing: original.goalConvertedPrice || 0,
				});
			} else if (goalChanged) {
				// The new goal has to accept the money before the old one
				// gives it up: a contribution that overshoots must leave both
				// of them as they were.
				goalConvertedPrice = nextGoalsId
					? await this.contributeToGoal(nextGoalsId, {
							from: currencyFromId,
							price: curPrice,
						})
					: null;

				await this.releaseFromGoal(
					original.goalsId,
					original.goalConvertedPrice
				);
			}

			const updated = await this.prismaService.financeItem.update({
				where: { id },
				data: {
					updatedAt: new Date(),
					...financeData,
					convertedPrice,
					currencyToId,
					goalsId: nextGoalsId,
					goalConvertedPrice,
				},
			});

			const appliedBefore = await this.appliedPrice(
				original,
				currencyToId
			);
			const balanceBefore =
				original.operationCategoryId === "income"
					? appliedBefore
					: -appliedBefore;
			const balanceAfter =
				operationCategoryId === "income"
					? convertedPrice
					: -convertedPrice;

			if (balanceBefore !== balanceAfter) {
				await this.usersService.update(
					{
						total: (user.total || 0) - balanceBefore + balanceAfter,
					},
					req
				);
			}

			if (
				original.operationCategoryId !== "expense" &&
				updated.operationCategoryId !== "expense"
			) {
				return { ...updated, notifications: [] };
			}

			const categoryIds = new Set<string | null>([
				original.expenseCategoryId,
				updated.expenseCategoryId,
			]);

			const notifications: ISerializedNotification[] = [];

			for (const expenseCategoryId of categoryIds) {
				await this.budgetAlertService.resetAfterChange({
					userId: original.userId,
					expenseCategoryId,
					date: original.createdAt,
				});

				const created = await this.budgetAlertService.checkAfterExpense(
					{
						userId: original.userId,
						expenseCategoryId,
						date: original.createdAt,
					}
				);

				notifications.push(...created);
			}

			return { ...updated, notifications };
		} catch (e) {
			console.warn("[FinanceService / update]: ", e);
			throw new Error(e);
		}
	}

	async remove(id: string, req: Record<string, any>) {
		const user: Record<string, any> = req.payload;

		const item = await this.prismaService.financeItem.findUnique({
			where: { id },
		});

		if (!item || item.userId !== user.id) {
			throw new NotFoundException({ message: "Finance item not found" });
		}

		try {
			await this.prismaService.financeItem.delete({
				where: { id },
			});

			const currencyToId = user.exchange || "EUR";
			const revertedPrice: number = await this.appliedPrice(
				item,
				currencyToId
			);

			const total =
				item.operationCategoryId === "income"
					? (user.total || 0) - revertedPrice
					: (user.total || 0) + revertedPrice;

			await this.usersService.update({ total }, req);

			await this.releaseFromGoal(item.goalsId, item.goalConvertedPrice);

			if (item.operationCategoryId === "expense") {
				await this.budgetAlertService.resetAfterChange({
					userId: item.userId,
					expenseCategoryId: item.expenseCategoryId,
					date: item.createdAt,
				});
			}
		} catch (e) {
			console.warn("[FinanceService / remove]: ", e);
			throw new Error(e);
		}
	}
}
