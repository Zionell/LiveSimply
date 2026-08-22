export const getMonthRange = (
	year: number,
	month: number
): { gte: Date; lt: Date } => {
	return {
		gte: new Date(Date.UTC(year, month - 1, 1)),
		lt: new Date(Date.UTC(year, month, 1)),
	};
};
