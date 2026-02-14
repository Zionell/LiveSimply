export function daysInMonth(month: number, year: number): number {
	return new Date(year, month, 0).getDate();
}

export function daysArrayByCurMonth(): number[] {
	const labels: number[] = [];
	const date: Date = new Date();
	const year: number = date.getFullYear();
	const month: number = date.getMonth() + 1;
	const daysCount: number = daysInMonth(month, year);

	for (let i: number = 1; i <= daysCount; i++) {
		labels.push(i);
	}

	return labels;
}

export function checkExpiry(expiryDate: Date | string): boolean {
	const now = new Date();
	const expDate =
		expiryDate instanceof Date ? expiryDate : new Date(expiryDate);

	return expDate.getTime() < now.getTime();
}
