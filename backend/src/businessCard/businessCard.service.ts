import { Injectable } from "@nestjs/common";
import {
	CreateBusinessCardDto,
	CreateBusinessCardLinkDto,
} from "./dto/create-business-card.dto";
import {
	UpdateBusinessCardDto,
	UpdateBusinessCardLinkDto,
} from "./dto/update-business-card.dto";
import { PrismaService } from "../prisma.service";

@Injectable()
export class BusinessCardService {
	constructor(private readonly prismaService: PrismaService) {}

	async create(
		createFinanceDto: CreateBusinessCardDto,
		req: Record<string, any>
	): Promise<void> {
		try {
			const userId: string = req.payload.id;

			await this.prismaService.businessCard.upsert({
				where: {
					userId,
				},
				update: {
					...createFinanceDto,
				},
				create: {
					...createFinanceDto,
					userId,
				},
			});
		} catch (e) {
			console.warn("[BusinessCardService / create]: ", e);
			throw new Error(e);
		}
	}

	async createLink(dto: CreateBusinessCardLinkDto) {
		try {
			return await this.prismaService.businessCardLink.create({
				data: {
					...dto,
				},
			});
		} catch (e) {
			console.warn("[BusinessCardService / createLink]: ", e);
			throw new Error(e);
		}
	}

	async findOne(req: Record<string, any>) {
		try {
			const userId: string = req.payload.id;

			return this.prismaService.businessCard.findUnique({
				where: { userId },
				include: {
					socialLinks: {
						orderBy: {
							createdAt: "asc",
						},
					},
				},
			});
		} catch (e) {
			console.warn("[BusinessCardService / findOne]: ", e);
			throw new Error(e);
		}
	}

	async findOneById(id: string) {
		try {
			return this.prismaService.businessCard.findUnique({
				where: { id },
				include: {
					socialLinks: {
						orderBy: {
							createdAt: "asc",
						},
					},
					user: {
						select: {
							name: true,
							email: true,
							phone: true,
							image: true,
						},
					},
				},
			});
		} catch (e) {
			console.warn("[BusinessCardService / findOneById]: ", e);
			throw new Error(e);
		}
	}

	async update(id: string, dto: UpdateBusinessCardDto) {
		try {
			return this.prismaService.businessCard.update({
				where: { id },
				data: {
					...dto,
				},
			});
		} catch (e) {
			console.warn("[BusinessCardService / update]: ", e);
			throw new Error(e);
		}
	}

	async updateLink(id: string, dto: UpdateBusinessCardLinkDto) {
		try {
			return this.prismaService.businessCardLink.update({
				where: { id },
				data: {
					...dto,
				},
			});
		} catch (e) {
			console.warn("[BusinessCardService / updateLink]: ", e);
			throw new Error(e);
		}
	}

	async remove(id: string) {
		try {
			await this.prismaService.businessCard.delete({
				where: { id },
			});
		} catch (e) {
			console.warn("[BusinessCardService / remove]: ", e);
			throw new Error(e);
		}
	}

	async removeLink(id: string) {
		try {
			await this.prismaService.businessCardLink.delete({
				where: { id },
			});
		} catch (e) {
			console.warn("[BusinessCardService / removeLink]: ", e);
			throw new Error(e);
		}
	}
}
