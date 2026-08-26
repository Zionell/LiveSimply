import {
	EActivityLevel,
	EHealthSex,
	EProteinBasis,
} from "../../../types/health";
import {
	calcAge,
	calcBmr,
	calcMacroTargets,
	calcProgress,
	calcTargetKcal,
	calcTdee,
} from "../health.calculator";

export interface ISerializedMacroTargets {
	proteinG: number;
	fatG: number;
	carbsG: number;
}

export interface ISerializedHealthProfile {
	isConfigured: true;
	id: string;
	sex: EHealthSex;
	birthDate: string;
	heightCm: number;
	activityLevel: EActivityLevel;
	startWeightKg: number;
	targetWeightKg: number;
	startedAt: string;
	dailyDeficit: number;
	proteinPerKg: number;
	proteinBasis: EProteinBasis;
	fatPercent: number;
	age: number;
	currentWeightKg: number;
	lostKg: number;
	remainingKg: number;
	progress: number;
	bmr: number;
	tdee: number;
	targetKcal: number;
	macroTargets: ISerializedMacroTargets;
	isMacroConflict: boolean;
}

export interface INotConfiguredProfile {
	isConfigured: false;
}

export type TSerializedProfileResponse =
	| ISerializedHealthProfile
	| INotConfiguredProfile;

const round2 = (value: number): number => +value.toFixed(2);

export const toIsoDay = (date: Date): string =>
	date.toISOString().slice(0, 10);

export class HealthProfileSerializer {
	static serialize(
		profile: Record<string, any>,
		currentWeightKg: number,
		now: Date = new Date()
	): ISerializedHealthProfile {
		const sex = profile.sex as EHealthSex;
		const age = calcAge(profile.birthDate, now);

		const bmr = calcBmr({
			sex,
			weightKg: currentWeightKg,
			heightCm: profile.heightCm,
			age,
		});
		const tdee = calcTdee(bmr, profile.activityLevel as EActivityLevel);
		const targetKcal = calcTargetKcal(tdee, profile.dailyDeficit, sex);

		const { proteinG, fatG, carbsG, isMacroConflict } = calcMacroTargets({
			targetKcal,
			proteinPerKg: profile.proteinPerKg,
			proteinBasis: profile.proteinBasis as EProteinBasis,
			currentWeightKg,
			targetWeightKg: profile.targetWeightKg,
			fatPercent: profile.fatPercent,
		});

		return {
			isConfigured: true,
			id: profile.id,
			sex,
			birthDate: toIsoDay(profile.birthDate),
			heightCm: profile.heightCm,
			activityLevel: profile.activityLevel as EActivityLevel,
			startWeightKg: profile.startWeightKg,
			targetWeightKg: profile.targetWeightKg,
			startedAt: toIsoDay(profile.startedAt),
			dailyDeficit: profile.dailyDeficit,
			proteinPerKg: profile.proteinPerKg,
			proteinBasis: profile.proteinBasis as EProteinBasis,
			fatPercent: profile.fatPercent,
			age,
			currentWeightKg,
			lostKg: round2(profile.startWeightKg - currentWeightKg),
			remainingKg: round2(currentWeightKg - profile.targetWeightKg),
			progress: calcProgress(
				profile.startWeightKg,
				currentWeightKg,
				profile.targetWeightKg
			),
			bmr,
			tdee,
			targetKcal,
			macroTargets: { proteinG, fatG, carbsG },
			isMacroConflict,
		};
	}
}
