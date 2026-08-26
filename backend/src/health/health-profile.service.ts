import {
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateHealthProfileDto } from "./dto/create-health-profile.dto";
import { UpdateHealthProfileDto } from "./dto/update-health-profile.dto";
import {
	HealthProfileSerializer,
	ISerializedHealthProfile,
	TSerializedProfileResponse,
} from "./serializer/health-profile.serializer";

type TProfileDto = CreateHealthProfileDto | UpdateHealthProfileDto;

@Injectable()
export class HealthProfileService {
	constructor(private readonly prismaService: PrismaService) {}

	/**
	 * Даты приходят строками вида "1996-08-26"; всё остальное копируется как
	 * есть, а незаполненные поля не попадают в payload, чтобы PATCH не затирал
	 * их дефолтами.
	 */
	private toData(dto: TProfileDto): Record<string, unknown> {
		const data: Record<string, unknown> = {};

		Object.entries(dto).forEach(([key, value]) => {
			if (value === undefined) {
				return;
			}

			data[key] =
				key === "birthDate" || key === "startedAt"
					? new Date(value as string)
					: value;
		});

		return data;
	}

	loadProfile(userId: string) {
		return this.prismaService.healthProfile.findUnique({
			where: { userId },
		});
	}

	/**
	 * Вес, от которого пляшет весь расчёт: последний день, когда пользователь
	 * реально встал на весы, и заявленный стартовый вес, пока таких дней нет.
	 */
	async currentWeight(
		userId: string,
		startWeightKg: number
	): Promise<number> {
		const last = await this.prismaService.healthBodyEntry.findFirst({
			where: { userId, weightKg: { not: null } },
			orderBy: { date: "desc" },
		});

		return last?.weightKg ?? startWeightKg;
	}

	async get(req: Record<string, any>): Promise<TSerializedProfileResponse> {
		const userId: string = req.payload.id;
		const profile = await this.loadProfile(userId);

		if (!profile) {
			return { isConfigured: false };
		}

		return HealthProfileSerializer.serialize(
			profile,
			await this.currentWeight(userId, profile.startWeightKg)
		);
	}

	async create(
		dto: CreateHealthProfileDto,
		req: Record<string, any>
	): Promise<ISerializedHealthProfile> {
		const userId: string = req.payload.id;

		if (await this.loadProfile(userId)) {
			throw new ConflictException("Health profile already exists");
		}

		const created = await this.prismaService.healthProfile.create({
			data: { ...this.toData(dto), userId } as any,
		});

		return HealthProfileSerializer.serialize(created, created.startWeightKg);
	}

	async update(
		dto: UpdateHealthProfileDto,
		req: Record<string, any>
	): Promise<ISerializedHealthProfile> {
		const userId: string = req.payload.id;

		if (!(await this.loadProfile(userId))) {
			throw new NotFoundException("Health profile is not configured");
		}

		const updated = await this.prismaService.healthProfile.update({
			where: { userId },
			data: this.toData(dto) as any,
		});

		return HealthProfileSerializer.serialize(
			updated,
			await this.currentWeight(userId, updated.startWeightKg)
		);
	}
}
