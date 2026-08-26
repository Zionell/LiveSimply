import { ConflictException, NotFoundException } from "@nestjs/common";
import { HealthProfileService } from "./health-profile.service";

const buildPrismaMock = () => ({
	healthProfile: {
		findUnique: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
	},
	healthBodyEntry: {
		findFirst: jest.fn().mockResolvedValue(null),
	},
});

const profileRecord = (overrides: Record<string, unknown> = {}) => ({
	id: "p1",
	userId: "u1",
	sex: "male",
	birthDate: new Date("1996-08-26T00:00:00.000Z"),
	heightCm: 160,
	activityLevel: "light",
	startWeightKg: 75,
	targetWeightKg: 66,
	startedAt: new Date("2026-08-26T00:00:00.000Z"),
	dailyDeficit: 500,
	proteinPerKg: 1.8,
	proteinBasis: "current",
	fatPercent: 0.3,
	...overrides,
});

const req = { payload: { id: "u1" } };

describe("HealthProfileService", () => {
	let prisma: ReturnType<typeof buildPrismaMock>;
	let service: HealthProfileService;

	beforeEach(() => {
		prisma = buildPrismaMock();
		service = new HealthProfileService(prisma as any);
	});

	describe("get", () => {
		it("reports an unconfigured profile instead of inventing defaults", async () => {
			prisma.healthProfile.findUnique.mockResolvedValue(null);

			await expect(service.get(req)).resolves.toEqual({
				isConfigured: false,
			});
		});

		it("computes the norm from the latest weighed day", async () => {
			prisma.healthProfile.findUnique.mockResolvedValue(profileRecord());
			prisma.healthBodyEntry.findFirst.mockResolvedValue({
				weightKg: 70,
			});

			const result: any = await service.get(req);

			expect(result.currentWeightKg).toBe(70);
		});

		it("falls back to the start weight while nothing has been weighed", async () => {
			prisma.healthProfile.findUnique.mockResolvedValue(profileRecord());

			const result: any = await service.get(req);

			expect(result.currentWeightKg).toBe(75);
		});
	});

	describe("create", () => {
		it("stores the dates as Date objects and stamps the user", async () => {
			prisma.healthProfile.findUnique.mockResolvedValue(null);
			prisma.healthProfile.create.mockResolvedValue(profileRecord());

			await service.create(
				{
					sex: "male",
					birthDate: "1996-08-26",
					heightCm: 160,
					activityLevel: "light",
					startWeightKg: 75,
					targetWeightKg: 66,
					startedAt: "2026-08-26",
				} as any,
				req
			);

			expect(prisma.healthProfile.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					userId: "u1",
					birthDate: new Date("1996-08-26T00:00:00.000Z"),
					startedAt: new Date("2026-08-26T00:00:00.000Z"),
				}),
			});
		});

		it("refuses to create a second profile for the same user", async () => {
			prisma.healthProfile.findUnique.mockResolvedValue(profileRecord());

			await expect(service.create({} as any, req)).rejects.toBeInstanceOf(
				ConflictException
			);
		});
	});

	describe("update", () => {
		it("throws when there is no profile to update", async () => {
			prisma.healthProfile.findUnique.mockResolvedValue(null);

			await expect(
				service.update({ heightCm: 170 } as any, req)
			).rejects.toBeInstanceOf(NotFoundException);
		});

		it("leaves untouched fields out of the update payload", async () => {
			prisma.healthProfile.findUnique.mockResolvedValue(profileRecord());
			prisma.healthProfile.update.mockResolvedValue(
				profileRecord({ heightCm: 170 })
			);

			await service.update({ heightCm: 170 } as any, req);

			expect(prisma.healthProfile.update).toHaveBeenCalledWith({
				where: { userId: "u1" },
				data: { heightCm: 170 },
			});
		});
	});
});
