import { BadRequestException, NotFoundException } from "@nestjs/common";
import { HealthBodyService } from "./health-body.service";

const buildPrismaMock = () => ({
	healthBodyEntry: {
		findMany: jest.fn().mockResolvedValue([]),
		findUnique: jest.fn(),
		upsert: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
	},
});

const profileServiceMock = {
	loadProfile: jest.fn(),
};

const req = { payload: { id: "u1" } };

describe("HealthBodyService", () => {
	let prisma: ReturnType<typeof buildPrismaMock>;
	let service: HealthBodyService;

	beforeEach(() => {
		prisma = buildPrismaMock();
		profileServiceMock.loadProfile
			.mockReset()
			.mockResolvedValue({ targetWeightKg: 66 });
		service = new HealthBodyService(prisma as any, profileServiceMock as any);
	});

	describe("list", () => {
		it("defaults to the last 90 days when no range is given", async () => {
			jest.useFakeTimers().setSystemTime(
				new Date("2026-08-26T10:00:00.000Z")
			);

			await service.list({}, req);

			expect(prisma.healthBodyEntry.findMany).toHaveBeenCalledWith({
				where: {
					userId: "u1",
					date: {
						gte: new Date("2026-05-28T00:00:00.000Z"),
						lte: new Date("2026-08-26T00:00:00.000Z"),
					},
				},
				orderBy: { date: "asc" },
			});

			jest.useRealTimers();
		});

		it("charts against a zero target when the profile is not configured yet", async () => {
			profileServiceMock.loadProfile.mockResolvedValue(null);
			prisma.healthBodyEntry.findMany.mockResolvedValue([
				{
					id: "e1",
					date: new Date("2026-08-24T00:00:00.000Z"),
					weightKg: 74,
					chestCm: null,
					waistCm: null,
					armCm: null,
					note: null,
				},
			]);

			const result = await service.list({}, req);

			expect(result.weightChart[0].target).toBe(0);
		});
	});

	describe("upsert", () => {
		it("rejects a day with neither weight nor measurements", async () => {
			await expect(
				service.upsert({ date: "2026-08-26" } as any, req)
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it("upserts on (userId, date) so re-saving a day does not duplicate it", async () => {
			jest.useFakeTimers().setSystemTime(
				new Date("2026-08-26T10:00:00.000Z")
			);
			prisma.healthBodyEntry.upsert.mockResolvedValue({});

			await service.upsert(
				{ date: "2026-08-26", weightKg: 74.2 } as any,
				req
			);

			expect(prisma.healthBodyEntry.upsert).toHaveBeenCalledWith({
				where: {
					userId_date: {
						userId: "u1",
						date: new Date("2026-08-26T00:00:00.000Z"),
					},
				},
				create: {
					userId: "u1",
					date: new Date("2026-08-26T00:00:00.000Z"),
					weightKg: 74.2,
				},
				update: { weightKg: 74.2 },
			});

			jest.useRealTimers();
		});

		it("rejects a future-dated entry", async () => {
			jest.useFakeTimers().setSystemTime(
				new Date("2026-08-26T10:00:00.000Z")
			);

			await expect(
				service.upsert(
					{ date: "2026-08-27", weightKg: 74 } as any,
					req
				)
			).rejects.toBeInstanceOf(BadRequestException);
			expect(prisma.healthBodyEntry.upsert).not.toHaveBeenCalled();

			jest.useRealTimers();
		});

		it("ignores a userId supplied in the dto and writes the authenticated user's id", async () => {
			jest.useFakeTimers().setSystemTime(
				new Date("2026-08-26T10:00:00.000Z")
			);
			prisma.healthBodyEntry.upsert.mockResolvedValue({});

			await service.upsert(
				{
					date: "2026-08-26",
					weightKg: 74,
					userId: "VICTIM",
				} as any,
				req
			);

			expect(prisma.healthBodyEntry.upsert).toHaveBeenCalledWith({
				where: {
					userId_date: {
						userId: "u1",
						date: new Date("2026-08-26T00:00:00.000Z"),
					},
				},
				create: {
					userId: "u1",
					date: new Date("2026-08-26T00:00:00.000Z"),
					weightKg: 74,
				},
				update: { weightKg: 74 },
			});

			jest.useRealTimers();
		});
	});

	describe("update", () => {
		it("refuses to touch an entry that belongs to somebody else", async () => {
			prisma.healthBodyEntry.findUnique.mockResolvedValue({
				id: "e1",
				userId: "u2",
			});

			await expect(
				service.update("e1", { weightKg: 70 } as any, req)
			).rejects.toBeInstanceOf(NotFoundException);
			expect(prisma.healthBodyEntry.update).not.toHaveBeenCalled();
		});

		it("ignores a userId supplied in the dto and never forwards it to prisma", async () => {
			prisma.healthBodyEntry.findUnique.mockResolvedValue({
				id: "e1",
				userId: "u1",
			});
			prisma.healthBodyEntry.update.mockResolvedValue({});

			await service.update(
				"e1",
				{ weightKg: 70, userId: "VICTIM" } as any,
				req
			);

			const call = prisma.healthBodyEntry.update.mock.calls[0][0];

			expect(call).toEqual({
				where: { id: "e1" },
				data: { weightKg: 70 },
			});
			expect(call.data.userId).toBeUndefined();
		});
	});

	describe("remove", () => {
		it("refuses to delete an entry that belongs to somebody else", async () => {
			prisma.healthBodyEntry.findUnique.mockResolvedValue({
				id: "e1",
				userId: "u2",
			});

			await expect(service.remove("e1", req)).rejects.toBeInstanceOf(
				NotFoundException
			);
			expect(prisma.healthBodyEntry.delete).not.toHaveBeenCalled();
		});
	});
});
