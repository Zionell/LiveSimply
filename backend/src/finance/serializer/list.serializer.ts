import { Injectable } from "@nestjs/common";
import { FinanceItem } from "../../../generated/prisma/client";

interface IExpenseItem {
	id: string;
	label: string;
	lang: string;
	categoryId: string;
}

interface ICommonLabel<T> {
	label: T[];
}

export interface IFullFinanceItem extends FinanceItem {
	expenseCategory?: ICommonLabel<IExpenseItem>;
	operationCategory?: ICommonLabel<IExpenseItem>;
}

export interface ISerializedItem {
	id: string;
	convertedPrice: number;
	curPrice: number;
	exchangeFrom: string;
	exchangeTo: string;
	operationCategory: string | null;
	expenseCategory: string | null;
	createdAt: Date;
}

@Injectable()
export class ListSerializer {
	static serialize(results: IFullFinanceItem[]): ISerializedItem[] {
		return this.formatItems(results);
	}

	private static formatItems(list: IFullFinanceItem[]): ISerializedItem[] {
		return list.map(item => ({
			id: item.id,
			convertedPrice: item.convertedPrice,
			curPrice: item.curPrice,
			exchangeFrom: item.currencyFromId || "EUR",
			exchangeTo: item.currencyToId || "EUR",
			operationCategory:
				item.operationCategory?.label?.[0]?.label || null,
			expenseCategory: item?.expenseCategory?.label?.[0]?.label || null,
			createdAt: item.createdAt,
		}));
	}
}
