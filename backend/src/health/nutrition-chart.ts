import { EGranularity } from "../../types/health";
import { addUtcDays } from "../../utils/date";
import { toIsoDay } from "./serializer/health-profile.serializer";
import { ISerializedNutritionDay } from "./serializer/health-nutrition.serializer";

export interface ISerializedNutritionPoint {
	date: string;
	kcal: number;
	target: number;
	proteinG: number;
	fatG: number;
	carbsG: number;
}

interface IBucket {
	kcal: number;
	target: number;
	proteinG: number;
	fatG: number;
	carbsG: number;
	count: number;
}

const EMPTY_BUCKET: IBucket = {
	kcal: 0,
	target: 0,
	proteinG: 0,
	fatG: 0,
	carbsG: 0,
	count: 0,
};

const round1 = (value: number): number => +value.toFixed(1);

export const bucketStart = (date: Date, granularity: EGranularity): Date => {
	if (granularity === EGranularity.Month) {
		return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
	}

	if (granularity === EGranularity.Week) {
		// getUTCDay() is 0 for Sunday; shifting by 6 makes Monday the origin.
		const offset = (date.getUTCDay() + 6) % 7;

		return addUtcDays(date, -offset);
	}

	return date;
};

/**
 * Точки отдают СРЕДНЕЕ за период, а не сумму: цель по калориям дневная, и
 * точка с месячной суммой рядом с линией дневной цели читалась бы как
 * чудовищное превышение. Дни без записей в среднее не попадают.
 */
export const aggregateNutritionPoints = (
	days: ISerializedNutritionDay[],
	granularity: EGranularity
): ISerializedNutritionPoint[] => {
	const buckets = new Map<string, IBucket>();

	days.filter(day => day.fact.kcal > 0).forEach(day => {
		const key = toIsoDay(
			bucketStart(new Date(`${day.date}T00:00:00.000Z`), granularity)
		);

		const bucket = buckets.get(key) || EMPTY_BUCKET;

		buckets.set(key, {
			kcal: bucket.kcal + day.fact.kcal,
			target: bucket.target + day.target.kcal,
			proteinG: bucket.proteinG + day.fact.proteinG,
			fatG: bucket.fatG + day.fact.fatG,
			carbsG: bucket.carbsG + day.fact.carbsG,
			count: bucket.count + 1,
		});
	});

	return [...buckets.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, bucket]) => ({
			date,
			kcal: Math.round(bucket.kcal / bucket.count),
			target: Math.round(bucket.target / bucket.count),
			proteinG: round1(bucket.proteinG / bucket.count),
			fatG: round1(bucket.fatG / bucket.count),
			carbsG: round1(bucket.carbsG / bucket.count),
		}));
};
