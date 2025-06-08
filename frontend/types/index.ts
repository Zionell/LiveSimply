export enum UiColors {
	primary = "primary",
	success = "success",
	error = "error",
	warning = "warning",
}

export interface IPagination {
	limit: number;
	offset: number;
	sort?: "desc" | "asc";
}

export interface IPaginatedResponse<T> {
	count: number;
	hasNext: boolean;
	result: T[];
}

export interface ISpec {
	label: string;
	value: string;
}
