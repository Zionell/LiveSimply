export function splitThousandsFloat(x: number): string {
	return x
		.toFixed(2)
		.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
		.replace(".00", "");
}

export function splitThousands(val: number): string | number {
	if (isNaN(val)) {
		return val;
	}

	val = Math.floor(Number(val));
	const prefix = val < 0 ? "-" : "";

	return (
		prefix +
		val
			.toString()
			.replace(/\D/g, "")
			.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
	);
}

export function countPercentage(amount: number, total: number): number {
	return Math.round((amount / total) * 100);
}
