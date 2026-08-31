import { I18nContext } from "nestjs-i18n";
import { HealthProductsService } from "./health-products.service";

const buildPrismaMock = () => ({
	healthProduct: {
		findMany: jest.fn().mockResolvedValue([]),
		findUnique: jest.fn().mockResolvedValue(null),
		create: jest.fn(),
	},
});

const req = { payload: { id: "u1" } };

// Сид лежит в базе без поля userId вовсе, поэтому одной ветки с `null`
// мало — нужна ещё isSet: false, иначе справочник приходит пустым.
const scopeFor = (userId: string) => [
	{ userId },
	{ userId: null },
	{ userId: { isSet: false } },
];

const ownScope = scopeFor("u1");

describe("HealthProductsService", () => {
	let prisma: ReturnType<typeof buildPrismaMock>;
	let service: HealthProductsService;

	beforeEach(() => {
		prisma = buildPrismaMock();
		service = new HealthProductsService(prisma as any);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("list", () => {
		it("returns every product when no filter is given, ordered by value, labelled in the default language", async () => {
			await service.list({}, req);

			expect(prisma.healthProduct.findMany).toHaveBeenCalledWith({
				where: { OR: ownScope },
				orderBy: { value: "asc" },
				include: { label: { where: { lang: "en" } } },
			});
		});

		// Личные продукты одного пользователя не должны утекать другому:
		// весь каталог — это общий сид (userId: null) плюс собственные записи.
		it("scopes the catalogue to shared products and the caller's own", async () => {
			await service.list({}, { payload: { id: "u2" } });

			expect(prisma.healthProduct.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { OR: scopeFor("u2") },
				})
			);
		});

		it("resolves the label in the current i18n language rather than a fixed one", async () => {
			jest.spyOn(I18nContext, "current").mockReturnValue({
				lang: "ru",
			} as any);

			await service.list({}, req);

			expect(prisma.healthProduct.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					include: { label: { where: { lang: "ru" } } },
				})
			);
		});

		it("falls back to the default language instead of forwarding an unsupported cookie value verbatim", async () => {
			// CookieResolver hands back i18n_redirected verbatim, unvalidated.
			// An unsupported value must not reach the Prisma query as-is, or
			// the label lookup silently returns [] for every product.
			jest.spyOn(I18nContext, "current").mockReturnValue({
				lang: "fr-CA",
			} as any);

			await service.list({}, req);

			expect(prisma.healthProduct.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					include: { label: { where: { lang: "en" } } },
				})
			);
		});

		it("filters by category on top of the ownership scope", async () => {
			await service.list({ category: "meat" as any }, req);

			expect(prisma.healthProduct.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { OR: ownScope, category: "meat" },
				})
			);
		});

		it("searches the localized label, not the slug", async () => {
			await service.list({ search: "гречка" }, req);

			expect(prisma.healthProduct.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						OR: ownScope,
						label: {
							some: {
								label: {
									contains: "гречка",
									mode: "insensitive",
								},
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

			const result = await service.list({}, req);

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
					isOwn: false,
				},
			]);
		});

		it("marks the caller's own products so the client can tell them apart", async () => {
			prisma.healthProduct.findMany.mockResolvedValue([
				{
					id: "pr2",
					value: "custom-kasha-ab12cd",
					kcalPer100: 360,
					proteinPer100: 2,
					fatPer100: 5,
					carbsPer100: 64,
					category: null,
					userId: "u1",
					label: [{ label: "Каша «Выручай»" }],
				},
			]);

			const [product] = await service.list({}, req);

			expect(product.isOwn).toBe(true);
		});
	});

	describe("create", () => {
		beforeEach(() => {
			prisma.healthProduct.create.mockImplementation(
				async ({ data }: any) => ({
					id: "pr9",
					...data,
					label: [{ label: data.label.create[0].label }],
				})
			);
		});

		it("stores the product against the caller, never against a body-supplied user", async () => {
			await service.create(
				{
					title: "Каша «Выручай»",
					kcalPer100: 360,
					proteinPer100: 2,
					fatPer100: 5,
					carbsPer100: 64,
					userId: "u2",
				} as any,
				req
			);

			expect(prisma.healthProduct.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ userId: "u1" }),
				})
			);
		});

		// Название вводится один раз, а справочник читается с фильтром по языку.
		// Без строки на каждый язык продукт пропадал бы из списка при переключении.
		it("writes the title for every supported language", async () => {
			await service.create(
				{
					title: "Каша «Выручай»",
					kcalPer100: 360,
					proteinPer100: 2,
					fatPer100: 5,
					carbsPer100: 64,
				},
				req
			);

			const { data } = prisma.healthProduct.create.mock.calls[0][0];

			expect(data.label.create).toEqual([
				{ lang: "en", label: "Каша «Выручай»" },
				{ lang: "ru", label: "Каша «Выручай»" },
			]);
		});

		it("derives a slug from the title", async () => {
			await service.create(
				{
					title: "Oat porridge",
					kcalPer100: 360,
					proteinPer100: 2,
					fatPer100: 5,
					carbsPer100: 64,
				},
				req
			);

			const { data } = prisma.healthProduct.create.mock.calls[0][0];

			expect(data.value).toMatch(/^oat-porridge-[a-z0-9]{6}$/);
		});

		// Слаг строится из латиницы; кириллическое название схлопывается в пустую
		// строку, и без запасного корня value превращался бы в голый суффикс.
		it("falls back to a stable root when the title has no latin characters", async () => {
			await service.create(
				{
					title: "Каша",
					kcalPer100: 360,
					proteinPer100: 2,
					fatPer100: 5,
					carbsPer100: 64,
				},
				req
			);

			const { data } = prisma.healthProduct.create.mock.calls[0][0];

			expect(data.value).toMatch(/^product-[a-z0-9]{6}$/);
		});

		it("retries with a fresh slug when the generated one is already taken", async () => {
			prisma.healthProduct.create
				.mockRejectedValueOnce({ code: "P2002" })
				.mockResolvedValueOnce({
					id: "pr9",
					value: "oat-porridge-zzzzzz",
					kcalPer100: 360,
					proteinPer100: 2,
					fatPer100: 5,
					carbsPer100: 64,
					category: null,
					userId: "u1",
					label: [{ label: "Oat porridge" }],
				});

			const product = await service.create(
				{
					title: "Oat porridge",
					kcalPer100: 360,
					proteinPer100: 2,
					fatPer100: 5,
					carbsPer100: 64,
				},
				req
			);

			expect(prisma.healthProduct.create).toHaveBeenCalledTimes(2);
			expect(product.id).toBe("pr9");
		});

		it("returns the serialized product so the client can use it straight away", async () => {
			const product = await service.create(
				{
					title: "Oat porridge",
					category: "grains" as any,
					kcalPer100: 360,
					proteinPer100: 2,
					fatPer100: 5,
					carbsPer100: 64,
				},
				req
			);

			expect(product).toEqual(
				expect.objectContaining({
					id: "pr9",
					title: "Oat porridge",
					kcalPer100: 360,
					proteinPer100: 2,
					fatPer100: 5,
					carbsPer100: 64,
					category: "grains",
					isOwn: true,
				})
			);
		});
	});
});
