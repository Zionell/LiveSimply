import { Injectable } from "@nestjs/common";

export interface IProps {
	operationCategoryId: string;
	_sum: {
		convertedPrice: number;
	};
}

export interface ISerializedResult {
	income: number;
	expense: number;
}

@Injectable()
export class FinanceSerializer {
	static serialize(props: IProps[]): ISerializedResult {
		return this.formatItems(props);
	}

	private static formatItems(items: IProps[]): ISerializedResult {
		const values = {
			income: 0,
			expense: 0,
		};
		items.forEach(item => {
			values[item.operationCategoryId] = item._sum.convertedPrice || 0;
		});

		return values;
	}
}
