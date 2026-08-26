import { toIsoDay } from "./health-profile.serializer";

export interface ISerializedBodyEntry {
	id: string;
	date: string;
	weightKg: number | null;
	chestCm: number | null;
	waistCm: number | null;
	armCm: number | null;
	note: string | null;
}

export interface ISerializedWeightPoint {
	date: string;
	weight: number;
	target: number;
}

export interface ISerializedMeasurementPoint {
	date: string;
	chest: number | null;
	waist: number | null;
	arm: number | null;
}

export interface ISerializedBodyLog {
	entries: ISerializedBodyEntry[];
	weightChart: ISerializedWeightPoint[];
	measurementChart: ISerializedMeasurementPoint[];
}

const hasMeasurement = (record: Record<string, any>): boolean =>
	record.chestCm !== null || record.waistCm !== null || record.armCm !== null;

export class HealthBodySerializer {
	/**
	 * На вход приходят записи по возрастанию даты: графики читаются слева
	 * направо, а таблица — сверху вниз от свежего, поэтому список переворачивается.
	 */
	static serialize(
		records: Record<string, any>[],
		targetWeightKg: number
	): ISerializedBodyLog {
		const entries: ISerializedBodyEntry[] = records.map((record) => ({
			id: record.id,
			date: toIsoDay(record.date),
			weightKg: record.weightKg ?? null,
			chestCm: record.chestCm ?? null,
			waistCm: record.waistCm ?? null,
			armCm: record.armCm ?? null,
			note: record.note ?? null,
		}));

		return {
			entries: [...entries].reverse(),
			weightChart: records
				.filter((record) => record.weightKg !== null)
				.map((record) => ({
					date: toIsoDay(record.date),
					weight: record.weightKg,
					target: targetWeightKg,
				})),
			measurementChart: records.filter(hasMeasurement).map((record) => ({
				date: toIsoDay(record.date),
				chest: record.chestCm ?? null,
				waist: record.waistCm ?? null,
				arm: record.armCm ?? null,
			})),
		};
	}
}
