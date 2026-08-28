# Health: вкладка «КБЖУ» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Вторая вкладка раздела «Здоровье»: справочник продуктов, лог приёмов пищи с автоматическим расчётом КБЖУ, сравнение факт/цель по дням и графики с переключением день / неделя / месяц.

**Architecture:** Продолжение модуля `backend/src/health/`. Три уровня данных — день → приём → позиция, суммы денормализованы на родителях и пересчитываются сервисом при каждой записи. Вся арифметика в чистом калькуляторе и серализаторах, покрытых jest. Фронт — страница `/health/nutrition` рядом с уже готовой `/health/body`, типы вручную зеркалят серализаторы.

**Tech Stack:** NestJS 11, Prisma 6 (MongoDB), class-validator, jest; Nuxt 4, Nuxt UI 4, nuxt-charts, Zod в модалках, @nuxtjs/i18n.

**Spec:** `docs/superpowers/specs/2026-08-26-health-module-design.md`

**Предшествующий план:** `docs/superpowers/plans/2026-08-26-health-profile-and-body.md` — выполнен, вкладка «Вес и параметры тела» и профиль здоровья работают. Этот план опирается на них и ничего в них не ломает.

## Global Constraints

- **База — MongoDB.** Миграций нет: `npx prisma db push`. **Пуш в базу выполняется только после ревью задачи** — правило владельца репозитория, база боевая.
- **Енумов в Prisma нет.** В схеме `String`, значения — TS-енумы в `backend/types/health.ts` и `frontend/shared/types/health.ts`.
- **FK новых моделей помечаем `@db.ObjectId`.**
- **Валидация — class-validator DTO** с `@ApiProperty`. Zod только во фронтовых модалках.
- **`userId` никогда не берётся из DTO.** Сервисы выбирают поля явно; контроллеры раздела несут `ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })`. Это закрытая на предыдущей ветке уязвимость — не регрессировать.
- **Вся арифметика и округления — в калькуляторе и серализаторах.** Фронт считает только предпросмотр в форме.
- **Округление каскадное и одинаковое на всех уровнях:** ккал до целых, граммы до 0.1. Итог дня — сумма уже округлённых приёмов, а приём — сумма уже округлённых позиций, чтобы видимые строки складывались в видимый итог.
- **Типы фронта пишутся руками** в `frontend/shared/types/health.ts` как зеркало `ISerialized*`, авто-импортируются.
- **Графики — только `nuxt-charts`.**
- **Правка данных — только через slide-over.** Инлайн-редактирование `UTable` не вводить.
- **Каждая новая строка интерфейса — в обе локали.**
- **Отступы — табы.** Кавычки двойные, точки с запятой обязательны.
- **Тесты только на бэке** (jest, `*.spec.ts`, `cd backend && npm test`). Во фронте нет ни тест-раннера, ни typecheck — единственный автоматический сигнал `npm run build`, и он не доказывает ни типовую корректность, ни что ключи i18n резолвятся.
- Приёмы пищи: фиксированный набор `breakfast` / `lunch` / `dinner` / `snack`. Несколько приёмов одного типа за день разрешены.
- Порог «около цели» — ±5% от цели по калориям.

---

### Task 1: Енумы и калькулятор питания

**Files:**
- Modify: `backend/types/health.ts`
- Create: `backend/src/health/nutrition.calculator.ts`
- Test: `backend/src/health/nutrition.calculator.spec.ts`

**Interfaces:**
- Consumes: ничего.
- Produces: `EMealType`, `EProductCategory`, `EDeviationStatus`, `EGranularity`; `calcItemMacros({ product, grams }): IMacroSet`, `sumMacros(parts: IMacroSet[]): IMacroSet`, `calcDeviationStatus(kcal: number, targetKcal: number): EDeviationStatus`; тип `IMacroSet = { kcal, proteinG, fatG, carbsG }`.

- [ ] **Step 1: Дописать енумы**

В конец `backend/types/health.ts`:

```ts
export enum EMealType {
	Breakfast = "breakfast",
	Lunch = "lunch",
	Dinner = "dinner",
	Snack = "snack",
}

export enum EProductCategory {
	Grains = "grains",
	Meat = "meat",
	Dairy = "dairy",
	Eggs = "eggs",
	Vegetables = "vegetables",
	Fruits = "fruits",
	Fats = "fats",
	Other = "other",
}

export enum EDeviationStatus {
	Under = "under",
	OnTarget = "onTarget",
	Over = "over",
}

export enum EGranularity {
	Day = "day",
	Week = "week",
	Month = "month",
}
```

- [ ] **Step 2: Написать падающий тест**

`backend/src/health/nutrition.calculator.spec.ts`:

```ts
import { EDeviationStatus } from "../../types/health";
import {
	calcDeviationStatus,
	calcItemMacros,
	sumMacros,
} from "./nutrition.calculator";

const chickenBreast = {
	kcalPer100: 113,
	proteinPer100: 23.6,
	fatPer100: 1.9,
	carbsPer100: 0.4,
};

const oliveOil = {
	kcalPer100: 884,
	proteinPer100: 0,
	fatPer100: 100,
	carbsPer100: 0,
};

describe("nutrition calculator", () => {
	describe("calcItemMacros", () => {
		it("scales the per-100g figures by the weight eaten", () => {
			expect(calcItemMacros({ product: chickenBreast, grams: 200 })).toEqual({
				kcal: 226,
				proteinG: 47.2,
				fatG: 3.8,
				carbsG: 0.8,
			});
		});

		it("rounds calories to whole numbers and grams to one decimal", () => {
			expect(calcItemMacros({ product: chickenBreast, grams: 65 })).toEqual({
				kcal: 73,
				proteinG: 15.3,
				fatG: 1.2,
				carbsG: 0.3,
			});
		});

		it("handles a product that is pure fat", () => {
			expect(calcItemMacros({ product: oliveOil, grams: 10 })).toEqual({
				kcal: 88,
				proteinG: 0,
				fatG: 10,
				carbsG: 0,
			});
		});

		it("returns zeroes for a zero weight rather than NaN", () => {
			expect(calcItemMacros({ product: chickenBreast, grams: 0 })).toEqual({
				kcal: 0,
				proteinG: 0,
				fatG: 0,
				carbsG: 0,
			});
		});
	});

	describe("sumMacros", () => {
		it("adds already-rounded parts so the total matches what the rows show", () => {
			expect(
				sumMacros([
					{ kcal: 226, proteinG: 47.2, fatG: 3.8, carbsG: 0.8 },
					{ kcal: 88, proteinG: 0, fatG: 10, carbsG: 0 },
				])
			).toEqual({ kcal: 314, proteinG: 47.2, fatG: 13.8, carbsG: 0.8 });
		});

		it("does not accumulate floating point noise across many parts", () => {
			const part = { kcal: 1, proteinG: 0.1, fatG: 0.1, carbsG: 0.1 };

			expect(sumMacros(Array(3).fill(part))).toEqual({
				kcal: 3,
				proteinG: 0.3,
				fatG: 0.3,
				carbsG: 0.3,
			});
		});

		it("returns zeroes for an empty list", () => {
			expect(sumMacros([])).toEqual({
				kcal: 0,
				proteinG: 0,
				fatG: 0,
				carbsG: 0,
			});
		});
	});

	describe("calcDeviationStatus", () => {
		it("calls a day within five percent of the target on target", () => {
			expect(calcDeviationStatus(1707, 1707)).toBe(EDeviationStatus.OnTarget);
			expect(calcDeviationStatus(1630, 1707)).toBe(EDeviationStatus.OnTarget);
			expect(calcDeviationStatus(1790, 1707)).toBe(EDeviationStatus.OnTarget);
		});

		it("calls a day more than five percent below the target under", () => {
			expect(calcDeviationStatus(1600, 1707)).toBe(EDeviationStatus.Under);
		});

		it("calls a day more than five percent above the target over", () => {
			expect(calcDeviationStatus(1800, 1707)).toBe(EDeviationStatus.Over);
		});

		it("treats an untouched day as under rather than on target", () => {
			expect(calcDeviationStatus(0, 1707)).toBe(EDeviationStatus.Under);
		});

		it("does not divide by a zero target", () => {
			expect(calcDeviationStatus(500, 0)).toBe(EDeviationStatus.Over);
			expect(calcDeviationStatus(0, 0)).toBe(EDeviationStatus.OnTarget);
		});
	});
});
```

Проверка ожиданий: 113·2 = 226; 23.6·2 = 47.2; 1.9·2 = 3.8; 0.4·2 = 0.8. При 65 г: 113·0.65 = 73.45 → 73; 23.6·0.65 = 15.34 → 15.3; 1.9·0.65 = 1.235 → 1.2; 0.4·0.65 = 0.26 → 0.3. Масло 10 г: 884·0.1 = 88.4 → 88. Границы порога: 1707·0.95 = 1621.65, 1707·1.05 = 1792.35.

- [ ] **Step 3: Убедиться, что тест падает**

Run: `cd backend && npm test -- src/health/nutrition.calculator.spec.ts`
Expected: FAIL — модуль `./nutrition.calculator` не найден.

- [ ] **Step 4: Реализовать калькулятор**

`backend/src/health/nutrition.calculator.ts`:

```ts
import { EDeviationStatus } from "../../types/health";

export interface IMacroSet {
	kcal: number;
	proteinG: number;
	fatG: number;
	carbsG: number;
}

export interface IProductMacros {
	kcalPer100: number;
	proteinPer100: number;
	fatPer100: number;
	carbsPer100: number;
}

export interface IItemInput {
	product: IProductMacros;
	grams: number;
}

/**
 * Доля цели, внутри которой день считается попавшим в норму. Порог живёт здесь,
 * а не в компонентах, чтобы таблица и график красили строки по одному правилу.
 */
export const ON_TARGET_TOLERANCE = 0.05;

const round1 = (value: number): number => +value.toFixed(1);

export const calcItemMacros = ({ product, grams }: IItemInput): IMacroSet => {
	const share = grams / 100;

	return {
		kcal: Math.round(product.kcalPer100 * share),
		proteinG: round1(product.proteinPer100 * share),
		fatG: round1(product.fatPer100 * share),
		carbsG: round1(product.carbsPer100 * share),
	};
};

/**
 * Складывает уже округлённые части. Порядок важен: суммировать сырые значения и
 * округлять в конце значило бы, что итог дня не сходится с суммой строк,
 * которые видит пользователь.
 */
export const sumMacros = (parts: IMacroSet[]): IMacroSet =>
	parts.reduce<IMacroSet>(
		(acc, part) => ({
			kcal: acc.kcal + part.kcal,
			proteinG: round1(acc.proteinG + part.proteinG),
			fatG: round1(acc.fatG + part.fatG),
			carbsG: round1(acc.carbsG + part.carbsG),
		}),
		{ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 }
	);

export const calcDeviationStatus = (
	kcal: number,
	targetKcal: number
): EDeviationStatus => {
	if (targetKcal <= 0) {
		return kcal > 0 ? EDeviationStatus.Over : EDeviationStatus.OnTarget;
	}

	const ratio = kcal / targetKcal;

	if (ratio < 1 - ON_TARGET_TOLERANCE) {
		return EDeviationStatus.Under;
	}

	if (ratio > 1 + ON_TARGET_TOLERANCE) {
		return EDeviationStatus.Over;
	}

	return EDeviationStatus.OnTarget;
};
```

- [ ] **Step 5: Прогнать тесты**

Run: `cd backend && npm test -- src/health/nutrition.calculator.spec.ts`
Expected: PASS, 12 тестов.

- [ ] **Step 6: Коммит**

```bash
git add backend/types/health.ts backend/src/health/nutrition.calculator.ts backend/src/health/nutrition.calculator.spec.ts
git commit -m "feat(health): add the nutrition calculator"
```

---

### Task 2: Модели Prisma для питания

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Consumes: ничего.
- Produces: `prismaService.healthProduct`, `healthProductName`, `healthNutritionEntry`, `healthMeal`, `healthMealItem`.

- [ ] **Step 1: Дописать обратные связи в `User`**

В `model User`, сразу после `healthBodyEntries HealthBodyEntry[]`:

```prisma
	healthNutritionEntries HealthNutritionEntry[]
```

- [ ] **Step 2: Добавить модели в конец `schema.prisma`**

