import { EProductCategory } from "../../../types/health";

export interface ISerializedProduct {
	id: string;
	value: string;
	title: string;
	kcalPer100: number;
	proteinPer100: number;
	fatPer100: number;
	carbsPer100: number;
	category: EProductCategory | null;
	isOwn: boolean;
}

export class HealthProductSerializer {
	static serialize(product: Record<string, any>): ISerializedProduct {
		return {
			id: product.id,
			value: product.value,
			title: product.label?.[0]?.label || product.value,
			kcalPer100: product.kcalPer100,
			proteinPer100: product.proteinPer100,
			fatPer100: product.fatPer100,
			carbsPer100: product.carbsPer100,
			category: (product.category as EProductCategory) ?? null,
			// userId наружу не отдаём — клиенту нужно лишь знать, свой продукт
			// или общий из сида, чтобы отметить его в списке.
			isOwn: Boolean(product.userId),
		};
	}
}
