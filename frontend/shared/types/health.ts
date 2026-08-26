export enum EHealthSex {
	Male = "male",
	Female = "female",
}

export enum EActivityLevel {
	Sedentary = "sedentary",
	Light = "light",
	Moderate = "moderate",
	High = "high",
}

export enum EProteinBasis {
	Current = "current",
	Target = "target",
}

export interface IMacroTargets {
	proteinG: number;
	fatG: number;
	carbsG: number;
}

export interface IHealthProfile {
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
	macroTargets: IMacroTargets;
	isMacroConflict: boolean;
}

export interface INotConfiguredProfile {
	isConfigured: false;
}

export type THealthProfileResponse = IHealthProfile | INotConfiguredProfile;

export interface IBodyEntry {
	id: string;
	date: string;
	weightKg: number | null;
	chestCm: number | null;
	waistCm: number | null;
	armCm: number | null;
	note: string | null;
}

export interface IWeightPoint {
	date: string;
	weight: number;
	target: number;
}

export interface IMeasurementPoint {
	date: string;
	chest: number | null;
	waist: number | null;
	arm: number | null;
}

export interface IBodyLog {
	entries: IBodyEntry[];
	weightChart: IWeightPoint[];
	measurementChart: IMeasurementPoint[];
}
