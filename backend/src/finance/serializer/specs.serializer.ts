import { Injectable } from "@nestjs/common";
import { ISpec } from "../../../types/common";
import {
	ExchangeItem,
	ExpenseCategory,
	OperationCategory,
} from "@prisma/client";

export interface ILabel {
	label: string;
}

export interface ICategory {
	label?: ILabel[];
	value: string;
	[key: string]: any;
}

export interface IGoal {
	id: string;
	title: string;
}

export interface ISerializedResult {
	exchange: ISpec[];
	expenseCategory: ISpec[];
	operationCategory: ISpec[];
	goals: ISpec[];
}

@Injectable()
export class SpecsSerializer {
	static serialize(
		exchange: ExchangeItem[],
		expenseCategory: ExpenseCategory[],
		operationCategory: OperationCategory[],
		goals: IGoal[]
	): ISerializedResult {
		return {
			exchange: this.formatCategories(exchange),
			expenseCategory: this.formatCategories(expenseCategory),
			operationCategory: this.formatCategories(operationCategory),
			goals: this.formatGoals(goals),
		};
	}

	private static formatCategories(categories: ICategory[]): ISpec[] {
		return categories.map(category => ({
			label: category.label?.[0]?.label || "Unknown",
			value: category.value,
		}));
	}

	private static formatGoals(items: IGoal[]): ISpec[] {
		return items.map(category => ({
			label: category.title || "Unknown",
			value: category.id,
		}));
	}
}
