import type { ISpec } from "@/types/index.ts";

export enum EOperationTypes {
	expense = "expense",
	income = "income",
	goals = "goals",
}

export interface FinanceTransaction {
	id: string;
	convertedPrice: number;
	curPrice: number;
	exchangeFrom: string;
	exchangeTo: string;
	operationCategory: string;
	expenseCategory: string | null;
	createdAt: Date;
}

export interface FinanceSpecs {
	exchange: ISpec[];
	expenseCategory: ISpec[];
	operationCategory: ISpec[];
	goals: ISpec[];
}
