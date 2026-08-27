import { PrismaClient } from "../generated/prisma/client";
import { EProductCategory } from "../types/health";
import { SUPPORTED_LANGUAGES } from "../utils/language";

const prisma = new PrismaClient();

/**
 * Стартовый справочник намеренно маленький и разнесён по профилю макронутриентов,
 * чтобы на нём проверялась вся арифметика: чистый белок, чистые углеводы, чистый
 * жир на верхней границе калорийности, смешанный продукт и дробные граммы.
 * Значения референсные — при наполнении справочника их стоит сверить.
 */
const PRODUCTS = [
	{
		value: "chicken-breast",
		category: EProductCategory.Meat,
		kcalPer100: 113,
		proteinPer100: 23.6,
		fatPer100: 1.9,
		carbsPer100: 0.4,
		label: { en: "Chicken breast", ru: "Куриная грудка" },
	},
	{
		value: "buckwheat",
		category: EProductCategory.Grains,
		kcalPer100: 308,
		proteinPer100: 12.6,
		fatPer100: 3.3,
		carbsPer100: 57.1,
		label: { en: "Buckwheat, dry", ru: "Гречка, сухая" },
	},
	{
		value: "olive-oil",
		category: EProductCategory.Fats,
		kcalPer100: 884,
		proteinPer100: 0,
		fatPer100: 100,
		carbsPer100: 0,
		label: { en: "Olive oil", ru: "Оливковое масло" },
	},
	{
		value: "egg",
		category: EProductCategory.Eggs,
		kcalPer100: 157,
		proteinPer100: 12.7,
		fatPer100: 11.5,
		carbsPer100: 0.7,
		label: { en: "Chicken egg", ru: "Яйцо куриное" },
	},
	{
		value: "cottage-cheese-5",
		category: EProductCategory.Dairy,
		kcalPer100: 121,
		proteinPer100: 17,
		fatPer100: 5,
		carbsPer100: 1.8,
		label: { en: "Cottage cheese 5%", ru: "Творог 5%" },
	},
];

async function main(): Promise<void> {
	for (const { label, ...product } of PRODUCTS) {
		const existing = await prisma.healthProduct.findUnique({
			where: { value: product.value },
		});

		if (existing) {
			await prisma.healthProduct.update({
				where: { value: product.value },
				data: product,
			});
			continue;
		}

		await prisma.healthProduct.create({
			data: {
				...product,
				label: {
					create: SUPPORTED_LANGUAGES.map(lang => ({
						lang,
						label: label[lang as keyof typeof label] ?? label.en,
					})),
				},
			},
		});
	}

	console.info(`Seeded ${PRODUCTS.length} health products`);
}

main()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