```prisma
model HealthProduct {
	id    String @id @default(auto()) @map("_id") @db.ObjectId
	value String @unique

	kcalPer100    Float
	proteinPer100 Float
	fatPer100     Float
	carbsPer100   Float

	category String?

	label HealthProductName[]
	items HealthMealItem[]

	createdAt DateTime  @default(now())
	updatedAt DateTime? @default(now())
}

model HealthProductName {
	id        String @id @default(auto()) @map("_id") @db.ObjectId
	label     String
	lang      String
	productId String @db.ObjectId

	product HealthProduct @relation(fields: [productId], references: [id], onDelete: Cascade)

	createdAt DateTime  @default(now())
	updatedAt DateTime? @default(now())
}

model HealthNutritionEntry {
	id     String @id @default(auto()) @map("_id") @db.ObjectId
	userId String @db.ObjectId

	date DateTime

	kcal     Float @default(0)
	proteinG Float @default(0)
	fatG     Float @default(0)
	carbsG   Float @default(0)

	targetKcal     Float
	targetProteinG Float
	targetFatG     Float
	targetCarbsG   Float

	note String?

	meals HealthMeal[]
	user  User         @relation(fields: [userId], references: [id], onDelete: Cascade)

	createdAt DateTime  @default(now())
	updatedAt DateTime? @default(now())

	@@unique([userId, date])
}

model HealthMeal {
	id      String @id @default(auto()) @map("_id") @db.ObjectId
	entryId String @db.ObjectId

	mealType String

	kcal     Float @default(0)
	proteinG Float @default(0)
	fatG     Float @default(0)
	carbsG   Float @default(0)

	items HealthMealItem[]
	entry HealthNutritionEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)

	createdAt DateTime  @default(now())
	updatedAt DateTime? @default(now())
}

model HealthMealItem {
	id     String @id @default(auto()) @map("_id") @db.ObjectId
	mealId String @db.ObjectId

	grams     Float
	productId String? @db.ObjectId
	title     String

	kcal     Float
	proteinG Float
	fatG     Float
	carbsG   Float

	meal    HealthMeal     @relation(fields: [mealId], references: [id], onDelete: Cascade)
	product HealthProduct? @relation(fields: [productId], references: [id])

	createdAt DateTime  @default(now())
	updatedAt DateTime? @default(now())
}
```

- [ ] **Step 3: Проверить схему**

Run: `cd backend && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`. В списке предупреждений **не должно быть** ни одной из пяти новых моделей — если появились, на каком-то FK забыт `@db.ObjectId`.

- [ ] **Step 4: Сгенерировать клиент и собрать**

```bash
cd backend && npm run prisma-generate && npm run build
```

Expected: генерация и сборка без ошибок.

**НЕ ЗАПУСКАЙТЕ `npx prisma db push`.** База боевая, и её владелец применяет схему сам после ревью задачи. Отметьте в отчёте, что пуш пропущен намеренно.

- [ ] **Step 5: Коммит**

```bash
git add backend/prisma/schema.prisma backend/generated/prisma
git commit -m "feat(health): add product and nutrition log models"
```

Сгенерированный клиент в этом репозитории трекается — коммитьте его вместе со схемой, иначе ветка не соберётся у другого разработчика.

---

### Task 3: Сид продуктов и чтение справочника

**Files:**
- Create: `backend/prisma/seed.ts`
- Create: `backend/src/health/health-products.service.ts`
- Create: `backend/src/health/health-products.controller.ts`
- Create: `backend/src/health/dto/find-products.dto.ts`
- Create: `backend/src/health/serializer/health-product.serializer.ts`
- Test: `backend/src/health/serializer/health-product.serializer.spec.ts`
- Test: `backend/src/health/health-products.service.spec.ts`
- Modify: `backend/prisma.config.ts`
- Modify: `backend/src/health/health.module.ts`

**Interfaces:**
- Consumes: модели из Task 2.
- Produces: `ISerializedProduct`, `HealthProductSerializer.serialize(record, lang)`, `HealthProductsService.list(dto, req)`, маршрут `GET /api/v2/health/products`.

- [ ] **Step 1: Написать сид**

`backend/prisma/seed.ts`:

```ts
import { PrismaClient } from "../generated/prisma/client";
import { EProductCategory } from "../types/health";
import { SUPPORTED_LANGUAGES } from "../utils/language";

const prisma = new PrismaClient();

/**
 * Стартовый справочник намеренно маленький и разнесён по профилю макронутриентов,
 * чтобы на нём проверялась вся арифметика: чистый белок, чистые углеводы, чистый
 * жир на верхней границе калорийности, смешанный продукт и дробные граммы.
 * Значения референсные — при наполнении справочника их стоит сверить.
 */
const PRODUCTS = [
	{
		value: "chicken-breast",
		category: EProductCategory.Meat,
		kcalPer100: 113,
		proteinPer100: 23.6,
		fatPer100: 1.9,
		carbsPer100: 0.4,
		label: { en: "Chicken breast", ru: "Куриная грудка" },
	},
	{
		value: "buckwheat",
		category: EProductCategory.Grains,
		kcalPer100: 308,
		proteinPer100: 12.6,
		fatPer100: 3.3,
		carbsPer100: 57.1,
		label: { en: "Buckwheat, dry", ru: "Гречка, сухая" },
	},
	{
		value: "olive-oil",
		category: EProductCategory.Fats,
		kcalPer100: 884,
		proteinPer100: 0,
		fatPer100: 100,
		carbsPer100: 0,
		label: { en: "Olive oil", ru: "Оливковое масло" },
	},
	{
		value: "egg",
		category: EProductCategory.Eggs,
		kcalPer100: 157,
		proteinPer100: 12.7,
		fatPer100: 11.5,
		carbsPer100: 0.7,
		label: { en: "Chicken egg", ru: "Яйцо куриное" },
	},
	{
		value: "cottage-cheese-5",
		category: EProductCategory.Dairy,
		kcalPer100: 121,
		proteinPer100: 17,
		fatPer100: 5,
		carbsPer100: 1.8,
		label: { en: "Cottage cheese 5%", ru: "Творог 5%" },
	},
];

async function main(): Promise<void> {
	for (const { label, ...product } of PRODUCTS) {
		const existing = await prisma.healthProduct.findUnique({
			where: { value: product.value },
		});

		if (existing) {
			await prisma.healthProduct.update({
				where: { value: product.value },
				data: product,
			});
			continue;
		}

		await prisma.healthProduct.create({
			data: {
				...product,
				label: {
					create: SUPPORTED_LANGUAGES.map(lang => ({
						lang,
						label: label[lang as keyof typeof label] ?? label.en,
					})),
				},
			},
		});
	}

	console.info(`Seeded ${PRODUCTS.length} health products`);
}

main()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
```

Сид идемпотентен: повторный запуск обновляет КБЖУ существующего продукта и не плодит дубли имён.

- [ ] **Step 2: Подключить сид в конфиг**

В `backend/prisma.config.ts` в объект `migrations` добавить строку:

```ts
		seed: "ts-node prisma/seed.ts",
```

так что блок становится:

```ts
	migrations: {
		path: "prisma/migrations",
		seed: "ts-node prisma/seed.ts",
	},
```

- [ ] **Step 3: Написать падающий тест серализатора**

`backend/src/health/serializer/health-product.serializer.spec.ts`:

```ts
import { HealthProductSerializer } from "./health-product.serializer";

const record = (overrides: Record<string, unknown> = {}) => ({
	id: "pr1",
	value: "chicken-breast",
	kcalPer100: 113,
	proteinPer100: 23.6,
	fatPer100: 1.9,
	carbsPer100: 0.4,
	category: "meat",
	label: [{ label: "Куриная грудка" }],
	...overrides,
});

describe("HealthProductSerializer", () => {
	it("uses the label loaded for the requested language", () => {
		const result = HealthProductSerializer.serialize(record());

		expect(result.title).toBe("Куриная грудка");
	});

	it("falls back to the slug when no label exists for the language", () => {
		const result = HealthProductSerializer.serialize(record({ label: [] }));

		expect(result.title).toBe("chicken-breast");
	});

	it("passes the per-100g figures through untouched", () => {
		const result = HealthProductSerializer.serialize(record());

		expect(result).toMatchObject({
			id: "pr1",
			value: "chicken-breast",
			kcalPer100: 113,
			proteinPer100: 23.6,
			fatPer100: 1.9,
			carbsPer100: 0.4,
			category: "meat",
		});
	});

	it("reports a missing category as null rather than undefined", () => {
		const result = HealthProductSerializer.serialize(
			record({ category: null })
		);

		expect(result.category).toBeNull();
	});
});
```

- [ ] **Step 4: Убедиться, что тест падает, затем реализовать серализатор**

Run: `cd backend && npm test -- src/health/serializer/health-product.serializer.spec.ts`
Expected: FAIL — модуль не найден.

`backend/src/health/serializer/health-product.serializer.ts`:

```ts
import { EProductCategory } from "../../../types/health";

export interface ISerializedProduct {
	id: string;
	value: string;
	title: string;
	kcalPer100: number;
	proteinPer100: number;
	fatPer100: number;
	carbsPer100: number;
	category: EProductCategory | null;
}

export class HealthProductSerializer {
	static serialize(product: Record<string, any>): ISerializedProduct {
		return {
			id: product.id,
			value: product.value,
			title: product.label?.[0]?.label || product.value,
			kcalPer100: product.kcalPer100,
			proteinPer100: product.proteinPer100,
			fatPer100: product.fatPer100,
			carbsPer100: product.carbsPer100,
			category: (product.category as EProductCategory) ?? null,
		};
	}
}
```

Run снова: PASS, 4 теста.

- [ ] **Step 5: DTO поиска**

`backend/src/health/dto/find-products.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { EProductCategory } from "../../../types/health";

export class FindProductsDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	search?: string;

	@ApiProperty({ required: false, enum: EProductCategory })
	@IsOptional()
	@IsEnum(EProductCategory)
	category?: EProductCategory;
}
```

- [ ] **Step 6: Написать падающий тест сервиса**

`backend/src/health/health-products.service.spec.ts`:

```ts
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
```

- [ ] **Step 7: Реализовать сервис и контроллер**

`backend/src/health/health-products.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
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
		const lang = I18nContext.current()?.lang || "en";

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
```

`backend/src/health/health-products.controller.ts`:

```ts
import {
	Controller,
	Get,
	Query,
	UsePipes,
	ValidationPipe,
} from "@nestjs/common";
import { HealthProductsService } from "./health-products.service";
import { FindProductsDto } from "./dto/find-products.dto";

@Controller("health/products")
@UsePipes(
	new ValidationPipe({
		transform: true,
		whitelist: true,
		forbidNonWhitelisted: true,
	})
)
export class HealthProductsController {
	constructor(
		private readonly healthProductsService: HealthProductsService
	) {}

	@Get()
	list(@Query() dto: FindProductsDto) {
		return this.healthProductsService.list(dto);
	}
}
```

Справочник только на чтение: продукты приходят из сида, создание из интерфейса в этой версии не делаем.

- [ ] **Step 8: Зарегистрировать в модуле**

В `backend/src/health/health.module.ts` добавить `HealthProductsController` в `controllers` и `HealthProductsService` в `providers` и `exports`, не трогая уже зарегистрированные профиль и лог тела.

- [ ] **Step 9: Прогнать и закоммитить**

Run: `cd backend && npm test && npm run build`
Expected: вся сюита зелёная, сборка чистая.

```bash
git add backend/prisma/seed.ts backend/prisma.config.ts backend/src/health
git commit -m "feat(health): seed base products and expose the catalogue"
```

Сид против базы **не запускайте** — его выполнит владелец репозитория вместе с `db push`.

---

### Task 4: Серализатор лога питания

**Files:**
- Create: `backend/src/health/serializer/health-nutrition.serializer.ts`
- Test: `backend/src/health/serializer/health-nutrition.serializer.spec.ts`

**Interfaces:**
- Consumes: `calcDeviationStatus` из Task 1, `toIsoDay` из `serializer/health-profile.serializer.ts`.
- Produces: `ISerializedMealItem`, `ISerializedMeal`, `ISerializedNutritionDay`, `ISerializedNutritionTotals`, `HealthNutritionSerializer.serializeDay(entry)`, `HealthNutritionSerializer.serializeTotals(days)`.

- [ ] **Step 1: Написать падающий тест**

`backend/src/health/serializer/health-nutrition.serializer.spec.ts`:

