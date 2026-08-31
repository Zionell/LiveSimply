import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import { normalizeLanguage, SUPPORTED_LANGUAGES } from "../../utils/language";
import { PrismaService } from "../prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { FindProductsDto } from "./dto/find-products.dto";
import {
	HealthProductSerializer,
	ISerializedProduct,
} from "./serializer/health-product.serializer";

const SLUG_FALLBACK = "product";
const SLUG_ATTEMPTS = 5;

/**
 * Слаг строится из латиницы названия. Кириллица (и любой другой не-латинский
 * алфавит) схлопывается в пустую строку — тогда берётся запасной корень, а
 * различимость обеспечивает случайный суффикс.
 */
const slugify = (title: string): string => {
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);

	return slug || SLUG_FALLBACK;
};

const randomSuffix = (): string =>
	Math.random().toString(36).slice(2, 8).padEnd(6, "0");

@Injectable()
export class HealthProductsService {
	constructor(private readonly prismaService: PrismaService) {}

	async list(
		dto: FindProductsDto,
		req: Record<string, any>
	): Promise<ISerializedProduct[]> {
		const userId: string = req.payload.id;
		const lang = normalizeLanguage(I18nContext.current()?.lang);

		// Общий сид плюс личные продукты вызывающего; чужие личные продукты не
		// попадают в выдачу ни при каком фильтре.
		// isSet: false обязателен — у продуктов из сида поля userId в документе
		// физически нет, а для опционального @db.ObjectId фильтр `null` в
		// Prisma такие документы НЕ находит (проверено на базе: mongo `count`
		// по {userId: null} даёт 101, Prisma — 0). Ветка с `null` оставлена для
		// записей, где поле проставлено явно.
		const where: Record<string, unknown> = {
			OR: [{ userId }, { userId: null }, { userId: { isSet: false } }],
		};

		if (dto.category) {
			where.category = dto.category;
		}

		if (dto.search) {
			where.label = {
				some: {
					label: { contains: dto.search, mode: "insensitive" },
				},
			};
		}

		const products = await this.prismaService.healthProduct.findMany({
			where: where as any,
			orderBy: { value: "asc" },
			include: { label: { where: { lang } } },
		});

		return products.map(product =>
			HealthProductSerializer.serialize(product)
		);
	}

	/**
	 * Личный продукт пользователя. value остаётся глобально уникальным, поэтому
	 * коллизия слага — это P2002: ловим и пробуем другой суффикс, а не
	 * проверяем занятость заранее (проверка не спасает от гонки двух запросов).
	 */
	async create(
		dto: CreateProductDto,
		req: Record<string, any>
	): Promise<ISerializedProduct> {
		const userId: string = req.payload.id;
		const root = slugify(dto.title);

		for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
			try {
				const product = await this.prismaService.healthProduct.create({
					data: {
						value: `${root}-${randomSuffix()}`,
						userId,
						category: dto.category ?? null,
						kcalPer100: dto.kcalPer100,
						proteinPer100: dto.proteinPer100,
						fatPer100: dto.fatPer100,
						carbsPer100: dto.carbsPer100,
						label: {
							create: SUPPORTED_LANGUAGES.map(lang => ({
								lang,
								label: dto.title,
							})),
						},
					},
					include: { label: true },
				});

				return HealthProductSerializer.serialize(product);
			} catch (e) {
				if ((e as { code?: string })?.code !== "P2002") {
					throw e;
				}
			}
		}

		throw new InternalServerErrorException(
			"Could not allocate a unique product slug"
		);
	}
}
