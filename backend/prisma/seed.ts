import { PrismaClient } from "../generated/prisma/client";
import { EProductCategory } from "../types/health";
import { SUPPORTED_LANGUAGES } from "../utils/language";

const prisma = new PrismaClient();

/**
 * Стартовый справочник намеренно маленький и разнесён по профилю макронутриентов,
 * чтобы на нём проверялась вся арифметика: чистый белок, чистые углеводы, чистый
 * жир на верхней границе калорийности, смешанный продукт и дробные граммы.
 * Дополнен крупами, рыбой, овощем и фруктом — этого хватает, чтобы собрать
 * правдоподобный приём пищи при ручной проверке раздела.
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
	{
		value: "rice-white",
		category: EProductCategory.Grains,
		kcalPer100: 365,
		proteinPer100: 7.1,
		fatPer100: 0.7,
		carbsPer100: 80,
		label: { en: "White rice, dry", ru: "Рис белый, сухой" },
	},
	{
		value: "oats",
		category: EProductCategory.Grains,
		kcalPer100: 389,
		proteinPer100: 16.9,
		fatPer100: 6.9,
		carbsPer100: 66.3,
		label: { en: "Rolled oats", ru: "Овсяные хлопья" },
	},
	{
		value: "salmon",
		category: EProductCategory.Meat,
		kcalPer100: 208,
		proteinPer100: 20.4,
		fatPer100: 13.4,
		carbsPer100: 0,
		label: { en: "Salmon, raw", ru: "Лосось, сырой" },
	},
	{
		value: "broccoli",
		category: EProductCategory.Vegetables,
		kcalPer100: 34,
		proteinPer100: 2.8,
		fatPer100: 0.4,
		carbsPer100: 6.6,
		label: { en: "Broccoli", ru: "Брокколи" },
	},
	{
		value: "banana",
		category: EProductCategory.Fruits,
		kcalPer100: 89,
		proteinPer100: 1.1,
		fatPer100: 0.3,
		carbsPer100: 22.8,
		label: { en: "Banana", ru: "Банан" },
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