```ts
import { EDeviationStatus } from "../../../types/health";
import { HealthNutritionSerializer } from "./health-nutrition.serializer";

const entry = (overrides: Record<string, unknown> = {}) => ({
	id: "n1",
	date: new Date("2026-08-26T00:00:00.000Z"),
	kcal: 1700,
	proteinG: 130,
	fatG: 56,
	carbsG: 160,
	targetKcal: 1707,
	targetProteinG: 135,
	targetFatG: 56.9,
	targetCarbsG: 163.7,
	note: null,
	meals: [],
	...overrides,
});

const meal = (overrides: Record<string, unknown> = {}) => ({
	id: "m1",
	mealType: "breakfast",
	kcal: 300,
	proteinG: 20,
	fatG: 10,
	carbsG: 30,
	items: [],
	...overrides,
});

describe("HealthNutritionSerializer", () => {
	describe("serializeDay", () => {
		it("splits fact and target into separate blocks", () => {
			const result = HealthNutritionSerializer.serializeDay(entry());

			expect(result.fact).toEqual({
				kcal: 1700,
				proteinG: 130,
				fatG: 56,
				carbsG: 160,
			});
			expect(result.target).toEqual({
				kcal: 1707,
				proteinG: 135,
				fatG: 56.9,
				carbsG: 163.7,
			});
		});

		it("reports the calorie deviation and its status", () => {
			const result = HealthNutritionSerializer.serializeDay(entry());

			expect(result.deviationKcal).toBe(-7);
			expect(result.status).toBe(EDeviationStatus.OnTarget);
		});

		it("marks a day well over the target", () => {
			const result = HealthNutritionSerializer.serializeDay(
				entry({ kcal: 2400 })
			);

			expect(result.deviationKcal).toBe(693);
			expect(result.status).toBe(EDeviationStatus.Over);
		});

		it("emits the date as a plain ISO day", () => {
			expect(HealthNutritionSerializer.serializeDay(entry()).date).toBe(
				"2026-08-26"
			);
		});

		it("carries meals through with their items", () => {
			const result = HealthNutritionSerializer.serializeDay(
				entry({
					meals: [
						meal({
							items: [
								{
									id: "i1",
									title: "Гречка, сухая",
									grams: 80,
									productId: "pr1",
									kcal: 246,
									proteinG: 10.1,
									fatG: 2.6,
									carbsG: 45.7,
								},
							],
						}),
					],
				})
			);

			expect(result.meals).toHaveLength(1);
			expect(result.meals[0].mealType).toBe("breakfast");
			expect(result.meals[0].items[0]).toEqual({
				id: "i1",
				title: "Гречка, сухая",
				grams: 80,
				productId: "pr1",
				kcal: 246,
				proteinG: 10.1,
				fatG: 2.6,
				carbsG: 45.7,
			});
		});

		it("reports a deleted product as a null productId while keeping the title", () => {
			const result = HealthNutritionSerializer.serializeDay(
				entry({
					meals: [
						meal({
							items: [
								{
									id: "i1",
									title: "Гречка, сухая",
									grams: 80,
									productId: null,
									kcal: 246,
									proteinG: 10.1,
									fatG: 2.6,
									carbsG: 45.7,
								},
							],
						}),
					],
				})
			);

			expect(result.meals[0].items[0].productId).toBeNull();
			expect(result.meals[0].items[0].title).toBe("Гречка, сухая");
		});
	});

	describe("serializeTotals", () => {
		it("averages only the days that were actually logged", () => {
			const days = [
				HealthNutritionSerializer.serializeDay(entry({ kcal: 1600 })),
				HealthNutritionSerializer.serializeDay(
					entry({ id: "n2", kcal: 1800 })
				),
				HealthNutritionSerializer.serializeDay(
					entry({ id: "n3", kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 })
				),
			];

			const totals = HealthNutritionSerializer.serializeTotals(days);

			expect(totals.daysLogged).toBe(2);
			expect(totals.avgKcal).toBe(1700);
		});

		it("counts how many logged days landed on target", () => {
			const days = [
				HealthNutritionSerializer.serializeDay(entry({ kcal: 1700 })),
				HealthNutritionSerializer.serializeDay(
					entry({ id: "n2", kcal: 2400 })
				),
			];

			expect(
				HealthNutritionSerializer.serializeTotals(days).onTargetDays
			).toBe(1);
		});

		it("returns zeroes rather than NaN when nothing was logged", () => {
			const totals = HealthNutritionSerializer.serializeTotals([]);

			expect(totals).toEqual({
				daysLogged: 0,
				onTargetDays: 0,
				avgKcal: 0,
				avgProteinG: 0,
				avgFatG: 0,
				avgCarbsG: 0,
			});
		});
	});
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd backend && npm test -- src/health/serializer/health-nutrition.serializer.spec.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать серализатор**

`backend/src/health/serializer/health-nutrition.serializer.ts`:

```ts
import { EDeviationStatus, EMealType } from "../../../types/health";
import { calcDeviationStatus, IMacroSet } from "../nutrition.calculator";
import { toIsoDay } from "./health-profile.serializer";

export interface ISerializedMealItem {
	id: string;
	title: string;
	grams: number;
	productId: string | null;
	kcal: number;
	proteinG: number;
	fatG: number;
	carbsG: number;
}

export interface ISerializedMeal {
	id: string;
	mealType: EMealType;
	kcal: number;
	proteinG: number;
	fatG: number;
	carbsG: number;
	items: ISerializedMealItem[];
}

export interface ISerializedNutritionDay {
	id: string;
	date: string;
	fact: IMacroSet;
	target: IMacroSet;
	deviationKcal: number;
	status: EDeviationStatus;
	note: string | null;
	meals: ISerializedMeal[];
}

export interface ISerializedNutritionTotals {
	daysLogged: number;
	onTargetDays: number;
	avgKcal: number;
	avgProteinG: number;
	avgFatG: number;
	avgCarbsG: number;
}

const round1 = (value: number): number => +value.toFixed(1);

export class HealthNutritionSerializer {
	private static serializeItem(
		item: Record<string, any>
	): ISerializedMealItem {
		return {
			id: item.id,
			title: item.title,
			grams: item.grams,
			productId: item.productId ?? null,
			kcal: item.kcal,
			proteinG: item.proteinG,
			fatG: item.fatG,
			carbsG: item.carbsG,
		};
	}

	private static serializeMeal(meal: Record<string, any>): ISerializedMeal {
		return {
			id: meal.id,
			mealType: meal.mealType as EMealType,
			kcal: meal.kcal,
			proteinG: meal.proteinG,
			fatG: meal.fatG,
			carbsG: meal.carbsG,
			items: (meal.items || []).map((item: Record<string, any>) =>
				this.serializeItem(item)
			),
		};
	}

	static serializeDay(
		entry: Record<string, any>
	): ISerializedNutritionDay {
		return {
			id: entry.id,
			date: toIsoDay(entry.date),
			fact: {
				kcal: entry.kcal,
				proteinG: entry.proteinG,
				fatG: entry.fatG,
				carbsG: entry.carbsG,
			},
			target: {
				kcal: entry.targetKcal,
				proteinG: entry.targetProteinG,
				fatG: entry.targetFatG,
				carbsG: entry.targetCarbsG,
			},
			deviationKcal: Math.round(entry.kcal - entry.targetKcal),
			status: calcDeviationStatus(entry.kcal, entry.targetKcal),
			note: entry.note ?? null,
			meals: (entry.meals || []).map((meal: Record<string, any>) =>
				this.serializeMeal(meal)
			),
		};
	}

