import { Injectable } from "@nestjs/common";
import { ICategory } from "./specs.serializer";

export interface IProps {
	expenseCategoryId: string;
	_sum: {
		convertedPrice: number;
	};
}

export interface ISerializedResult {
	value: number;
	label: string;
	color: string;
}

@Injectable()
export class StatisticsSerializer {
	static serialize(
		props: IProps[],
		categories: ICategory[]
	): ISerializedResult[] {
		return this.formatItems(props, categories);
	}

	private static formatItems(
		items: IProps[],
		categories: ICategory[]
	): ISerializedResult[] {
		return items.map(item => {
			const curCategory = this.getCurCategory(
				item.expenseCategoryId,
				categories
			);

			return {
				value: item._sum.convertedPrice || 0,
				label: curCategory.label[0].label,
				color: curCategory.color,
			};
		});
	}

	private static getCurCategory(
		category: string,
		categories: ICategory[]
	): ICategory {
		return categories.find(c => c.value === category);
	}
}
