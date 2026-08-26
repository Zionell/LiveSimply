import { EActivityLevel, EHealthSex, EProteinBasis } from "../../types/health";

export const ACTIVITY_FACTORS: Record<EActivityLevel, number> = {
	[EActivityLevel.Sedentary]: 1.2,
	[EActivityLevel.Light]: 1.375,
	[EActivityLevel.Moderate]: 1.55,
	[EActivityLevel.High]: 1.725,
};

/**
 * Нижние границы из референсного дневника: цель по калориям не опускается
 * ниже них, какой бы дефицит пользователь ни выставил.
 */
export const SAFE_MIN_KCAL: Record<EHealthSex, number> = {
	[EHealthSex.Male]: 1500,
	[EHealthSex.Female]: 1200,
};

export const KCAL_PER_G = {
	protein: 4,
	fat: 9,
	carbs: 4,
} as const;

export interface IBmrInput {
	sex: EHealthSex;
	weightKg: number;
	heightCm: number;
	age: number;
}

export interface IMacroInput {
	targetKcal: number;
	proteinPerKg: number;
	proteinBasis: EProteinBasis;
	currentWeightKg: number;
	targetWeightKg: number;
	fatPercent: number;
}

export interface IMacroTargets {
	proteinG: number;
	fatG: number;
	carbsG: number;
	isMacroConflict: boolean;
}

const round1 = (value: number): number => +value.toFixed(1);
const round2 = (value: number): number => +value.toFixed(2);

export const calcAge = (birthDate: Date, now: Date = new Date()): number => {
	const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
	const isBeforeBirthday =
		monthDiff < 0 ||
		(monthDiff === 0 && now.getUTCDate() < birthDate.getUTCDate());

	const age =
		now.getUTCFullYear() -
		birthDate.getUTCFullYear() -
		(isBeforeBirthday ? 1 : 0);

	return Math.max(age, 0);
};

export const calcBmr = ({ sex, weightKg, heightCm, age }: IBmrInput): number => {
	const base = 10 * weightKg + 6.25 * heightCm - 5 * age;

	return Math.round(sex === EHealthSex.Male ? base + 5 : base - 161);
};

export const calcTdee = (
	bmr: number,
	activityLevel: EActivityLevel
): number => Math.round(bmr * ACTIVITY_FACTORS[activityLevel]);

export const calcTargetKcal = (
	tdee: number,
	dailyDeficit: number,
	sex: EHealthSex
): number => Math.max(tdee - dailyDeficit, SAFE_MIN_KCAL[sex]);

export const calcMacroTargets = ({
	targetKcal,
	proteinPerKg,
	proteinBasis,
	currentWeightKg,
	targetWeightKg,
	fatPercent,
}: IMacroInput): IMacroTargets => {
	const basisWeight =
		proteinBasis === EProteinBasis.Target ? targetWeightKg : currentWeightKg;

	const proteinG = round1(proteinPerKg * basisWeight);
	const fatG = round1((targetKcal * fatPercent) / KCAL_PER_G.fat);

	const carbsKcal =
		targetKcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat;

	return {
		proteinG,
		fatG,
		carbsG: carbsKcal > 0 ? round1(carbsKcal / KCAL_PER_G.carbs) : 0,
		isMacroConflict: carbsKcal <= 0,
	};
};

export const calcProgress = (
	startWeightKg: number,
	currentWeightKg: number,
	targetWeightKg: number
): number => {
	const planned = startWeightKg - targetWeightKg;

	if (planned === 0) {
		return 0;
	}

	return round2((startWeightKg - currentWeightKg) / planned);
};