	/**
	 * Средние считаются только по дням, в которые пользователь действительно
	 * что-то записал. Иначе один пропущенный день утянул бы среднее вниз и
	 * выглядел бы как голодание, а не как отсутствие записи.
	 */
	static serializeTotals(
		days: ISerializedNutritionDay[]
	): ISerializedNutritionTotals {
		const logged = days.filter(day => day.fact.kcal > 0);

		if (!logged.length) {
			return {
				daysLogged: 0,
				onTargetDays: 0,
				avgKcal: 0,
				avgProteinG: 0,
				avgFatG: 0,
				avgCarbsG: 0,
			};
		}

		const sum = logged.reduce(
			(acc, day) => ({
				kcal: acc.kcal + day.fact.kcal,
				proteinG: acc.proteinG + day.fact.proteinG,
				fatG: acc.fatG + day.fact.fatG,
				carbsG: acc.carbsG + day.fact.carbsG,
			}),
			{ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 }
		);

		return {
			daysLogged: logged.length,
			onTargetDays: logged.filter(
				day => day.status === EDeviationStatus.OnTarget
			).length,
			avgKcal: Math.round(sum.kcal / logged.length),
			avgProteinG: round1(sum.proteinG / logged.length),
			avgFatG: round1(sum.fatG / logged.length),
			avgCarbsG: round1(sum.carbsG / logged.length),
		};
	}
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `cd backend && npm test -- src/health/serializer/health-nutrition.serializer.spec.ts`
Expected: PASS, 9 тестов.

- [ ] **Step 5: Коммит**

```bash
git add backend/src/health/serializer/health-nutrition.serializer.ts backend/src/health/serializer/health-nutrition.serializer.spec.ts
git commit -m "feat(health): serialize nutrition days, meals and items"
```

---

### Task 5: Агрегация графика по гранулярности

**Files:**
- Create: `backend/src/health/nutrition-chart.ts`
- Test: `backend/src/health/nutrition-chart.spec.ts`

**Interfaces:**
- Consumes: `ISerializedNutritionDay` из Task 4, `addUtcDays` и `startOfUtcDay` из `backend/utils/date.ts`.
- Produces: `ISerializedNutritionPoint`, `bucketStart(date: Date, granularity: EGranularity): Date`, `aggregateNutritionPoints(days: ISerializedNutritionDay[], granularity: EGranularity): ISerializedNutritionPoint[]`.

- [ ] **Step 1: Написать падающий тест**

`backend/src/health/nutrition-chart.spec.ts`:

```ts
import { EGranularity } from "../../types/health";
import { aggregateNutritionPoints, bucketStart } from "./nutrition-chart";

const day = (date: string, kcal: number, target = 1700) =>
	({
		id: date,
		date,
		fact: { kcal, proteinG: 0, fatG: 0, carbsG: 0 },
		target: { kcal: target, proteinG: 0, fatG: 0, carbsG: 0 },
		deviationKcal: kcal - target,
		status: "onTarget",
		note: null,
		meals: [],
	}) as any;

describe("bucketStart", () => {
	it("keeps the day itself for day granularity", () => {
		expect(
			bucketStart(new Date("2026-08-26T00:00:00.000Z"), EGranularity.Day)
		).toEqual(new Date("2026-08-26T00:00:00.000Z"));
	});

	it("snaps to the Monday of the ISO week", () => {
		// 2026-08-26 is a Wednesday; its week starts Monday the 24th.
		expect(
			bucketStart(new Date("2026-08-26T00:00:00.000Z"), EGranularity.Week)
		).toEqual(new Date("2026-08-24T00:00:00.000Z"));
	});

	it("treats Sunday as the end of its week, not the start of the next", () => {
		// 2026-08-30 is a Sunday; it still belongs to the week of the 24th.
		expect(
			bucketStart(new Date("2026-08-30T00:00:00.000Z"), EGranularity.Week)
		).toEqual(new Date("2026-08-24T00:00:00.000Z"));
	});

	it("snaps to the first day of the calendar month", () => {
		expect(
			bucketStart(new Date("2026-08-26T00:00:00.000Z"), EGranularity.Month)
		).toEqual(new Date("2026-08-01T00:00:00.000Z"));
	});
});

describe("aggregateNutritionPoints", () => {
	it("returns one point per day at day granularity", () => {
		const result = aggregateNutritionPoints(
			[day("2026-08-24", 1600), day("2026-08-25", 1800)],
			EGranularity.Day
		);

		expect(result).toEqual([
			{ date: "2026-08-24", kcal: 1600, target: 1700 },
			{ date: "2026-08-25", kcal: 1800, target: 1700 },
		]);
	});

	it("averages a week rather than summing it, so it stays comparable to the daily target", () => {
		const result = aggregateNutritionPoints(
			[
				day("2026-08-24", 1600),
				day("2026-08-25", 1800),
				day("2026-08-26", 1700),
			],
			EGranularity.Week
		);

		expect(result).toEqual([
			{ date: "2026-08-24", kcal: 1700, target: 1700 },
		]);
	});

	it("splits days that fall into different weeks", () => {
		const result = aggregateNutritionPoints(
			[day("2026-08-30", 1600), day("2026-08-31", 1800)],
			EGranularity.Week
		);

		expect(result.map(point => point.date)).toEqual([
			"2026-08-24",
			"2026-08-31",
		]);
	});

	it("averages a calendar month", () => {
		const result = aggregateNutritionPoints(
			[day("2026-08-01", 1500), day("2026-08-20", 1900)],
			EGranularity.Month
		);

		expect(result).toEqual([
			{ date: "2026-08-01", kcal: 1700, target: 1700 },
		]);
	});

	it("skips days with nothing logged so a gap does not drag the average down", () => {
		const result = aggregateNutritionPoints(
			[
				day("2026-08-24", 1600),
				day("2026-08-25", 0),
				day("2026-08-26", 1800),
			],
			EGranularity.Week
		);

		expect(result).toEqual([
			{ date: "2026-08-24", kcal: 1700, target: 1700 },
		]);
	});

	it("returns an empty list when nothing was logged at all", () => {
		expect(
			aggregateNutritionPoints([day("2026-08-24", 0)], EGranularity.Day)
		).toEqual([]);
	});

	it("returns points in chronological order regardless of input order", () => {
		const result = aggregateNutritionPoints(
			[day("2026-08-26", 1700), day("2026-08-24", 1600)],
			EGranularity.Day
		);

		expect(result.map(point => point.date)).toEqual([
			"2026-08-24",
			"2026-08-26",
		]);
	});
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd backend && npm test -- src/health/nutrition-chart.spec.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать агрегацию**

`backend/src/health/nutrition-chart.ts`:

```ts
import { EGranularity } from "../../types/health";
import { addUtcDays } from "../../utils/date";
import { toIsoDay } from "./serializer/health-profile.serializer";
import { ISerializedNutritionDay } from "./serializer/health-nutrition.serializer";

export interface ISerializedNutritionPoint {
	date: string;
	kcal: number;
	target: number;
}

export const bucketStart = (
	date: Date,
	granularity: EGranularity
): Date => {
	if (granularity === EGranularity.Month) {
		return new Date(
			Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
		);
	}

	if (granularity === EGranularity.Week) {
		// getUTCDay() is 0 for Sunday; shifting by 6 makes Monday the origin.
		const offset = (date.getUTCDay() + 6) % 7;

		return addUtcDays(date, -offset);
	}

	return date;
};

/**
 * Точки отдают СРЕДНЕЕ за период, а не сумму: цель по калориям дневная, и
 * столбик с месячной суммой рядом с линией дневной цели читался бы как
 * чудовищное превышение. Дни без записей в среднее не попадают.
 */
export const aggregateNutritionPoints = (
	days: ISerializedNutritionDay[],
	granularity: EGranularity
): ISerializedNutritionPoint[] => {
	const buckets = new Map<
		string,
		{ kcal: number; target: number; count: number }
	>();

	days
		.filter(day => day.fact.kcal > 0)
		.forEach(day => {
			const key = toIsoDay(
				bucketStart(new Date(`${day.date}T00:00:00.000Z`), granularity)
			);

			const bucket = buckets.get(key) || { kcal: 0, target: 0, count: 0 };

			buckets.set(key, {
				kcal: bucket.kcal + day.fact.kcal,
				target: bucket.target + day.target.kcal,
				count: bucket.count + 1,
			});
		});

	return [...buckets.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, bucket]) => ({
			date,
			kcal: Math.round(bucket.kcal / bucket.count),
			target: Math.round(bucket.target / bucket.count),
		}));
};
```

- [ ] **Step 4: Прогнать тесты**

Run: `cd backend && npm test -- src/health/nutrition-chart.spec.ts`
Expected: PASS, 12 тестов.

- [ ] **Step 5: Коммит**

```bash
git add backend/src/health/nutrition-chart.ts backend/src/health/nutrition-chart.spec.ts
git commit -m "feat(health): aggregate nutrition chart points by granularity"
```

---

### Task 6: Сервис, DTO и контроллер питания

**Files:**
- Create: `backend/src/health/dto/meal-item.dto.ts`
- Create: `backend/src/health/dto/create-meal.dto.ts`
- Create: `backend/src/health/dto/update-meal.dto.ts`
- Create: `backend/src/health/dto/update-nutrition-entry.dto.ts`
- Create: `backend/src/health/dto/apply-targets.dto.ts`
- Create: `backend/src/health/dto/find-nutrition.dto.ts`
- Create: `backend/src/health/health-nutrition.service.ts`
- Create: `backend/src/health/health-nutrition.controller.ts`
- Test: `backend/src/health/health-nutrition.service.spec.ts`
- Modify: `backend/src/health/health.module.ts`

**Interfaces:**
- Consumes: `HealthProfileService.loadProfile` / `.currentWeight`, `HealthProfileSerializer.serialize` (для целей дня), `HealthNutritionSerializer`, `aggregateNutritionPoints`, `calcItemMacros`, `sumMacros`, `startOfUtcDay` / `addUtcDays`.
- Produces: `HealthNutritionService` с `list`, `createMeal`, `updateMeal`, `removeMeal`, `updateDay`, `removeDay`, `applyTargets`; маршруты под `/api/v2/health/nutrition`.

- [ ] **Step 1: Написать DTO**

`backend/src/health/dto/meal-item.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import { IsMongoId, IsNumber, Max, Min } from "class-validator";

export class MealItemDto {
	@ApiProperty()
	@IsMongoId()
	productId: string;

	@ApiProperty()
	@IsNumber()
	@Min(1)
	@Max(5000)
	grams: number;
}
```

`backend/src/health/dto/create-meal.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsDateString,
	IsEnum,
	ValidateNested,
} from "class-validator";
import { EMealType } from "../../../types/health";
import { MealItemDto } from "./meal-item.dto";

export class CreateMealDto {
	@ApiProperty()
	@IsDateString()
	date: string;

	@ApiProperty({ enum: EMealType })
	@IsEnum(EMealType)
	mealType: EMealType;

	@ApiProperty({ type: [MealItemDto] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(50)
	@ValidateNested({ each: true })
	@Type(() => MealItemDto)
	items: MealItemDto[];
}
```

`backend/src/health/dto/update-meal.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsEnum,
	IsOptional,
	ValidateNested,
} from "class-validator";
import { EMealType } from "../../../types/health";
import { MealItemDto } from "./meal-item.dto";

export class UpdateMealDto {
	@ApiProperty({ required: false, enum: EMealType })
	@IsOptional()
	@IsEnum(EMealType)
	mealType?: EMealType;

	@ApiProperty({ required: false, type: [MealItemDto] })
	@IsOptional()
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(50)
	@ValidateNested({ each: true })
	@Type(() => MealItemDto)
	items?: MealItemDto[];
}
```

`backend/src/health/dto/update-nutrition-entry.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import {
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from "class-validator";

export class UpdateNutritionEntryDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(20000)
	targetKcal?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(2000)
	targetProteinG?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(2000)
	targetFatG?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(2000)
	targetCarbsG?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	note?: string;
}
```

`backend/src/health/dto/apply-targets.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import { IsDateString } from "class-validator";

export class ApplyTargetsDto {
	@ApiProperty()
	@IsDateString()
	from: string;

	@ApiProperty()
	@IsDateString()
	to: string;
}
```

`backend/src/health/dto/find-nutrition.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional } from "class-validator";
import { EGranularity } from "../../../types/health";

export class FindNutritionDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsDateString()
	from?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsDateString()
	to?: string;

	@ApiProperty({ required: false, enum: EGranularity })
	@IsOptional()
	@IsEnum(EGranularity)
	granularity?: EGranularity;
}
```

- [ ] **Step 2: Написать падающий тест сервиса**

`backend/src/health/health-nutrition.service.spec.ts`:

```ts
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EGranularity, EMealType } from "../../types/health";
import { HealthNutritionService } from "./health-nutrition.service";

const buildPrismaMock = () => ({
	healthNutritionEntry: {
		findMany: jest.fn().mockResolvedValue([]),
		findUnique: jest.fn(),
		findFirst: jest.fn().mockResolvedValue(null),
		create: jest.fn(),
		update: jest.fn(),
		updateMany: jest.fn().mockResolvedValue({ count: 0 }),
		delete: jest.fn(),
	},
	healthMeal: {
		findUnique: jest.fn(),
		create: jest.fn().mockResolvedValue({ id: "m1" }),
		update: jest.fn(),
		delete: jest.fn(),
		findMany: jest.fn().mockResolvedValue([]),
	},
	healthMealItem: {
		createMany: jest.fn(),
		deleteMany: jest.fn(),
		findMany: jest.fn().mockResolvedValue([]),
	},
	healthProduct: {
		findMany: jest.fn().mockResolvedValue([]),
	},
});

const profileRecord = {
	id: "p1",
	userId: "u1",
	sex: "male",
	birthDate: new Date("1996-08-26T00:00:00.000Z"),
	heightCm: 160,
	activityLevel: "light",
	startWeightKg: 75,
	targetWeightKg: 66,
	startedAt: new Date("2026-08-01T00:00:00.000Z"),
	dailyDeficit: 500,
	proteinPerKg: 1.8,
	proteinBasis: "current",
	fatPercent: 0.3,
};

const profileServiceMock = {
	loadProfile: jest.fn(),
	currentWeight: jest.fn(),
};

const req = { payload: { id: "u1" } };

const buckwheat = {
	id: "pr1",
	value: "buckwheat",
	kcalPer100: 308,
	proteinPer100: 12.6,
	fatPer100: 3.3,
	carbsPer100: 57.1,
	label: [{ label: "Гречка, сухая" }],
};

