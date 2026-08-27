import { EDeviationStatus } from "../../types/health";

export interface IMacroSet {
	kcal: number;
	proteinG: number;
	fatG: number;
	carbsG: number;
}

export interface IProductMacros {
	kcalPer100: number;
	proteinPer100: number;
	fatPer100: number;
	carbsPer100: number;
}

export interface IItemInput {
	product: IProductMacros;
	grams: number;
}

/**
 * Доля цели, внутри которой день считается попавшим в норму. Порог живёт здесь,
 * а не в компонентах, чтобы таблица и график красили строки по одному правилу.
 */
export const ON_TARGET_TOLERANCE = 0.05;

const round1 = (value: number): number => +value.toFixed(1);

export const calcItemMacros = ({ product, grams }: IItemInput): IMacroSet => {
	const share = grams / 100;

	return {
		kcal: Math.round(product.kcalPer100 * share),
		proteinG: round1(product.proteinPer100 * share),
		fatG: round1(product.fatPer100 * share),
		carbsG: round1(product.carbsPer100 * share),
	};
};

/**
 * Складывает уже округлённые части. Порядок важен: суммировать сырые значения и
 * округлять в конце значило бы, что итог дня не сходится с суммой строк,
 * которые видит пользователь.
 */
export const sumMacros = (parts: IMacroSet[]): IMacroSet =>
	parts.reduce<IMacroSet>(
		(acc, part) => ({
			kcal: acc.kcal + part.kcal,
			proteinG: round1(acc.proteinG + part.proteinG),
			fatG: round1(acc.fatG + part.fatG),
			carbsG: round1(acc.carbsG + part.carbsG),
		}),
		{ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 }
	);

export const calcDeviationStatus = (
	kcal: number,
	targetKcal: number
): EDeviationStatus => {
	if (targetKcal <= 0) {
		return kcal > 0 ? EDeviationStatus.Over : EDeviationStatus.OnTarget;
	}

	const ratio = kcal / targetKcal;

	if (ratio < 1 - ON_TARGET_TOLERANCE) {
		return EDeviationStatus.Under;
	}

	if (ratio > 1 + ON_TARGET_TOLERANCE) {
		return EDeviationStatus.Over;
	}

	return EDeviationStatus.OnTarget;
};
