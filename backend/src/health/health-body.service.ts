import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { addUtcDays, startOfUtcDay } from "../../utils/date";
import { HealthProfileService } from "./health-profile.service";
import { FindHealthRangeDto } from "./dto/find-health-range.dto";
import { UpsertBodyEntryDto } from "./dto/upsert-body-entry.dto";
import { UpdateBodyEntryDto } from "./dto/update-body-entry.dto";
import {
	HealthBodySerializer,
	ISerializedBodyLog,
} from "./serializer/health-body.serializer";

export const DEFAULT_RANGE_DAYS = 90;

const MEASURABLE_FIELDS = [
	"weightKg",
	"chestCm",
	"waistCm",
	"armCm",
] as const;

@Injectable()
export class HealthBodyService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly healthProfileService: HealthProfileService
	) {}

	private async loadOwned(id: string, userId: string) {
		const entry = await this.prismaService.healthBodyEntry.findUnique({
			where: { id },
		});

		if (!entry || entry.userId !== userId) {
			throw new NotFoundException("Body entry not found");
		}

		return entry;
	}

	async list(
		dto: FindHealthRangeDto,
		req: Record<string, any>
	): Promise<ISerializedBodyLog> {
		const userId: string = req.payload.id;

		const to = dto.to ? startOfUtcDay(new Date(dto.to)) : startOfUtcDay();
		const from = dto.from
			? startOfUtcDay(new Date(dto.from))
			: addUtcDays(to, -DEFAULT_RANGE_DAYS);

		const [records, profile] = await Promise.all([
			this.prismaService.healthBodyEntry.findMany({
				where: { userId, date: { gte: from, lte: to } },
				orderBy: { date: "asc" },
			}),
			this.healthProfileService.loadProfile(userId),
		]);

		return HealthBodySerializer.serialize(
			records,
			profile?.targetWeightKg ?? 0
		);
	}

	async upsert(dto: UpsertBodyEntryDto, req: Record<string, any>) {
		const userId: string = req.payload.id;
		const { date, ...values } = dto;

		const hasValue = MEASURABLE_FIELDS.some(
			(field) => values[field] !== undefined
		);

		if (!hasValue) {
			throw new BadRequestException(
				"Provide a weight or at least one measurement"
			);
		}

		const day = startOfUtcDay(new Date(date));

		return this.prismaService.healthBodyEntry.upsert({
			where: { userId_date: { userId, date: day } },
			create: { userId, date: day, ...values } as any,
			update: values as any,
		});
	}

	async update(
		id: string,
		dto: UpdateBodyEntryDto,
		req: Record<string, any>
	) {
		await this.loadOwned(id, req.payload.id);

		return this.prismaService.healthBodyEntry.update({
			where: { id },
			data: dto as any,
		});
	}

	async remove(id: string, req: Record<string, any>): Promise<void> {
		await this.loadOwned(id, req.payload.id);

		await this.prismaService.healthBodyEntry.delete({ where: { id } });
	}
}