describe("HealthNutritionService", () => {
	let prisma: ReturnType<typeof buildPrismaMock>;
	let service: HealthNutritionService;

	beforeEach(() => {
		prisma = buildPrismaMock();
		profileServiceMock.loadProfile.mockReset().mockResolvedValue(profileRecord);
		profileServiceMock.currentWeight.mockReset().mockResolvedValue(75);
		service = new HealthNutritionService(
			prisma as any,
			profileServiceMock as any
		);
	});

	describe("createMeal", () => {
		beforeEach(() => {
			prisma.healthProduct.findMany.mockResolvedValue([buckwheat]);
			prisma.healthNutritionEntry.findUnique.mockResolvedValue({
				id: "n1",
				userId: "u1",
			});
		});

		it("computes and snapshots the macros of every item from the product", async () => {
			await service.createMeal(
				{
					date: "2026-08-26",
					mealType: EMealType.Breakfast,
					items: [{ productId: "pr1", grams: 80 }],
				},
				req
			);

			expect(prisma.healthMealItem.createMany).toHaveBeenCalledWith({
				data: [
					{
						mealId: "m1",
						productId: "pr1",
						title: "Гречка, сухая",
						grams: 80,
						kcal: 246,
						proteinG: 10.1,
						fatG: 2.6,
						carbsG: 45.7,
					},
				],
			});
		});

		it("refuses an item whose product does not exist", async () => {
			prisma.healthProduct.findMany.mockResolvedValue([]);

			await expect(
				service.createMeal(
					{
						date: "2026-08-26",
						mealType: EMealType.Breakfast,
						items: [{ productId: "pr404", grams: 80 }],
					},
					req
				)
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it("creates the day with targets frozen from the current profile", async () => {
			prisma.healthNutritionEntry.findUnique.mockResolvedValue(null);
			prisma.healthNutritionEntry.create.mockResolvedValue({
				id: "n1",
				userId: "u1",
			});

			await service.createMeal(
				{
					date: "2026-08-26",
					mealType: EMealType.Breakfast,
					items: [{ productId: "pr1", grams: 80 }],
				},
				req
			);

			expect(prisma.healthNutritionEntry.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					userId: "u1",
					targetKcal: 1707,
					targetProteinG: 135,
					targetFatG: 56.9,
					targetCarbsG: 163.7,
				}),
			});
		});

		it("refuses to log food before the profile is configured", async () => {
			// День ещё не заведён — иначе ensureDay вернётся раньше, чем дойдёт
			// до профиля, и проверка никогда не сработает.
			prisma.healthNutritionEntry.findUnique.mockResolvedValue(null);
			profileServiceMock.loadProfile.mockResolvedValue(null);

			await expect(
				service.createMeal(
					{
						date: "2026-08-26",
						mealType: EMealType.Breakfast,
						items: [{ productId: "pr1", grams: 80 }],
					},
					req
				)
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it("refuses a future date", async () => {
			jest.useFakeTimers().setSystemTime(
				new Date("2026-08-26T10:00:00.000Z")
			);

			await expect(
				service.createMeal(
					{
						date: "2026-08-27",
						mealType: EMealType.Breakfast,
						items: [{ productId: "pr1", grams: 80 }],
					},
					req
				)
			).rejects.toBeInstanceOf(BadRequestException);

			jest.useRealTimers();
		});

		it("never takes userId from the request body", async () => {
			prisma.healthNutritionEntry.findUnique.mockResolvedValue(null);
			prisma.healthNutritionEntry.create.mockResolvedValue({
				id: "n1",
				userId: "u1",
			});

			await service.createMeal(
				{
					date: "2026-08-26",
					mealType: EMealType.Breakfast,
					items: [{ productId: "pr1", grams: 80 }],
					userId: "VICTIM",
				} as any,
				req
			);

			expect(prisma.healthNutritionEntry.create).toHaveBeenCalledWith({
				data: expect.objectContaining({ userId: "u1" }),
			});
		});
	});

	describe("updateMeal", () => {
		it("refuses to touch a meal belonging to somebody else", async () => {
			prisma.healthMeal.findUnique.mockResolvedValue({
				id: "m1",
				entry: { id: "n1", userId: "u2" },
			});

			await expect(
				service.updateMeal("m1", { mealType: EMealType.Lunch }, req)
			).rejects.toBeInstanceOf(NotFoundException);
			expect(prisma.healthMeal.update).not.toHaveBeenCalled();
		});

		it("replaces the whole composition rather than merging it", async () => {
			prisma.healthMeal.findUnique.mockResolvedValue({
				id: "m1",
				entry: { id: "n1", userId: "u1" },
			});
			prisma.healthProduct.findMany.mockResolvedValue([buckwheat]);

			await service.updateMeal(
				"m1",
				{ items: [{ productId: "pr1", grams: 100 }] },
				req
			);

			expect(prisma.healthMealItem.deleteMany).toHaveBeenCalledWith({
				where: { mealId: "m1" },
			});
			expect(prisma.healthMealItem.createMany).toHaveBeenCalled();
		});
	});

	describe("removeMeal", () => {
		it("refuses to delete a meal belonging to somebody else", async () => {
			prisma.healthMeal.findUnique.mockResolvedValue({
				id: "m1",
				entry: { id: "n1", userId: "u2" },
			});

			await expect(service.removeMeal("m1", req)).rejects.toBeInstanceOf(
				NotFoundException
			);
			expect(prisma.healthMeal.delete).not.toHaveBeenCalled();
		});
	});

	describe("list", () => {
		it("defaults to the last 90 days ending today", async () => {
			jest.useFakeTimers().setSystemTime(
				new Date("2026-08-26T10:00:00.000Z")
			);

			await service.list({}, req);

			expect(prisma.healthNutritionEntry.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						userId: "u1",
						date: {
							gte: new Date("2026-05-28T00:00:00.000Z"),
							lte: new Date("2026-08-26T00:00:00.000Z"),
						},
					},
				})
			);

			jest.useRealTimers();
		});

		it("defaults to day granularity when none is asked for", async () => {
			const result = await service.list({}, req);

			expect(result.granularity).toBe(EGranularity.Day);
		});
	});
});
```

Проверка чисел: гречка 80 г → 308·0.8 = 246.4 → 246 ккал; 12.6·0.8 = 10.08 → 10.1; 3.3·0.8 = 2.64 → 2.6; 57.1·0.8 = 45.68 → 45.7. Цели профиля при весе 75 — те же 1707 / 135 / 56.9 / 163.7, что и в предыдущем плане.

- [ ] **Step 3: Убедиться, что тест падает**

Run: `cd backend && npm test -- src/health/health-nutrition.service.spec.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 4: Реализовать сервис**

`backend/src/health/health-nutrition.service.ts`:

```ts
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { EGranularity, EMealType } from "../../types/health";
import { addUtcDays, startOfUtcDay } from "../../utils/date";
import { PrismaService } from "../prisma.service";
import { HealthProfileService } from "./health-profile.service";
import { HealthProfileSerializer } from "./serializer/health-profile.serializer";
import {
	HealthNutritionSerializer,
	ISerializedNutritionDay,
	ISerializedNutritionTotals,
} from "./serializer/health-nutrition.serializer";
import {
	aggregateNutritionPoints,
	ISerializedNutritionPoint,
} from "./nutrition-chart";
import { calcItemMacros, sumMacros } from "./nutrition.calculator";
import { MealItemDto } from "./dto/meal-item.dto";
import { CreateMealDto } from "./dto/create-meal.dto";
import { UpdateMealDto } from "./dto/update-meal.dto";
import { UpdateNutritionEntryDto } from "./dto/update-nutrition-entry.dto";
import { ApplyTargetsDto } from "./dto/apply-targets.dto";
import { FindNutritionDto } from "./dto/find-nutrition.dto";

export const DEFAULT_RANGE_DAYS = 90;

export interface ISerializedNutritionLog {
	granularity: EGranularity;
	days: ISerializedNutritionDay[];
	totals: ISerializedNutritionTotals;
	chart: ISerializedNutritionPoint[];
}

interface IPreparedItem {
	productId: string;
	title: string;
	grams: number;
	kcal: number;
	proteinG: number;
	fatG: number;
	carbsG: number;
}

@Injectable()
export class HealthNutritionService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly healthProfileService: HealthProfileService
	) {}

	private mealsInclude() {
		return {
			meals: {
				orderBy: { createdAt: "asc" as const },
				include: { items: { orderBy: { createdAt: "asc" as const } } },
			},
		};
	}

	/**
	 * Цели дня берутся из профиля ОДИН РАЗ, при создании строки, и дальше живут
	 * в ней. Смена профиля не переписывает прошлое — для этого есть applyTargets.
	 */
	private async targetsFor(userId: string) {
		const profile = await this.healthProfileService.loadProfile(userId);

		if (!profile) {
			throw new BadRequestException("Health profile is not configured");
		}

		const weight = await this.healthProfileService.currentWeight(
			userId,
			profile.startWeightKg
		);
		const serialized = HealthProfileSerializer.serialize(profile, weight);

		return {
			targetKcal: serialized.targetKcal,
			targetProteinG: serialized.macroTargets.proteinG,
			targetFatG: serialized.macroTargets.fatG,
			targetCarbsG: serialized.macroTargets.carbsG,
		};
	}

	private async prepareItems(
		items: MealItemDto[]
	): Promise<IPreparedItem[]> {
		const products = await this.prismaService.healthProduct.findMany({
			where: { id: { in: items.map(item => item.productId) } },
			include: { label: true },
		});

		const byId = new Map(products.map(product => [product.id, product]));

		return items.map(item => {
			const product = byId.get(item.productId);

			if (!product) {
				throw new BadRequestException(
					`Unknown product: ${item.productId}`
				);
			}

			const macros = calcItemMacros({ product, grams: item.grams });

			return {
				productId: product.id,
				// Снимок названия: продукт могут переименовать или удалить,
				// а запись в дневнике должна остаться читаемой.
				title: (product as any).label?.[0]?.label || product.value,
				grams: item.grams,
				...macros,
			};
		});
	}

	private async ensureDay(userId: string, day: Date) {
		const existing =
			await this.prismaService.healthNutritionEntry.findUnique({
				where: { userId_date: { userId, date: day } },
			});

		if (existing) {
			return existing;
		}

		return this.prismaService.healthNutritionEntry.create({
			data: {
				...(await this.targetsFor(userId)),
				date: day,
				userId,
			},
		});
	}

	private async loadOwnedMeal(mealId: string, userId: string) {
		const meal = await this.prismaService.healthMeal.findUnique({
			where: { id: mealId },
			include: { entry: true },
		});

		if (!meal || (meal as any).entry?.userId !== userId) {
			throw new NotFoundException("Meal not found");
		}

		return meal;
	}

	/**
	 * Пересчёт идёт снизу вверх и последовательно, а не одной транзакцией:
	 * MongoDB-транзакции здесь дали бы немного, а худший исход — устаревший
	 * итог до следующей записи, который сам себя чинит.
	 */
	private async recalcMeal(mealId: string): Promise<void> {
		const items = await this.prismaService.healthMealItem.findMany({
			where: { mealId },
		});

		await this.prismaService.healthMeal.update({
			where: { id: mealId },
			data: sumMacros(items),
		});
	}

	private async recalcDay(entryId: string): Promise<void> {
		const meals = await this.prismaService.healthMeal.findMany({
			where: { entryId },
		});

		await this.prismaService.healthNutritionEntry.update({
			where: { id: entryId },
			data: sumMacros(meals),
		});
	}

	private async writeItems(
		mealId: string,
		items: MealItemDto[]
	): Promise<void> {
		const prepared = await this.prepareItems(items);

		await this.prismaService.healthMealItem.deleteMany({
			where: { mealId },
		});
		await this.prismaService.healthMealItem.createMany({
			data: prepared.map(item => ({ mealId, ...item })),
		});
	}

	async list(
		dto: FindNutritionDto,
		req: Record<string, any>
	): Promise<ISerializedNutritionLog> {
		const userId: string = req.payload.id;
		const granularity = dto.granularity || EGranularity.Day;

		const to = dto.to ? startOfUtcDay(new Date(dto.to)) : startOfUtcDay();
		const from = dto.from
			? startOfUtcDay(new Date(dto.from))
			: addUtcDays(to, -DEFAULT_RANGE_DAYS);

		const entries =
			await this.prismaService.healthNutritionEntry.findMany({
				where: { userId, date: { gte: from, lte: to } },
				orderBy: { date: "asc" },
				include: this.mealsInclude(),
			});

		const days = entries.map(entry =>
			HealthNutritionSerializer.serializeDay(entry)
		);

		return {
			granularity,
			days: [...days].reverse(),
			totals: HealthNutritionSerializer.serializeTotals(days),
			chart: aggregateNutritionPoints(days, granularity),
		};
	}

	async createMeal(dto: CreateMealDto, req: Record<string, any>) {
		const userId: string = req.payload.id;
		const day = startOfUtcDay(new Date(dto.date));

		if (day > startOfUtcDay()) {
			throw new BadRequestException("Cannot log a meal in the future");
		}

		const entry = await this.ensureDay(userId, day);
		const meal = await this.prismaService.healthMeal.create({
			data: { entryId: entry.id, mealType: dto.mealType },
		});

		await this.writeItems(meal.id, dto.items);
		await this.recalcMeal(meal.id);
		await this.recalcDay(entry.id);

		return meal;
	}

	async updateMeal(
		mealId: string,
		dto: UpdateMealDto,
		req: Record<string, any>
	) {
		const meal = await this.loadOwnedMeal(mealId, req.payload.id);

		if (dto.mealType) {
			await this.prismaService.healthMeal.update({
				where: { id: mealId },
				data: { mealType: dto.mealType },
			});
		}

		if (dto.items) {
			await this.writeItems(mealId, dto.items);
			await this.recalcMeal(mealId);
		}

		await this.recalcDay(meal.entryId);

		return this.prismaService.healthMeal.findUnique({
			where: { id: mealId },
			include: { items: true },
		});
	}

	async removeMeal(
		mealId: string,
		req: Record<string, any>
	): Promise<void> {
		const meal = await this.loadOwnedMeal(mealId, req.payload.id);

		await this.prismaService.healthMeal.delete({ where: { id: mealId } });
		await this.recalcDay(meal.entryId);
	}

	private async loadOwnedDay(id: string, userId: string) {
		const entry = await this.prismaService.healthNutritionEntry.findUnique({
			where: { id },
		});

		if (!entry || entry.userId !== userId) {
			throw new NotFoundException("Nutrition entry not found");
		}

		return entry;
	}

	async updateDay(
		id: string,
		dto: UpdateNutritionEntryDto,
		req: Record<string, any>
	) {
		await this.loadOwnedDay(id, req.payload.id);

		const data: Record<string, unknown> = {};

		(
			[
				"targetKcal",
				"targetProteinG",
				"targetFatG",
				"targetCarbsG",
				"note",
			] as const
		).forEach(key => {
			if (dto[key] !== undefined) {
				data[key] = dto[key];
			}
		});

		return this.prismaService.healthNutritionEntry.update({
			where: { id },
			data,
		});
	}

	async removeDay(id: string, req: Record<string, any>): Promise<void> {
		await this.loadOwnedDay(id, req.payload.id);

		await this.prismaService.healthNutritionEntry.delete({ where: { id } });
	}

	async applyTargets(
		dto: ApplyTargetsDto,
		req: Record<string, any>
	): Promise<{ updated: number }> {
		const userId: string = req.payload.id;
		const targets = await this.targetsFor(userId);

		const result =
			await this.prismaService.healthNutritionEntry.updateMany({
				where: {
					userId,
					date: {
						gte: startOfUtcDay(new Date(dto.from)),
						lte: startOfUtcDay(new Date(dto.to)),
					},
				},
				data: targets,
			});

		return { updated: result.count };
	}
}
```

