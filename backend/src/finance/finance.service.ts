import { Injectable } from "@nestjs/common";
import { CreateFinanceDto } from "./dto/create-finance.dto";
import { UpdateFinanceDto } from "./dto/update-finance.dto";
import { PrismaService } from "~/prisma.service";
import { FindAllFinanceDto } from "./dto/find-all-finance.dto";
import { RatesService } from "~/rates/rates.service";
import { I18nContext } from "nestjs-i18n";
import { SpecsSerializer } from "./serializer/specs.serializer";
import { UsersService } from "~/users/users.service";
import { ListSerializer } from "./serializer/list.serializer";
import { daysInMonth } from "@/utils/date";
import { StatisticsSerializer } from "./serializer/statistics.serializer";
import { FinanceSerializer } from "./serializer/finance.serializer";
import { GoalsService } from "~/goals/goals.service";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { ERole } from "@/types/user";

@Injectable()
export class FinanceService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly ratesService: RatesService,
		private readonly usersService: UsersService,
		private readonly goalsService: GoalsService
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

	async getStatistics(req: Record<string, any>) {
		try {
			const userId: ERole = req?.payload?.id;
			const date = new Date();
			const year = date.getFullYear();
			const month = date.getMonth() + 1;
			const lastDay = daysInMonth(month, year);

			const [rates, finances, financesChart, expenseCategories] =
				await Promise.all([
					this.ratesService.findCurrent(req),
					this.prismaService.financeItem.groupBy({
						by: ["operationCategoryId"],
						where: {
							userId: userId,
							operationCategoryId: { in: ["expense", "income"] },
							createdAt: {
								gte: new Date(`${year}-${month}-1`),
								lte: new Date(`${year}-${month}-${lastDay}`),
							},
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
							createdAt: {
								gte: new Date(`${year}-${month}-1`),
								lte: new Date(`${year}-${month}-${lastDay}`),
							},
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
				rates,
				chart: StatisticsSerializer.serialize(
					financesChart,
					expenseCategories
				),
			};
		} catch (e) {
			console.warn("[FinanceService / getSpecs]: ", e);
			throw new Error(e);
		}
	}

	async create(
		createFinanceDto: CreateFinanceDto,
		req: Record<string, any>
	): Promise<void> {
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

		if (goalsId) {
			const curGoal = await this.goalsService.findOne(goalsId);
			const goalConvertedPrice: number =
				await this.ratesService.convertPrice({
					from,
					to: curGoal.exchangeId,
					price,
				});
			const newAmount = curGoal.amount + goalConvertedPrice;

			if (Math.round(newAmount) > Math.ceil(curGoal.total)) {
				throw new BadRequestException({
					message: "Cant be greater than total",
				});
			}

			await this.goalsService.update(goalsId, {
				amount: newAmount,
				isCompleted: newAmount === curGoal.total,
			});
		}

		const total =
			operationCategoryId === "income"
				? user.total + convertedPrice
				: user.total - convertedPrice;

		delete createFinanceDto.goalsId;

		await this.prismaService.financeItem.create({
			data: {
				...createFinanceDto,
				expenseCategoryId: createFinanceDto.expenseCategoryId || null,
				currencyToId: currencyToId,
				convertedPrice,
				userId: user.id,
			},
		});

		await this.usersService.update({ total }, req);
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

	async update(id: string, updateFinanceDto: UpdateFinanceDto) {
		try {
			return this.prismaService.financeItem.update({
				where: { id },
				data: {
					...updateFinanceDto,
				},
			});
		} catch (e) {
			console.warn("[FinanceService / update]: ", e);
			throw new Error(e);
		}
	}

	async remove(id: string) {
		try {
			await this.prismaService.financeItem.delete({
				where: { id },
			});
		} catch (e) {
			console.warn("[FinanceService / remove]: ", e);
			throw new Error(e);
		}
	}
}
