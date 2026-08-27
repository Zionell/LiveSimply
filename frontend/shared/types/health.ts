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

export enum EMealType {
	Breakfast = "breakfast",
	Lunch = "lunch",
	Dinner = "dinner",
	Snack = "snack",
}

export enum EProductCategory {
	Grains = "grains",
	Meat = "meat",
	Dairy = "dairy",
	Eggs = "eggs",
	Vegetables = "vegetables",
	Fruits = "fruits",
	Fats = "fats",
	Other = "other",
}

export enum EDeviationStatus {
	Under = "under",
	OnTarget = "onTarget",
	Over = "over",
}

export enum EGranularity {
	Day = "day",
	Week = "week",
	Month = "month",
}

export interface IMacroSet {
	kcal: number;
	proteinG: number;
	fatG: number;
	carbsG: number;
}

export interface IProduct {
	id: string;
	value: string;
	title: string;
	kcalPer100: number;
	proteinPer100: number;
	fatPer100: number;
	carbsPer100: number;
	category: EProductCategory | null;
}

export interface IMealItem {
	id: string;
	title: string;
	grams: number;
	productId: string | null;
	kcal: number;
	proteinG: number;
	fatG: number;
	carbsG: number;
}

export interface IMeal {
	id: string;
	mealType: EMealType;
	kcal: number;
	proteinG: number;
	fatG: number;
	carbsG: number;
	items: IMealItem[];
}

export interface INutritionDay {
	id: string;
	date: string;
	fact: IMacroSet;
	target: IMacroSet;
	deviationKcal: number;
	status: EDeviationStatus;
	note: string | null;
	meals: IMeal[];
}

export interface INutritionTotals {
	daysLogged: number;
	onTargetDays: number;
	avgKcal: number;
	avgProteinG: number;
	avgFatG: number;
	avgCarbsG: number;
}

export interface INutritionPoint {
	date: string;
	kcal: number;
	target: number;
}

export interface INutritionLog {
	granularity: EGranularity;
	days: INutritionDay[];
	totals: INutritionTotals;
	chart: INutritionPoint[];
}
