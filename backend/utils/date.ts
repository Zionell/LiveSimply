export const getMonthRange = (
	year: number,
	month: number
): { gte: Date; lt: Date } => {
	return {
		gte: new Date(Date.UTC(year, month - 1, 1)),
		lt: new Date(Date.UTC(year, month, 1)),
	};
};

export const daysInMonth = (year: number, month: number): number => {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

export const startOfUtcDay = (date: Date = new Date()): Date => {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
	);
};
