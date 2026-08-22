import {
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import { PrismaService } from "../prisma.service";
import { RatesService } from "../rates/rates.service";
import { getMonthRange } from "../../utils/date";
import { CreateBudgetItemDto } from "./dto/create-budget-item.dto";
import { UpdateBudgetItemDto } from "./dto/update-budget-item.dto";
import { UpdatePlannerDto } from "./dto/update-planner.dto";
import { FindPlannerDto } from "./dto/find-planner.dto";
import {
	ISerializedPlanner,
	PlannerSerializer,
} from "./serializer/planner.serializer";

const DEFAULT_CURRENCY = "EUR";

@Injectable()
export class PlannerService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly ratesService: RatesService
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

	private async collectSpent(userId: string, year: number, month: number) {
		const period = getMonthRange(year, month);

		const grouped = await this.prismaService.financeItem.groupBy({
			by: ["expenseCategoryId"],
			where: {
				userId,
				operationCategoryId: "expense",
				createdAt: period,
			},
			_sum: { convertedPrice: true },
		});

		const spentByCategory: Record<string, number> = {};
		let totalSpent = 0;

		for (const row of grouped) {
			const sum = row._sum.convertedPrice || 0;
			totalSpent += sum;

			if (row.expenseCategoryId) {
				spentByCategory[row.expenseCategoryId] = sum;
			}
		}

		return { spentByCategory, totalSpent };
	}

	private async present(
		planner: Record<string, any>
	): Promise<ISerializedPlanner> {
		const { spentByCategory, totalSpent } = await this.collectSpent(
			planner.userId,
			planner.year,
			planner.month
		);

		return PlannerSerializer.serialize(
			planner,
			spentByCategory,
			totalSpent
		);
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

		const item = await this.prismaService.budgetItem.findUnique({
			where: { id: itemId },
			include: { planner: true },
		});

		if (!item || item.planner.userId !== userId) {
			throw new NotFoundException();
		}

		const data: Record<string, any> = { updatedAt: new Date() };

		if (dto.label !== undefined) {
			data.label = dto.label;
		}

		if (dto.isRequired !== undefined) {
			data.isRequired = dto.isRequired;
		}

		if (dto.curAmount !== undefined || dto.currencyFromId !== undefined) {
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

			const spent = await this.spentForCategory(
				userId,
				item.expenseCategoryId,
				item.planner.year,
				item.planner.month
			);

			const progress =
				data.convertedAmount > 0 ? spent / data.convertedAmount : 0;

			if (progress < item.planner.alertThreshold) {
				data.notifiedThreshold = null;
			}
		}

		await this.prismaService.budgetItem.update({
			where: { id: itemId },
			data,
		});

		return this.present(
			await this.loadOwnedPlanner(item.plannerId, userId)
		);
	}

	async removeItem(itemId: string, req: Record<string, any>): Promise<void> {
		const userId: string = req.payload.id;

		const item = await this.prismaService.budgetItem.findUnique({
			where: { id: itemId },
			include: { planner: true },
		});

		if (!item || item.planner.userId !== userId) {
			throw new NotFoundException();
		}

		await this.prismaService.budgetItem.delete({ where: { id: itemId } });
	}

	async spentForCategory(
		userId: string,
		expenseCategoryId: string,
		year: number,
		month: number
	): Promise<number> {
		const result = await this.prismaService.financeItem.aggregate({
			where: {
				userId,
				operationCategoryId: "expense",
				expenseCategoryId,
				createdAt: getMonthRange(year, month),
			},
			_sum: { convertedPrice: true },
		});

		return result._sum.convertedPrice || 0;
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