- [ ] **Step 5: Прогнать тесты**

Run: `cd backend && npm test -- src/health/health-nutrition.service.spec.ts`
Expected: PASS, 11 тестов.

- [ ] **Step 6: Контроллер и регистрация**

`backend/src/health/health-nutrition.controller.ts`:

```ts
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Query,
	Req,
	UsePipes,
	ValidationPipe,
} from "@nestjs/common";
import { type Request } from "express";
import { HealthNutritionService } from "./health-nutrition.service";
import { FindNutritionDto } from "./dto/find-nutrition.dto";
import { CreateMealDto } from "./dto/create-meal.dto";
import { UpdateMealDto } from "./dto/update-meal.dto";
import { UpdateNutritionEntryDto } from "./dto/update-nutrition-entry.dto";
import { ApplyTargetsDto } from "./dto/apply-targets.dto";

@Controller("health/nutrition")
@UsePipes(
	new ValidationPipe({
		transform: true,
		whitelist: true,
		forbidNonWhitelisted: true,
	})
)
export class HealthNutritionController {
	constructor(
		private readonly healthNutritionService: HealthNutritionService
	) {}

	@Get()
	list(@Query() dto: FindNutritionDto, @Req() req: Request) {
		return this.healthNutritionService.list(dto, req);
	}

	@HttpCode(HttpStatus.CREATED)
	@Post("meals")
	createMeal(@Body() dto: CreateMealDto, @Req() req: Request) {
		return this.healthNutritionService.createMeal(dto, req);
	}

	@Patch("meals/:mealId")
	updateMeal(
		@Param("mealId") mealId: string,
		@Body() dto: UpdateMealDto,
		@Req() req: Request
	) {
		return this.healthNutritionService.updateMeal(mealId, dto, req);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete("meals/:mealId")
	async removeMeal(
		@Param("mealId") mealId: string,
		@Req() req: Request
	) {
		await this.healthNutritionService.removeMeal(mealId, req);
		return;
	}

	@Post("apply-targets")
	applyTargets(@Body() dto: ApplyTargetsDto, @Req() req: Request) {
		return this.healthNutritionService.applyTargets(dto, req);
	}

	@Patch(":id")
	updateDay(
		@Param("id") id: string,
		@Body() dto: UpdateNutritionEntryDto,
		@Req() req: Request
	) {
		return this.healthNutritionService.updateDay(id, dto, req);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(":id")
	async removeDay(@Param("id") id: string, @Req() req: Request) {
		await this.healthNutritionService.removeDay(id, req);
		return;
	}
}
```

Порядок маршрутов важен: `meals/...` и `apply-targets` объявлены ДО `:id`, иначе Nest примет слово `meals` за идентификатор дня.

Дописать `HealthNutritionController` и `HealthNutritionService` в `health.module.ts`, не трогая уже зарегистрированные.

- [ ] **Step 7: Прогнать всё и закоммитить**

Run: `cd backend && npm test && npm run build`
Expected: вся сюита зелёная, сборка чистая.

```bash
git add backend/src/health
git commit -m "feat(health): add nutrition log endpoints"
```

---

### Task 7: Фундамент фронта — типы, api, вторая вкладка, i18n

**Files:**
- Modify: `frontend/shared/types/health.ts`
- Modify: `frontend/shared/types/routes.ts`
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/app/components/health/Tabs.vue`
- Modify: `frontend/i18n/locales/en.json`
- Modify: `frontend/i18n/locales/ru.json`

**Interfaces:**
- Consumes: форму ответов из Tasks 3–6.
- Produces: `EMealType`, `EDeviationStatus`, `EGranularity`, `EProductCategory`, `IMacroSet`, `IMealItem`, `IMeal`, `INutritionDay`, `INutritionTotals`, `INutritionPoint`, `INutritionLog`, `IProduct`; `ERoutes.healthNutrition`; `api.health.products` / `.nutrition` / `.nutritionDetail(id)` / `.meals` / `.meal(id)` / `.applyTargets`; вторую вкладку в `HealthTabs`.

- [ ] **Step 1: Типы**

Дописать в конец `frontend/shared/types/health.ts` (енумы копируют значения из `backend/types/health.ts` — они ездят по проводу строками, сверьте по файлу, а не по памяти):

```ts
export enum EMealType {
	Breakfast = "breakfast",
	Lunch = "lunch",
	Dinner = "dinner",
	Snack = "snack",
}

export enum EProductCategory {
	Grains = "grains",
	Meat = "meat",
	Dairy = "dairy",
	Eggs = "eggs",
	Vegetables = "vegetables",
	Fruits = "fruits",
	Fats = "fats",
	Other = "other",
}

export enum EDeviationStatus {
	Under = "under",
	OnTarget = "onTarget",
	Over = "over",
}

export enum EGranularity {
	Day = "day",
	Week = "week",
	Month = "month",
}

export interface IMacroSet {
	kcal: number;
	proteinG: number;
	fatG: number;
	carbsG: number;
}

export interface IProduct {
	id: string;
	value: string;
	title: string;
	kcalPer100: number;
	proteinPer100: number;
	fatPer100: number;
	carbsPer100: number;
	category: EProductCategory | null;
}

export interface IMealItem {
	id: string;
	title: string;
	grams: number;
	productId: string | null;
	kcal: number;
	proteinG: number;
	fatG: number;
	carbsG: number;
}

export interface IMeal {
	id: string;
	mealType: EMealType;
	kcal: number;
	proteinG: number;
	fatG: number;
	carbsG: number;
	items: IMealItem[];
}

export interface INutritionDay {
	id: string;
	date: string;
	fact: IMacroSet;
	target: IMacroSet;
	deviationKcal: number;
	status: EDeviationStatus;
	note: string | null;
	meals: IMeal[];
}

export interface INutritionTotals {
	daysLogged: number;
	onTargetDays: number;
	avgKcal: number;
	avgProteinG: number;
	avgFatG: number;
	avgCarbsG: number;
}

export interface INutritionPoint {
	date: string;
	kcal: number;
	target: number;
}

export interface INutritionLog {
	granularity: EGranularity;
	days: INutritionDay[];
	totals: INutritionTotals;
	chart: INutritionPoint[];
}
```

- [ ] **Step 2: Роут и api**

В `ERoutes` после `healthBody`:

```ts
	healthNutrition = "/health/nutrition",
```

В `frontend/lib/api.ts` в блок `health` дописать:

```ts
		products: `${prefix}/health/products/`,
		nutrition: `${prefix}/health/nutrition/`,
		nutritionDetail: (id: string) => `${prefix}/health/nutrition/${id}/`,
		meals: `${prefix}/health/nutrition/meals/`,
		meal: (id: string) => `${prefix}/health/nutrition/meals/${id}/`,
		applyTargets: `${prefix}/health/nutrition/apply-targets/`,
```

- [ ] **Step 3: Вторая вкладка**

В `frontend/app/components/health/Tabs.vue` в массив `items` добавить вторым элементом:

```ts
	{ label: t("health.tabs.nutrition"), value: ERoutes.healthNutrition, icon: "i-lucide-utensils" },
```

Логику активной вкладки не трогать — она уже выбирает элемент по `route.path.startsWith`.

- [ ] **Step 4: Локали**

В обе локали, внутрь блока `health`: ключ `tabs.nutrition` и новый подблок. Английский:

```json
		"nutrition": {
			"title": "Nutrition diary",
			"addMeal": "Add meal",
			"noProfile": "Fill in your health profile first — the daily targets come from it.",
			"empty": "No meals logged for this period yet",
			"fact": "Eaten",
			"target": "Target",
			"deviation": "Difference",
			"avgKcal": "Average calories",
			"daysLogged": "Days logged",
			"onTargetDays": "Days on target",
			"product": "Product",
			"grams": "Grams",
			"addProduct": "Add product",
			"removeProduct": "Remove",
			"mealTotal": "Meal total",
			"caloriesChartTitle": "Calories",
			"macrosChartTitle": "Macro split",
			"chartEmpty": "Nothing logged for this period yet",
			"needProduct": "Add at least one product"
		},
		"mealTypes": {
			"breakfast": "Breakfast",
			"lunch": "Lunch",
			"dinner": "Dinner",
			"snack": "Snack"
		},
		"status": {
			"under": "Below target",
			"onTarget": "On target",
			"over": "Above target"
		},
		"granularity": {
			"day": "By day",
			"week": "By week",
			"month": "By month"
		}
```

Русский — те же ключи: `tabs.nutrition` — `"КБЖУ"`, `nutrition.title` — `"Дневник питания"`, `addMeal` — `"Добавить приём пищи"`, `noProfile` — `"Сначала заполните профиль здоровья — дневные цели берутся из него."`, `empty` — `"За этот период приёмы пищи не записаны"`, `fact` — `"Съедено"`, `target` — `"Цель"`, `deviation` — `"Отклонение"`, `avgKcal` — `"Средние калории"`, `daysLogged` — `"Дней с записями"`, `onTargetDays` — `"Дней в цели"`, `product` — `"Продукт"`, `grams` — `"Граммы"`, `addProduct` — `"Добавить продукт"`, `removeProduct` — `"Убрать"`, `mealTotal` — `"Итог приёма"`, `caloriesChartTitle` — `"Калории"`, `macrosChartTitle` — `"Распределение БЖУ"`, `chartEmpty` — `"За этот период ещё нет записей"`, `needProduct` — `"Добавьте хотя бы один продукт"`; `mealTypes` — `"Завтрак" / "Обед" / "Ужин" / "Перекус"`; `status` — `"Ниже цели" / "В цели" / "Выше цели"`; `granularity` — `"По дням" / "По неделям" / "По месяцам"`. Плюс `buttons.newMeal` — `"Добавить приём"` / `"Add meal"` и `modals.newMeal` — `"Новый приём пищи"` / `"New meal"`.

- [ ] **Step 5: Проверить**

Run: `cd frontend && npm run build`
Expected: сборка чистая. Вкладка «КБЖУ» появилась и ведёт на `/health/nutrition` (страница будет в следующей задаче — пока 404, это ожидаемо).

Проверьте, что наборы ключей в обеих локалях совпадают:

```bash
cd frontend && node -e "
const flat=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'&&v?flat(v,p+k+'.'):[p+k]);
const en=flat(require('./i18n/locales/en.json')), ru=flat(require('./i18n/locales/ru.json'));
const miss=(a,b)=>a.filter(k=>!b.includes(k)&&k.startsWith('health.'));
console.log('нет в ru:',miss(en,ru)); console.log('нет в en:',miss(ru,en));
"
```
Expected: оба списка пустые.

- [ ] **Step 6: Коммит**

```bash
git add frontend/shared/types/health.ts frontend/shared/types/routes.ts frontend/lib/api.ts frontend/app/components/health/Tabs.vue frontend/i18n/locales
git commit -m "feat(health): add nutrition types, routes and translations"
```

---

### Task 8: Страница КБЖУ и карточка периода

**Files:**
- Create: `frontend/app/pages/health/nutrition/index.vue`
- Create: `frontend/app/components/health/NutritionTotals.vue`

**Interfaces:**
- Consumes: `INutritionLog`, `THealthProfileResponse`, `api.health.nutrition`, `api.health.profile`.
- Produces: страница `/health/nutrition` с `log`, `profile`, `rangeDays`, `granularity` и `refreshAll()`; `<HealthNutritionTotals :totals="..." />`.

- [ ] **Step 1: Карточка агрегатов**

`frontend/app/components/health/NutritionTotals.vue`:

```vue
<script setup lang="ts">
import { splitThousands } from "~/assets/utils/numbers";

const props = defineProps<{
	totals: INutritionTotals;
}>();

