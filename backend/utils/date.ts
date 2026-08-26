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

export const startOfUtcMonth = (year: number, month: number): Date => {
	return new Date(Date.UTC(year, month - 1, 1));
};

/**
 * Whole months still available to save in, the running one included. A deadline
 * inside the current month leaves exactly one.
 */
export const monthsUntil = (deadline: Date, from: Date = new Date()): number => {
	const months =
		(deadline.getUTCFullYear() - from.getUTCFullYear()) * 12 +
		(deadline.getUTCMonth() - from.getUTCMonth()) +
		1;

	return Math.max(months, 1);
};

export const addUtcDays = (date: Date, days: number): Date => {
	return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
};
