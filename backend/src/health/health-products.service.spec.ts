import { HealthProductsService } from "./health-products.service";

const buildPrismaMock = () => ({
	healthProduct: {
		findMany: jest.fn().mockResolvedValue([]),
	},
});

describe("HealthProductsService", () => {
	let prisma: ReturnType<typeof buildPrismaMock>;
	let service: HealthProductsService;

	beforeEach(() => {
		prisma = buildPrismaMock();
		service = new HealthProductsService(prisma as any);
	});

	it("returns every product when no filter is given", async () => {
		await service.list({});

		expect(prisma.healthProduct.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: {} })
		);
	});

	it("filters by category when one is given", async () => {
		await service.list({ category: "meat" as any });

		expect(prisma.healthProduct.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { category: "meat" } })
		);
	});

	it("searches the localized label, not the slug", async () => {
		await service.list({ search: "гречка" });

		expect(prisma.healthProduct.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					label: {
						some: {
							label: { contains: "гречка", mode: "insensitive" },
						},
					},
				},
			})
		);
	});

	it("serializes what it found", async () => {
		prisma.healthProduct.findMany.mockResolvedValue([
			{
				id: "pr1",
				value: "buckwheat",
				kcalPer100: 308,
				proteinPer100: 12.6,
				fatPer100: 3.3,
				carbsPer100: 57.1,
				category: "grains",
				label: [{ label: "Гречка, сухая" }],
			},
		]);

		const result = await service.list({});

		expect(result).toEqual([
			{
				id: "pr1",
				value: "buckwheat",
				title: "Гречка, сухая",
				kcalPer100: 308,
				proteinPer100: 12.6,
				fatPer100: 3.3,
				carbsPer100: 57.1,
				category: "grains",
			},
		]);
	});
});