const cards = computed(() => [
	{ label: "health.nutrition.avgKcal", value: splitThousands(props.totals.avgKcal) },
	{ label: "health.protein", value: `${props.totals.avgProteinG} ${useI18n().t("health.gram")}` },
	{ label: "health.fat", value: `${props.totals.avgFatG} ${useI18n().t("health.gram")}` },
	{ label: "health.carbs", value: `${props.totals.avgCarbsG} ${useI18n().t("health.gram")}` },
	{ label: "health.nutrition.daysLogged", value: String(props.totals.daysLogged) },
	{ label: "health.nutrition.onTargetDays", value: String(props.totals.onTargetDays) },
]);
</script>

<template>
	<CommonCardWrapper>
		<div class="grid sm:grid-cols-3 lg:grid-cols-6 gap-4">
			<div v-for="card in cards" :key="card.label">
				<div class="text-xs text-gray-400">{{ $t(card.label) }}</div>
				<div class="text-lg">{{ card.value }}</div>
			</div>
		</div>
	</CommonCardWrapper>
</template>
```

Вызов `useI18n()` внутри `computed` работает, но повторяется — вынесите `const { t } = useI18n();` в setup и используйте `t` внутри, как сделано в остальных компонентах раздела.

- [ ] **Step 2: Страница**

`frontend/app/pages/health/nutrition/index.vue`:

```vue
<script setup lang="ts">
import { api } from "~~/lib/api";

const { t } = useI18n();
const toast = useToast();

const rangeDays = ref<number | null>(90);
const granularity = ref<EGranularity>(EGranularity.Day);

const HEALTH_HISTORY_EPOCH = "1970-01-01";

const nutritionParams = computed(() => {
	const to = new Date();
	const from =
		rangeDays.value === null
			? HEALTH_HISTORY_EPOCH
			: new Date(to.getTime() - rangeDays.value * 24 * 60 * 60 * 1000)
					.toISOString()
					.slice(0, 10);

	return {
		from,
		to: to.toISOString().slice(0, 10),
		granularity: granularity.value,
	};
});

const { data: profile, error, refresh: refreshProfile } = await useFetch<THealthProfileResponse>(
	api.health.profile,
	{ key: "HealthProfile" },
);

const { data: log, refresh: refreshLog } = await useFetch<INutritionLog>(api.health.nutrition, {
	key: "HealthNutritionLog",
	params: nutritionParams,
});

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}

const isConfigured = computed((): boolean => Boolean(profile.value?.isConfigured));

async function refreshAll() {
	await Promise.all([refreshProfile(), refreshLog()]);
}

async function handleDeleteMeal(id: string) {
	try {
		await $fetch(api.health.meal(id), { method: "DELETE" });

		await refreshAll();
		toast.add({ title: t("common.deleted"), color: "success", icon: "i-lucide-circle-check" });
	} catch (e) {
		console.warn("Health nutrition / handleDeleteMeal: ", e);
		toast.add({ title: t("common.error"), color: "error" });
	}
}
</script>

<template>
	<section class="grid gap-4">
		<h1 class="lg:text-3xl text-2xl font-bold">{{ $t("routes.health") }}</h1>

		<HealthTabs />

		<CommonSuspenseWrapper>
			<HealthEmptyProfile v-if="!isConfigured" />

			<div v-else-if="profile?.isConfigured" class="grid gap-6">
				<HealthNormCard :profile="profile" />
				<HealthNutritionTotals v-if="log" :totals="log.totals" />
			</div>
		</CommonSuspenseWrapper>
	</section>
</template>
```

`HealthNormCard` переиспользуется с вкладки веса: дневная цель по калориям и БЖУ — это
ровно то, с чем сравнивается факт на этой вкладке, и дублировать её нечем.

`HealthEmptyProfile` уже существует и принимает слот с кнопкой — на этой вкладке слот не заполняем: профиль заводится на соседней вкладке, и текст `health.emptyProfile` уже объясняет, что делать.

- [ ] **Step 3: Проверить**

Run: `cd frontend && npm run build`
Expected: сборка чистая; `/health/nutrition` открывается, вкладки переключаются, без профиля видно пустое состояние.

- [ ] **Step 4: Коммит**

```bash
git add frontend/app/pages/health/nutrition frontend/app/components/health/NutritionTotals.vue
git commit -m "feat(health): add the nutrition page shell"
```

---

### Task 9: Выбор продукта и форма приёма пищи

**Files:**
- Create: `frontend/app/components/health/ProductPicker.vue`
- Create: `frontend/app/components/modals/AddMeal.vue`
- Modify: `frontend/app/pages/health/nutrition/index.vue`

**Interfaces:**
- Consumes: `IProduct`, `EMealType`, `api.health.products`, `api.health.meals`.
- Produces: `<HealthProductPicker v-model="productId" />`, `<ModalsAddMeal @refresh="..." />`.

- [ ] **Step 1: Выбор продукта**

`frontend/app/components/health/ProductPicker.vue`:

```vue
<script setup lang="ts">
import { api } from "~~/lib/api";

const props = defineProps<{
	modelValue: string | null;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: string | null];
}>();

const { data: products } = await useFetch<IProduct[]>(api.health.products, {
	key: "HealthProducts",
});

const items = computed(() =>
	(products.value || []).map((product) => ({
		label: `${product.title} · ${product.kcalPer100} ${useI18n().t("health.nutrition.per100")}`,
		value: product.id,
	})),
);
</script>

<template>
	<USelectMenu
		class="w-full"
		size="md"
		:model-value="props.modelValue"
		:items="items"
		value-key="value"
		:placeholder="$t('health.nutrition.product')"
		virtualize
		@update:model-value="emit('update:modelValue', $event)"
	/>
</template>
```

Добавьте ключ `health.nutrition.per100` в обе локали: `"kcal/100 g"` и `"ккал/100 г"`. Как и в предыдущем компоненте, вынесите `const { t } = useI18n();` в setup вместо вызова внутри `computed`.

Справочник грузится один раз на ключ `HealthProducts` и переиспользуется всеми строками состава — отдельного запроса на строку не делаем.

- [ ] **Step 2: Форма приёма пищи**

`frontend/app/components/modals/AddMeal.vue` — по образцу `EditHealthProfile.vue` (`ModalsBaseSlideOver` + Zod + `reactive`), со списком строк состава:

```vue
<script setup lang="ts">
import { z } from "zod";
import { api } from "~~/lib/api";
import { getError } from "~/assets/utils/common.ts";

const emit = defineEmits(["refresh"]);

const { t } = useI18n();
const toast = useToast();
const slideOverRef = useTemplateRef("slideOver");

const today = new Date().toISOString().slice(0, 10);

interface IRow {
	productId: string | null;
	grams: number | null;
}

const schema = z.object({
	date: z.string().nonempty({ message: t("inputsErrors.required") }),
	mealType: z.enum([
		EMealType.Breakfast,
		EMealType.Lunch,
		EMealType.Dinner,
		EMealType.Snack,
	]),
});

const state = reactive({
	date: today,
	mealType: EMealType.Breakfast,
});

const rows = ref<IRow[]>([{ productId: null, grams: null }]);
const isLoading = ref<boolean>(false);

const { data: products } = await useFetch<IProduct[]>(api.health.products, {
	key: "HealthProducts",
});

const mealTypeItems = computed(() =>
	Object.values(EMealType).map((value) => ({
		label: t(`health.mealTypes.${value}`),
		value,
	})),
);

const filledRows = computed((): IRow[] =>
	rows.value.filter((row) => row.productId && typeof row.grams === "number" && row.grams > 0),
);

const isValid = computed(() => schema.safeParse(state).success && filledRows.value.length > 0);

// Предпросмотр считается на фронте только чтобы не сохранять вслепую.
// Сохранённые числа приходят с бэкенда и ими же перерисовывается таблица.
const preview = computed(() => {
	const byId = new Map((products.value || []).map((product) => [product.id, product]));

	return filledRows.value.reduce(
		(acc, row) => {
			const product = byId.get(row.productId as string);

			if (!product) {
				return acc;
			}

			const share = (row.grams as number) / 100;

			return {
				kcal: acc.kcal + Math.round(product.kcalPer100 * share),
				proteinG: +(acc.proteinG + product.proteinPer100 * share).toFixed(1),
				fatG: +(acc.fatG + product.fatPer100 * share).toFixed(1),
				carbsG: +(acc.carbsG + product.carbsPer100 * share).toFixed(1),
			};
		},
		{ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 },
	);
});

function addRow() {
	rows.value.push({ productId: null, grams: null });
}

function removeRow(index: number) {
	rows.value.splice(index, 1);

	if (!rows.value.length) {
		addRow();
	}
}

async function onSubmit() {
	try {
		isLoading.value = true;

		await $fetch(api.health.meals, {
			method: "POST",
			body: JSON.stringify({
				date: state.date,
				mealType: state.mealType,
				items: filledRows.value.map((row) => ({
					productId: row.productId,
					grams: row.grams,
				})),
			}),
		});

		emit("refresh");
		toast.add({ title: t("common.added"), color: "success", icon: "i-lucide-circle-check" });
	} catch (e) {
		console.warn("AddMeal / onSubmit: ", e);
		toast.add({ title: getError(e) || t("common.error"), color: "error" });
	} finally {
		isLoading.value = false;
		slideOverRef.value?.handleClose();
	}
}

function handleClose() {
	state.date = today;
	state.mealType = EMealType.Breakfast;
	rows.value = [{ productId: null, grams: null }];
}
</script>

<template>
	<ModalsBaseSlideOver
		ref="slideOver"
		btnLabel="newMeal"
		btnIcon="i-lucide-plus"
		title="newMeal"
		:isDisabled="!isValid"
		:isLoading="isLoading"
		@close="handleClose"
		@click="onSubmit"
	>
		<UForm :schema="schema" :state="state" class="w-full flex flex-col space-y-4" @submit="onSubmit">
			<UFormField class="w-full" :label="$t('health.date')" name="date">
				<UInput v-model="state.date" type="date" :max="today" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.nutrition.title')" name="mealType">
				<USelect v-model="state.mealType" :items="mealTypeItems" value-key="value" class="w-full" size="md" />
			</UFormField>

			<div class="grid gap-3">
				<div v-for="(row, index) in rows" :key="index" class="grid grid-cols-[1fr_7rem_auto] gap-2 items-end">
					<HealthProductPicker v-model="row.productId" />

					<UInput
						v-model.number="row.grams"
						type="number"
						step="1"
						size="md"
						:placeholder="$t('health.nutrition.grams')"
					/>

					<UButton
						color="error"
						variant="ghost"
						icon="i-lucide-trash-2"
						:aria-label="$t('health.nutrition.removeProduct')"
						@click="removeRow(index)"
					/>
				</div>

				<UButton variant="subtle" icon="i-lucide-plus" @click="addRow">
					{{ $t("health.nutrition.addProduct") }}
				</UButton>
			</div>

			<div class="text-sm text-gray-400">
				{{ $t("health.nutrition.mealTotal") }}: {{ preview.kcal }} —
				{{ preview.proteinG }} / {{ preview.fatG }} / {{ preview.carbsG }} {{ $t("health.gram") }}
			</div>

			<p v-if="!filledRows.length" class="text-xs text-amber-500">
				{{ $t("health.nutrition.needProduct") }}
			</p>
		</UForm>
	</ModalsBaseSlideOver>
</template>
```

**Известная ловушка, которую нужно проверить, а не предположить:** `UInput` с `type="number"` прогоняет ввод через `looseToNumber` Nuxt UI, и при очистке поля в состоянии остаётся `""`, а не `null`. На предыдущей ветке это чинилось computed-обёртками в `AddBodyEntry.vue` — посмотрите, как там сделано. Здесь `filledRows` проверяет `typeof row.grams === "number"`, что уже отсекает `""`, но убедитесь сами по трём состояниям: пустая строка состава — кнопка заблокирована; заполненная — разблокирована и в payload уходит число; очищенная после заполнения — снова заблокирована и ни `""`, ни `NaN` в запрос не попадают.

- [ ] **Step 3: Подключить на странице**

В `frontend/app/pages/health/nutrition/index.vue` добавить шапку с кнопкой над `CommonSuspenseWrapper`:

```vue
		<CommonSectionHeader>
			<ModalsAddMeal v-if="isConfigured" @refresh="refreshAll" />
		</CommonSectionHeader>
