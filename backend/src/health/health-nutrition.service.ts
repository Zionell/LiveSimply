import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { EGranularity, EMealType } from "../../types/health";
import { addUtcDays, startOfUtcDay } from "../../utils/date";
import { PrismaService } from "../prisma.service";
import { HealthProfileService } from "./health-profile.service";
import { HealthProfileSerializer } from "./serializer/health-profile.serializer";
import {
	HealthNutritionSerializer,
	ISerializedNutritionDay,
	ISerializedNutritionTotals,
} from "./serializer/health-nutrition.serializer";
import {
	aggregateNutritionPoints,
	ISerializedNutritionPoint,
} from "./nutrition-chart";
import { calcItemMacros, sumMacros } from "./nutrition.calculator";
import { MealItemDto } from "./dto/meal-item.dto";
import { CreateMealDto } from "./dto/create-meal.dto";
import { UpdateMealDto } from "./dto/update-meal.dto";
import { UpdateNutritionEntryDto } from "./dto/update-nutrition-entry.dto";
import { ApplyTargetsDto } from "./dto/apply-targets.dto";
import { FindNutritionDto } from "./dto/find-nutrition.dto";

export const DEFAULT_RANGE_DAYS = 90;

export interface ISerializedNutritionLog {
	granularity: EGranularity;
	days: ISerializedNutritionDay[];
	totals: ISerializedNutritionTotals;
	chart: ISerializedNutritionPoint[];
}

interface IPreparedItem {
	productId: string;
	title: string;
	grams: number;
	kcal: number;
	proteinG: number;
	fatG: number;
	carbsG: number;
}

