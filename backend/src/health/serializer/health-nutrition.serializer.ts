import { EDeviationStatus, EMealType } from "../../../types/health";
import { calcDeviationStatus, IMacroSet } from "../nutrition.calculator";
import { toIsoDay } from "./health-profile.serializer";

export interface ISerializedMealItem {
	id: string;
	title: string;
	grams: number;
	productId: string | null;
	kcal: number;
	proteinG: number;
	fatG: number;
	carbsG: number;
}

export interface ISerializedMeal {
	id: string;
	mealType: EMealType;
	kcal: number;
	proteinG: number;
	fatG: number;
	carbsG: number;
	items: ISerializedMealItem[];
}

export interface ISerializedNutritionDay {
	id: string;
	date: string;
	fact: IMacroSet;
	target: IMacroSet;
	deviationKcal: number;
	status: EDeviationStatus;
	note: string | null;
	meals: ISerializedMeal[];
}

export interface ISerializedNutritionTotals {
	daysLogged: number;
	onTargetDays: number;
	avgKcal: number;
	avgProteinG: number;
	avgFatG: number;
	avgCarbsG: number;
}

const round1 = (value: number): number => +value.toFixed(1);

export class HealthNutritionSerializer {
	private static serializeItem(
		item: Record<string, any>
	): ISerializedMealItem {
		return {
			id: item.id,
			title: item.title,
			grams: item.grams,
			productId: item.productId ?? null,
			kcal: item.kcal,
			proteinG: item.proteinG,
			fatG: item.fatG,
			carbsG: item.carbsG,
		};
	}

	private static serializeMeal(meal: Record<string, any>): ISerializedMeal {
		return {
			id: meal.id,
			mealType: meal.mealType as EMealType,
			kcal: meal.kcal,
			proteinG: meal.proteinG,
			fatG: meal.fatG,
			carbsG: meal.carbsG,
			items: (meal.items || []).map((item: Record<string, any>) =>
				this.serializeItem(item)
			),
		};
	}

	static serializeDay(
		entry: Record<string, any>
	): ISerializedNutritionDay {
		return {
			id: entry.id,
			date: toIsoDay(entry.date),
			fact: {
				kcal: entry.kcal,
				proteinG: entry.proteinG,
				fatG: entry.fatG,
				carbsG: entry.carbsG,
			},
			target: {
				kcal: entry.targetKcal,
				proteinG: entry.targetProteinG,
				fatG: entry.targetFatG,
				carbsG: entry.targetCarbsG,
			},
			deviationKcal: Math.round(entry.kcal - entry.targetKcal),
			status: calcDeviationStatus(entry.kcal, entry.targetKcal),
			note: entry.note ?? null,
			meals: (entry.meals || []).map((meal: Record<string, any>) =>
				this.serializeMeal(meal)
			),
		};
	}

	/**
	 * Средние считаются только по дням, в которые пользователь действительно
	 * что-то записал. Иначе один пропущенный день утянул бы среднее вниз и
	 * выглядел бы как голодание, а не как отсутствие записи.
	 */
	static serializeTotals(
		days: ISerializedNutritionDay[]
	): ISerializedNutritionTotals {
		const logged = days.filter(day => day.fact.kcal > 0);

		if (!logged.length) {
			return {
				daysLogged: 0,
				onTargetDays: 0,
				avgKcal: 0,
				avgProteinG: 0,
				avgFatG: 0,
				avgCarbsG: 0,
			};
		}

		const sum = logged.reduce(
			(acc, day) => ({
				kcal: acc.kcal + day.fact.kcal,
				proteinG: acc.proteinG + day.fact.proteinG,
				fatG: acc.fatG + day.fact.fatG,
				carbsG: acc.carbsG + day.fact.carbsG,
			}),
			{ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 }
		);

		return {
			daysLogged: logged.length,
			onTargetDays: logged.filter(
				day => day.status === EDeviationStatus.OnTarget
			).length,
			avgKcal: Math.round(sum.kcal / logged.length),
			avgProteinG: round1(sum.proteinG / logged.length),
			avgFatG: round1(sum.fatG / logged.length),
			avgCarbsG: round1(sum.carbsG / logged.length),
		};
	}
}
