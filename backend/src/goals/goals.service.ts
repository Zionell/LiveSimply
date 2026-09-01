import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateGoalsDto } from "./dto/create-goals.dto";
import { UpdateGoalsDto } from "./dto/update-goals.dto";
import { PrismaService } from "../prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ENotificationType } from "../notifications/types";
import { Goal } from "../../generated/prisma/client";
import { monthsUntil, startOfUtcMonth } from "../../utils/date";

export const GOAL_REMINDER_DAYS_BEFORE = 5;

@Injectable()
export class GoalsService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly notificationsService: NotificationsService
	) {}

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
			const goal = await this.prismaService.goal.findUnique({
				where: { id },
			});

			if (!goal) {
				throw new NotFoundException();
			}

			const data: Record<string, any> = {
				updatedAt: new Date(),
				...dto,
			};

			// Only money going in counts as a contribution; renaming the goal
			// - or taking a contribution back out - must not silence this
			// month's reminder.
			if (dto.amount !== undefined && dto.amount > goal.amount) {
				data.lastAmountAt = new Date();
			}

			return await this.prismaService.goal.update({
				where: { id },
				data,
			});
		} catch (e) {
			if (e instanceof NotFoundException) {
				throw e;
			}

			console.warn("[GoalsService / update]: ", e);
			throw new Error(e);
		}
	}

	/**
	 * What the goal still asks for this month: whatever is left, spread over
	 * the months up to the deadline. It shrinks as the deadline nears, so the
	 * reminder keeps pointing at a number that still reaches the target.
	 */
	private monthlyContribution(goal: Goal, now: Date): number {
		const remaining = Math.max(goal.total - goal.amount, 0);

		return (
			Math.round((remaining / monthsUntil(goal.untilAt, now)) * 100) / 100
		);
	}

	/**
	 * Nudges people whose goal has seen no money at all this month, a few days
	 * before the month runs out. A goal created this month counts as funded:
	 * its opening amount is this month's contribution.
	 */
	async remindToContribute(year: number, month: number): Promise<number> {
		try {
			const now = new Date();
			const monthStart = startOfUtcMonth(year, month);

			const goals = await this.prismaService.goal.findMany({
				where: {
					isCompleted: false,
					untilAt: { gt: now },
				},
			});

			const pending = goals.filter(
				(goal: Goal) =>
					goal.amount < goal.total &&
					(goal.lastAmountAt || goal.createdAt) < monthStart
			);

			if (!pending.length) {
				return 0;
			}

			const alreadySent = await this.prismaService.notification.findMany({
				where: {
					userId: {
						in: [
							...new Set(
								pending.map((goal: Goal) => goal.userId)
							),
						],
					},
					type: ENotificationType.GoalContributionReminder,
					createdAt: { gte: monthStart },
				},
				select: { params: true },
			});

			const notified = new Set<string>(
				alreadySent.map(
					(notification: { params: unknown }) =>
						(notification.params as Record<string, string>)?.goalId
				)
			);

			let sent = 0;

			for (const goal of pending) {
				if (notified.has(goal.id)) {
					continue;
				}

				await this.notificationsService.create({
					userId: goal.userId,
					type: ENotificationType.GoalContributionReminder,
					params: {
						goalId: goal.id,
						title: goal.title,
						amount: this.monthlyContribution(goal, now),
						currency: goal.exchangeId,
						days: GOAL_REMINDER_DAYS_BEFORE,
					},
				});

				sent += 1;
			}

			return sent;
		} catch (e) {
			console.warn("[GoalsService / remindToContribute]: ", e);
			return 0;
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