@Injectable()
export class HealthNutritionService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly healthProfileService: HealthProfileService
	) {}

	private mealsInclude() {
		return {
			meals: {
				orderBy: { createdAt: "asc" as const },
				include: { items: { orderBy: { createdAt: "asc" as const } } },
			},
		};
	}

	/**
	 * Цели дня берутся из профиля ОДИН РАЗ, при создании строки, и дальше живут
	 * в ней. Смена профиля не переписывает прошлое — для этого есть applyTargets.
	 */
	private async targetsFor(userId: string) {
		const profile = await this.healthProfileService.loadProfile(userId);

		if (!profile) {
			throw new BadRequestException("Health profile is not configured");
		}

		const weight = await this.healthProfileService.currentWeight(
			userId,
			profile.startWeightKg
		);
		const serialized = HealthProfileSerializer.serialize(profile, weight);

		return {
			targetKcal: serialized.targetKcal,
			targetProteinG: serialized.macroTargets.proteinG,
			targetFatG: serialized.macroTargets.fatG,
			targetCarbsG: serialized.macroTargets.carbsG,
		};
	}

	private async prepareItems(
		items: MealItemDto[]
	): Promise<IPreparedItem[]> {
		const products = await this.prismaService.healthProduct.findMany({
			where: { id: { in: items.map(item => item.productId) } },
			include: { label: true },
		});

		const byId = new Map(products.map(product => [product.id, product]));

		return items.map(item => {
			const product = byId.get(item.productId);

			if (!product) {
				throw new BadRequestException(
					`Unknown product: ${item.productId}`
				);
			}

			const macros = calcItemMacros({ product, grams: item.grams });

			return {
				productId: product.id,
				// Снимок названия: продукт могут переименовать или удалить,
				// а запись в дневнике должна остаться читаемой.
				title: (product as any).label?.[0]?.label || product.value,
				grams: item.grams,
				...macros,
			};
		});
	}

	private async ensureDay(userId: string, day: Date) {
		const existing =
			await this.prismaService.healthNutritionEntry.findUnique({
				where: { userId_date: { userId, date: day } },
			});

		if (existing) {
			return existing;
		}

		return this.prismaService.healthNutritionEntry.create({
			data: {
				...(await this.targetsFor(userId)),
				date: day,
				userId,
			},
		});
	}

	private async loadOwnedMeal(mealId: string, userId: string) {
		const meal = await this.prismaService.healthMeal.findUnique({
			where: { id: mealId },
			include: { entry: true },
		});

		if (!meal || (meal as any).entry?.userId !== userId) {
			throw new NotFoundException("Meal not found");
		}

		return meal;
	}

	/**
	 * Пересчёт идёт снизу вверх и последовательно, а не одной транзакцией:
	 * MongoDB-транзакции здесь дали бы немного, а худший исход — устаревший
	 * итог до следующей записи, который сам себя чинит.
	 */
	private async recalcMeal(mealId: string): Promise<void> {
		const items = await this.prismaService.healthMealItem.findMany({
			where: { mealId },
		});

		await this.prismaService.healthMeal.update({
			where: { id: mealId },
			data: sumMacros(items),
		});
	}

	private async recalcDay(entryId: string): Promise<void> {
		const meals = await this.prismaService.healthMeal.findMany({
			where: { entryId },
		});

		await this.prismaService.healthNutritionEntry.update({
			where: { id: entryId },
			data: sumMacros(meals),
		});
	}

	private async writeItems(
		mealId: string,
		items: MealItemDto[]
	): Promise<void> {
		const prepared = await this.prepareItems(items);

		await this.prismaService.healthMealItem.deleteMany({
			where: { mealId },
		});
		await this.prismaService.healthMealItem.createMany({
			data: prepared.map(item => ({ mealId, ...item })),
		});
	}

	async list(
		dto: FindNutritionDto,
		req: Record<string, any>
	): Promise<ISerializedNutritionLog> {
		const userId: string = req.payload.id;
		const granularity = dto.granularity || EGranularity.Day;

		const to = dto.to ? startOfUtcDay(new Date(dto.to)) : startOfUtcDay();
		const from = dto.from
			? startOfUtcDay(new Date(dto.from))
			: addUtcDays(to, -DEFAULT_RANGE_DAYS);

		const entries =
			await this.prismaService.healthNutritionEntry.findMany({
				where: { userId, date: { gte: from, lte: to } },
				orderBy: { date: "asc" },
				include: this.mealsInclude(),
			});

		const days = entries.map(entry =>
			HealthNutritionSerializer.serializeDay(entry)
		);

		return {
			granularity,
			days: [...days].reverse(),
			totals: HealthNutritionSerializer.serializeTotals(days),
			chart: aggregateNutritionPoints(days, granularity),
		};
	}

	async createMeal(dto: CreateMealDto, req: Record<string, any>) {
		const userId: string = req.payload.id;
		const day = startOfUtcDay(new Date(dto.date));

		if (day > startOfUtcDay()) {
			throw new BadRequestException("Cannot log a meal in the future");
		}

		const entry = await this.ensureDay(userId, day);
		const meal = await this.prismaService.healthMeal.create({
			data: { entryId: entry.id, mealType: dto.mealType },
		});

		await this.writeItems(meal.id, dto.items);
		await this.recalcMeal(meal.id);
		await this.recalcDay(entry.id);

		return meal;
	}

	async updateMeal(
		mealId: string,
		dto: UpdateMealDto,
		req: Record<string, any>
	) {
		const meal = await this.loadOwnedMeal(mealId, req.payload.id);

		if (dto.mealType) {
			await this.prismaService.healthMeal.update({
				where: { id: mealId },
				data: { mealType: dto.mealType },
			});
		}

		if (dto.items) {
			await this.writeItems(mealId, dto.items);
			await this.recalcMeal(mealId);
		}

		await this.recalcDay(meal.entryId);

		return this.prismaService.healthMeal.findUnique({
			where: { id: mealId },
			include: { items: true },
		});
	}

	async removeMeal(
		mealId: string,
		req: Record<string, any>
	): Promise<void> {
		const meal = await this.loadOwnedMeal(mealId, req.payload.id);

		await this.prismaService.healthMeal.delete({ where: { id: mealId } });
		await this.recalcDay(meal.entryId);
	}

	private async loadOwnedDay(id: string, userId: string) {
		const entry = await this.prismaService.healthNutritionEntry.findUnique({
			where: { id },
		});

		if (!entry || entry.userId !== userId) {
			throw new NotFoundException("Nutrition entry not found");
		}

		return entry;
	}

	async updateDay(
		id: string,
		dto: UpdateNutritionEntryDto,
		req: Record<string, any>
	) {
		await this.loadOwnedDay(id, req.payload.id);

		const data: Record<string, unknown> = {};

		(
			[
				"targetKcal",
				"targetProteinG",
				"targetFatG",
				"targetCarbsG",
				"note",
			] as const
		).forEach(key => {
			if (dto[key] !== undefined) {
				data[key] = dto[key];
			}
		});

		return this.prismaService.healthNutritionEntry.update({
			where: { id },
			data,
		});
	}

	async removeDay(id: string, req: Record<string, any>): Promise<void> {
		await this.loadOwnedDay(id, req.payload.id);

		await this.prismaService.healthNutritionEntry.delete({ where: { id } });
	}

	async applyTargets(
		dto: ApplyTargetsDto,
		req: Record<string, any>
	): Promise<{ updated: number }> {
		const userId: string = req.payload.id;
		const targets = await this.targetsFor(userId);

		const result =
			await this.prismaService.healthNutritionEntry.updateMany({
				where: {
					userId,
					date: {
						gte: startOfUtcDay(new Date(dto.from)),
						lte: startOfUtcDay(new Date(dto.to)),
					},
				},
				data: targets,
			});

		return { updated: result.count };
	}
}