```

- [ ] **Step 4: Проверить и закоммитить**

Run: `cd frontend && npm run build`
Expected: сборка чистая.

```bash
git add frontend/app/components/health/ProductPicker.vue frontend/app/components/modals/AddMeal.vue frontend/app/pages/health/nutrition/index.vue frontend/i18n/locales
git commit -m "feat(health): add the product picker and meal form"
```

---

### Task 10: Дни и таблица приёмов пищи

**Files:**
- Create: `frontend/app/components/health/NutritionDay.vue`
- Create: `frontend/app/components/health/MealsTable.vue`
- Modify: `frontend/app/pages/health/nutrition/index.vue`

**Interfaces:**
- Consumes: `INutritionDay`, `IMeal`, `EDeviationStatus`, `UiColors`.
- Produces: `<HealthNutritionDay :day="..." @delete-meal="..." />`, `<HealthMealsTable :meals="..." @delete="..." />`.

- [ ] **Step 1: Таблица приёмов**

`frontend/app/components/health/MealsTable.vue` — `UTable`, где **строка = приём пищи**, а состав раскрывается через `v-model:expanded` и слот `#expanded` (`UTable` это умеет):

```vue
<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import type { Row } from "@tanstack/table-core";

const props = defineProps<{
	meals: IMeal[];
}>();

const emit = defineEmits<{
	delete: [value: string];
}>();

const { t } = useI18n();

const UButton = resolveComponent("UButton");
const UDropdownMenu = resolveComponent("UDropdownMenu");

const expanded = ref<Record<string, boolean>>({});

const columns: TableColumn<IMeal>[] = [
	{
		id: "expand",
		cell: ({ row }) =>
			h(UButton, {
				color: "neutral",
				variant: "ghost",
				icon: row.getIsExpanded() ? "i-lucide-chevron-down" : "i-lucide-chevron-right",
				"aria-label": t("health.nutrition.mealTotal"),
				onClick: () => row.toggleExpanded(),
			}),
	},
	{
		accessorKey: "mealType",
		header: t("health.nutrition.title"),
		cell: ({ row }) => t(`health.mealTypes.${row.original.mealType}`),
	},
	{
		id: "composition",
		header: t("health.nutrition.product"),
		cell: ({ row }) => row.original.items.map((item) => item.title).join(", ") || "—",
	},
	{
		accessorKey: "kcal",
		header: t("health.targetKcal"),
		cell: ({ row }) => String(row.original.kcal),
	},
	{
		id: "macros",
		header: `${t("health.protein")} / ${t("health.fat")} / ${t("health.carbs")}`,
		cell: ({ row }) =>
			`${row.original.proteinG} / ${row.original.fatG} / ${row.original.carbsG}`,
	},
	{
		id: "actions",
		cell: ({ row }) =>
			h(
				"div",
				{ class: "text-right" },
				h(
					UDropdownMenu,
					{ content: { align: "end" }, items: getRowItems(row) },
					() =>
						h(UButton, {
							icon: "i-lucide-ellipsis-vertical",
							color: "neutral",
							variant: "ghost",
							class: "ml-auto",
							"aria-label": "Actions dropdown",
						}),
				),
			),
	},
];

function getRowItems(row: Row<IMeal>) {
	return [
		{
			label: t("buttons.delete"),
			icon: "i-lucide-trash-2",
			onSelect() {
				emit("delete", row.original.id);
			},
		},
	];
}
</script>

<template>
	<UTable v-model:expanded="expanded" class="w-full" :data="props.meals" :columns="columns">
		<template #expanded="{ row }">
			<div class="grid gap-1 py-2 pl-10 text-sm">
				<div v-for="item in row.original.items" :key="item.id" class="flex gap-4 text-gray-400">
					<span class="grow">{{ item.title }}</span>
					<span>{{ item.grams }} {{ $t("health.gram") }}</span>
					<span>{{ item.kcal }}</span>
					<span>{{ item.proteinG }} / {{ item.fatG }} / {{ item.carbsG }}</span>
				</div>
			</div>
		</template>
	</UTable>
</template>
```

- [ ] **Step 2: Карточка дня**

`frontend/app/components/health/NutritionDay.vue` — шапка с фактом, целью и отклонением, покрашенным по `status`, и таблица приёмов внутри:

```vue
<script setup lang="ts">
const props = defineProps<{
	day: INutritionDay;
}>();

const emit = defineEmits<{
	deleteMeal: [value: string];
}>();

const { locale } = useI18n();

const statusColor = computed((): UiColors => {
	if (props.day.status === EDeviationStatus.OnTarget) {
		return UiColors.success;
	}

	return props.day.status === EDeviationStatus.Over ? UiColors.error : UiColors.warning;
});

const label = computed((): string =>
	new Intl.DateTimeFormat(locale.value, {
		day: "2-digit",
		month: "long",
		timeZone: "UTC",
	}).format(new Date(props.day.date)),
);

const deviationLabel = computed((): string =>
	props.day.deviationKcal > 0 ? `+${props.day.deviationKcal}` : String(props.day.deviationKcal),
);
</script>

<template>
	<CommonCardWrapper>
		<template #header>
			<div class="flex flex-wrap items-baseline gap-3">
				<span class="capitalize">{{ label }}</span>

				<UBadge :color="statusColor" variant="subtle">
					{{ $t(`health.status.${props.day.status}`) }}
				</UBadge>

				<span class="text-sm font-normal text-gray-400">
					{{ props.day.fact.kcal }} / {{ props.day.target.kcal }} ({{ deviationLabel }})
				</span>
			</div>
		</template>

		<HealthMealsTable :meals="props.day.meals" @delete="emit('deleteMeal', $event)" />
	</CommonCardWrapper>
</template>
```

- [ ] **Step 3: Подключить на странице**

В `v-else`-ветке страницы, после `HealthNutritionTotals`:

```vue
				<p v-if="!log?.days.length" class="text-gray-400">
					{{ $t("health.nutrition.empty") }}
				</p>

				<HealthNutritionDay
					v-for="day in log?.days || []"
					:key="day.id"
					:day="day"
					@delete-meal="handleDeleteMeal"
				/>
```

Дни приходят с бэкенда свежими сверху — на клиенте не пересортировывать.

- [ ] **Step 4: Проверить и закоммитить**

Run: `cd frontend && npm run build`

```bash
git add frontend/app/components/health frontend/app/pages/health/nutrition/index.vue
git commit -m "feat(health): add the nutrition day cards and meals table"
```

---

### Task 11: Гранулярность и графики

**Files:**
- Create: `frontend/app/components/health/GranularitySwitcher.vue`
- Create: `frontend/app/components/health/CaloriesChart.vue`
- Create: `frontend/app/components/health/MacrosDonut.vue`
- Modify: `frontend/app/pages/health/nutrition/index.vue`

**Interfaces:**
- Consumes: `INutritionPoint`, `INutritionTotals`, `EGranularity`.
- Produces: `<HealthGranularitySwitcher v-model="granularity" />`, `<HealthCaloriesChart :points="..." />`, `<HealthMacrosDonut :totals="..." />`.

- [ ] **Step 1: Переключатель гранулярности**

`frontend/app/components/health/GranularitySwitcher.vue` — по образцу уже существующего `RangeSwitcher.vue`, но по значениям `EGranularity` и с подписями `health.granularity.*`. Тот же паттерн: `UButton` на вариант, `variant` зависит от совпадения с `modelValue`, наружу идёт `update:modelValue`.

- [ ] **Step 2: График калорий**

`frontend/app/components/health/CaloriesChart.vue` — `BarChart` из `nuxt-charts` с двумя категориями: факт и цель. Цель приходит с бэкенда отдельным полем на каждой точке (в библиотеке нет reference-линии, поэтому она рисуется как обычная серия). Пустое состояние — `health.nutrition.chartEmpty`, как в уже написанных `WeightChart.vue` / `MeasurementsChart.vue`; форматтер оси X индексирует `props.points` по номеру тика и обязан возвращать пустую строку, если точка не нашлась.

```vue
<script setup lang="ts">
const props = defineProps<{
	points: INutritionPoint[];
}>();

const { t, locale } = useI18n();

const categories = computed((): Record<string, BulletLegendItemInterface> => ({
	kcal: { name: t("health.nutrition.fact"), color: "#22c55e" },
	target: { name: t("health.nutrition.target"), color: "#64748b" },
}));

const hasData = computed((): boolean => props.points.length > 0);

function formatDate(tick: number): string {
	const point = props.points[Math.round(tick)];

	if (!point) {
		return "";
	}

	return new Intl.DateTimeFormat(locale.value, {
		day: "2-digit",
		month: "2-digit",
		timeZone: "UTC",
	}).format(new Date(point.date));
}

function formatKcal(tick: number): string {
	return String(Math.round(tick));
}
</script>

<template>
	<CommonCardWrapper>
		<template #header>{{ $t("health.nutrition.caloriesChartTitle") }}</template>

		<p v-if="!hasData" class="text-sm text-gray-500">{{ $t("health.nutrition.chartEmpty") }}</p>

		<BarChart
			v-else
			:data="props.points"
			:categories="categories"
			:height="320"
			:x-num-ticks="6"
			:legend-position="LegendPosition.TopLeft"
			:x-formatter="formatDate"
			:y-formatter="formatKcal"
		/>
	</CommonCardWrapper>
</template>
```

- [ ] **Step 3: Кольцо БЖУ**

`frontend/app/components/health/MacrosDonut.vue` — `DonutChart` по средним `avgProteinG` / `avgFatG` / `avgCarbsG` из `INutritionTotals`. Пустое состояние показывается, когда `totals.daysLogged === 0`. Проверьте по `README` пакета `nuxt-charts`, какой формат данных ждёт `DonutChart` (плоский массив чисел плюс отдельные подписи, а не массив объектов, как у линейных графиков) — не угадывайте, посмотрите.

- [ ] **Step 4: Подключить на странице**

Между `HealthNutritionTotals` и списком дней:

```vue
				<div class="grid gap-3">
					<HealthGranularitySwitcher v-model="granularity" />

					<div class="grid gap-6 lg:grid-cols-2 lg:items-start">
						<HealthCaloriesChart :points="log?.chart || []" />
						<HealthMacrosDonut v-if="log" :totals="log.totals" />
					</div>
				</div>
```

- [ ] **Step 5: Проверить и закоммитить**

Run: `cd frontend && npm run build`
Expected: сборка чистая; переключение день / неделя / месяц перерисовывает график калорий (гранулярность уходит в запрос параметром, агрегирует бэкенд).

```bash
git add frontend/app/components/health frontend/app/pages/health/nutrition/index.vue
git commit -m "feat(health): add calorie and macro charts with granularity"
```

---

### Task 12: Сборка вкладки и финальная проверка

**Files:**
- Modify: `frontend/app/pages/health/nutrition/index.vue`

**Interfaces:**
- Consumes: всё вышеперечисленное.
- Produces: законченную вкладку.

- [ ] **Step 1: Добавить переключатель периода**

На вкладке КБЖУ период выборки задаётся тем же `HealthRangeSwitcher`, что и на вкладке веса. Поставьте его рядом с `HealthGranularitySwitcher` над графиками — период определяет, сколько дней тянем, гранулярность — как их группируем:

```vue
				<div class="grid gap-3">
					<div class="flex flex-wrap items-center gap-4">
						<HealthRangeSwitcher v-model="rangeDays" />
						<HealthGranularitySwitcher v-model="granularity" />
					</div>
					...
```

- [ ] **Step 2: Полная проверка**

```bash
cd backend && npm test && npm run build
cd frontend && npm run build
```
Expected: вся сюита бэкенда зелёная, обе сборки чистые.

Проверьте паритет ключей локалей той же командой, что в Task 7 Step 5 — оба списка должны быть пустыми.

- [ ] **Step 3: Коммит**

```bash
git add frontend/app/pages/health/nutrition/index.vue
git commit -m "feat(health): finish the nutrition tab"
```

---

## Что этот план не покрывает

Создание и правка продуктов из интерфейса — справочник пополняется сидом (решение владельца).
Правка состава приёма из интерфейса: `PATCH /health/nutrition/meals/:mealId` реализован и
покрыт тестами, но кнопки на него в этой версии нет — приём удаляется и вносится заново.
Кнопки «пересчитать цели за период» на `POST /health/nutrition/apply-targets` тоже нет, сам
эндпоинт готов. Обе — кандидаты в следующий шаг, если понадобятся.

Известные ограничения, унаследованные от предыдущей ветки и не чинимые здесь: в карточке
нормы четыре числа перестают сходиться, когда цель упирается в безопасный минимум; форму
правки записи веса заменяет upsert по дате.
