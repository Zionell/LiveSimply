import { Injectable } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import { normalizeLanguage } from "../../utils/language";
import { PrismaService } from "../prisma.service";
import { FindProductsDto } from "./dto/find-products.dto";
import {
	HealthProductSerializer,
	ISerializedProduct,
} from "./serializer/health-product.serializer";

@Injectable()
export class HealthProductsService {
	constructor(private readonly prismaService: PrismaService) {}

	async list(dto: FindProductsDto): Promise<ISerializedProduct[]> {
		const lang = normalizeLanguage(I18nContext.current()?.lang);

		const where: Record<string, unknown> = {};

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
}
