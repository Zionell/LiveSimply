import { Injectable } from "@nestjs/common";
import { CreateGoalsDto } from "./dto/create-goals.dto";
import { UpdateGoalsDto } from "./dto/update-goals.dto";
import { PrismaService } from "~/prisma.service";

@Injectable()
export class GoalsService {
	constructor(private readonly prismaService: PrismaService) {}

	async create(
		createGoalDto: CreateGoalsDto,
		req: Record<string, any>
	): Promise<void> {
		try {
			const userId: string = req.payload.id;

			await this.prismaService.goal.create({
				data: {
					...createGoalDto,
					userId,
				},
			});
		} catch (e) {
			console.warn("[GoalsService / create]: ", e);
			throw new Error(e);
		}
	}

	async getSpecs(req: Record<string, any>) {
		try {
			const userId: string = req.payload.id;

			return this.prismaService.goal.findMany({
				where: {
					userId,
					isCompleted: false,
					untilAt: {
						gt: new Date(),
					},
				},
				select: {
					id: true,
					title: true,
				},
			});
		} catch (e) {
			console.warn("[GoalsService / findOne]: ", e);
			throw new Error(e);
		}
	}

	async findAll(req: Record<string, any>) {
		try {
			const userId: string = req.payload.id;

			return this.prismaService.goal.findMany({
				where: { userId },
			});
		} catch (e) {
			console.warn("[GoalsService / findOne]: ", e);
			throw new Error(e);
		}
	}

	async findOne(id: string) {
		try {
			return this.prismaService.goal.findUnique({
				where: { id },
			});
		} catch (e) {
			console.warn("[GoalsService / findOne]: ", e);
			throw new Error(e);
		}
	}

	async update(id: string, dto: UpdateGoalsDto) {
		try {
			return this.prismaService.goal.update({
				where: { id },
				data: {
					updatedAt: new Date(),
					...dto,
				},
			});
		} catch (e) {
			console.warn("[GoalsService / update]: ", e);
			throw new Error(e);
		}
	}

	async remove(id: string) {
		try {
			await this.prismaService.goal.delete({
				where: { id },
			});
		} catch (e) {
			console.warn("[GoalsService / remove]: ", e);
			throw new Error(e);
		}
	}
}
