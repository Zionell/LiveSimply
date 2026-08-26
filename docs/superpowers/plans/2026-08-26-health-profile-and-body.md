# Health: профиль и вкладка «Вес и параметры тела» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Раздел «Здоровье» с рабочим профилем расчёта нормы и вкладкой «Вес и параметры тела»: карточки прогресса, дневной лог веса и обхватов, два графика.

**Architecture:** Новый модуль `backend/src/health/` по образцу `planner/`: контроллеры → сервисы → `PrismaService`, вся арифметика в чистом калькуляторе и серализаторах, покрытых jest. Фронт — новый раздел `/health/body` на Nuxt UI и `nuxt-charts`, типы вручную зеркалят серализаторы в `shared/types/health.ts`.

**Tech Stack:** NestJS 11, Prisma 6 (MongoDB), class-validator, jest; Nuxt 4, Nuxt UI 4, nuxt-charts, Zod (только в модалках), @nuxtjs/i18n.

**Spec:** `docs/superpowers/specs/2026-08-26-health-module-design.md`

## Global Constraints

- **База — MongoDB.** Миграций нет: изменения схемы применяются `npx prisma db push`.
- **Енумов в Prisma нет.** В схеме `String`, значения — TS-енумы в `backend/types/health.ts` и `frontend/shared/types/health.ts`.
- **FK новых моделей помечаем `@db.ObjectId`.** Старые модели этого не делают и дают предупреждения `prisma validate` («will become an error in the future») — новые их плодить не должны.
- **Валидация на бэке — class-validator DTO** с `@ApiProperty`. Zod используется только во фронтовых модалках для `UForm`.
- **Вся арифметика и округления — в калькуляторе и серализаторах.** Фронт не считает ничего, кроме предпросмотра в формах.
- **Типы фронта пишутся руками** в `frontend/shared/types/health.ts` как зеркало `ISerialized*`. Они авто-импортируются, `import` не нужен.
- **Графики — только `nuxt-charts`.** Вторую библиотеку не добавлять.
- **Правка данных — только через slide-over** `ModalsBaseSlideOver`. Инлайн-редактирование `UTable` не вводить.
- **Каждая новая строка интерфейса — в обе локали**, `frontend/i18n/locales/en.json` и `ru.json`.
- **Отступы — табы**, как во всём проекте. Кавычки двойные, точки с запятой обязательны.
- **Тесты есть только на бэке** (`jest`, файлы `*.spec.ts`, запуск `npm test`). Во фронте тест-раннера в проекте нет — задачи 7–12 проверяются вручную по шагам «Expected», и это осознанное ограничение, а не пропуск.
- Уровень активности: `sedentary` ×1.2, `light` ×1.375, `moderate` ×1.55, `high` ×1.725. Безопасный минимум калорий: 1500 муж / 1200 жен.

---

### Task 1: Енумы и калькулятор нормы

**Files:**
- Create: `backend/types/health.ts`
- Create: `backend/src/health/health.calculator.ts`
- Test: `backend/src/health/health.calculator.spec.ts`

**Interfaces:**
- Consumes: ничего.
- Produces: `EHealthSex`, `EActivityLevel`, `EProteinBasis`, `ACTIVITY_FACTORS`, `SAFE_MIN_KCAL`, `KCAL_PER_G`, `calcAge(birthDate: Date, now?: Date): number`, `calcBmr({ sex, weightKg, heightCm, age }): number`, `calcTdee(bmr: number, activityLevel: EActivityLevel): number`, `calcTargetKcal(tdee: number, dailyDeficit: number, sex: EHealthSex): number`, `calcMacroTargets(input: IMacroInput): IMacroTargets`, `calcProgress(start: number, current: number, target: number): number`.

- [ ] **Step 1: Создать енумы**

`backend/types/health.ts`:

```ts
export enum EHealthSex {
	Male = "male",
	Female = "female",
}

export enum EActivityLevel {
	Sedentary = "sedentary",
	Light = "light",
	Moderate = "moderate",
	High = "high",
}

export enum EProteinBasis {
	Current = "current",
	Target = "target",
}
```

- [ ] **Step 2: Написать падающий тест**

`backend/src/health/health.calculator.spec.ts`:

```ts
import { EActivityLevel, EHealthSex, EProteinBasis } from "../../types/health";
import {
	calcAge,
	calcBmr,
	calcMacroTargets,
	calcProgress,
	calcTargetKcal,
	calcTdee,
} from "./health.calculator";

describe("health calculator", () => {
	describe("calcAge", () => {
		it("does not count a birthday that has not happened yet this year", () => {
			const age = calcAge(
				new Date("1996-08-27T00:00:00.000Z"),
				new Date("2026-08-26T00:00:00.000Z")
			);

			expect(age).toBe(29);
		});

		it("counts the birthday on the day itself", () => {
			const age = calcAge(
				new Date("1996-08-26T00:00:00.000Z"),
				new Date("2026-08-26T00:00:00.000Z")
			);

			expect(age).toBe(30);
		});
	});

	describe("calcBmr", () => {
		it("matches the Mifflin-St Jeor value from the reference spreadsheet", () => {
			expect(
				calcBmr({
					sex: EHealthSex.Male,
					weightKg: 75,
					heightCm: 160,
					age: 30,
				})
			).toBe(1605);
		});

		it("applies the female constant", () => {
			expect(
				calcBmr({
					sex: EHealthSex.Female,
					weightKg: 75,
					heightCm: 160,
					age: 30,
				})
			).toBe(1439);
		});
	});

	describe("calcTdee", () => {
		it("multiplies by the activity factor and rounds like the spreadsheet", () => {
			expect(calcTdee(1605, EActivityLevel.Light)).toBe(2207);
		});
	});

	describe("calcTargetKcal", () => {
		it("subtracts the deficit", () => {
			expect(calcTargetKcal(2207, 500, EHealthSex.Male)).toBe(1707);
		});

		it("never goes below the safe floor for the sex", () => {
			expect(calcTargetKcal(1500, 500, EHealthSex.Female)).toBe(1200);
			expect(calcTargetKcal(1600, 500, EHealthSex.Male)).toBe(1500);
		});
	});

	describe("calcMacroTargets", () => {
		it("takes protein from weight, fat from a share of calories and leaves carbs the remainder", () => {
			expect(
				calcMacroTargets({
					targetKcal: 1707,
					proteinPerKg: 1.8,
					proteinBasis: EProteinBasis.Current,
					currentWeightKg: 75,
					targetWeightKg: 66,
					fatPercent: 0.3,
				})
			).toEqual({
				proteinG: 135,
				fatG: 56.9,
				carbsG: 163.7,
				isMacroConflict: false,
			});
		});

		it("counts protein from the target weight when the basis says so", () => {
			const result = calcMacroTargets({
				targetKcal: 1707,
				proteinPerKg: 1.8,
				proteinBasis: EProteinBasis.Target,
				currentWeightKg: 75,
				targetWeightKg: 66,
				fatPercent: 0.3,
			});

			expect(result.proteinG).toBe(118.8);
		});

		it("clamps carbs at zero and flags the conflict instead of returning a negative", () => {
			const result = calcMacroTargets({
				targetKcal: 1200,
				proteinPerKg: 2.2,
				proteinBasis: EProteinBasis.Current,
				currentWeightKg: 100,
				targetWeightKg: 80,
				fatPercent: 0.3,
			});

			expect(result.carbsG).toBe(0);
			expect(result.isMacroConflict).toBe(true);
		});
	});

	describe("calcProgress", () => {
		it("reports the share of the planned loss already done", () => {
			expect(calcProgress(75, 71, 66)).toBe(0.44);
		});

		it("returns zero when start equals target instead of dividing by zero", () => {
			expect(calcProgress(66, 66, 66)).toBe(0);
		});
	});
});
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `cd backend && npm test -- src/health/health.calculator.spec.ts`
Expected: FAIL — `Cannot find module './health.calculator'`.

- [ ] **Step 4: Реализовать калькулятор**

`backend/src/health/health.calculator.ts`:

```ts
import { EActivityLevel, EHealthSex, EProteinBasis } from "../../types/health";

export const ACTIVITY_FACTORS: Record<EActivityLevel, number> = {
	[EActivityLevel.Sedentary]: 1.2,
	[EActivityLevel.Light]: 1.375,
	[EActivityLevel.Moderate]: 1.55,
	[EActivityLevel.High]: 1.725,
};

/**
 * Нижние границы из референсного дневника: цель по калориям не опускается
 * ниже них, какой бы дефицит пользователь ни выставил.
 */
export const SAFE_MIN_KCAL: Record<EHealthSex, number> = {
	[EHealthSex.Male]: 1500,
	[EHealthSex.Female]: 1200,
};

export const KCAL_PER_G = {
	protein: 4,
	fat: 9,
	carbs: 4,
} as const;

export interface IBmrInput {
	sex: EHealthSex;
	weightKg: number;
	heightCm: number;
	age: number;
}

export interface IMacroInput {
	targetKcal: number;
	proteinPerKg: number;
	proteinBasis: EProteinBasis;
	currentWeightKg: number;
	targetWeightKg: number;
	fatPercent: number;
}

export interface IMacroTargets {
	proteinG: number;
	fatG: number;
	carbsG: number;
	isMacroConflict: boolean;
}

const round1 = (value: number): number => +value.toFixed(1);
const round2 = (value: number): number => +value.toFixed(2);

export const calcAge = (birthDate: Date, now: Date = new Date()): number => {
	const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
	const isBeforeBirthday =
		monthDiff < 0 ||
		(monthDiff === 0 && now.getUTCDate() < birthDate.getUTCDate());

	const age =
		now.getUTCFullYear() -
		birthDate.getUTCFullYear() -
		(isBeforeBirthday ? 1 : 0);

	return Math.max(age, 0);
};

export const calcBmr = ({ sex, weightKg, heightCm, age }: IBmrInput): number => {
	const base = 10 * weightKg + 6.25 * heightCm - 5 * age;

	return Math.round(sex === EHealthSex.Male ? base + 5 : base - 161);
};

export const calcTdee = (
	bmr: number,
	activityLevel: EActivityLevel
): number => Math.round(bmr * ACTIVITY_FACTORS[activityLevel]);

export const calcTargetKcal = (
	tdee: number,
	dailyDeficit: number,
	sex: EHealthSex
): number => Math.max(tdee - dailyDeficit, SAFE_MIN_KCAL[sex]);

export const calcMacroTargets = ({
	targetKcal,
	proteinPerKg,
	proteinBasis,
	currentWeightKg,
	targetWeightKg,
	fatPercent,
}: IMacroInput): IMacroTargets => {
	const basisWeight =
		proteinBasis === EProteinBasis.Target ? targetWeightKg : currentWeightKg;

	const proteinG = round1(proteinPerKg * basisWeight);
	const fatG = round1((targetKcal * fatPercent) / KCAL_PER_G.fat);

	const carbsKcal =
		targetKcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat;

	return {
		proteinG,
		fatG,
		carbsG: carbsKcal > 0 ? round1(carbsKcal / KCAL_PER_G.carbs) : 0,
		isMacroConflict: carbsKcal <= 0,
	};
};

export const calcProgress = (
	startWeightKg: number,
	currentWeightKg: number,
	targetWeightKg: number
): number => {
	const planned = startWeightKg - targetWeightKg;

	if (planned === 0) {
		return 0;
	}

	return round2((startWeightKg - currentWeightKg) / planned);
};
```

- [ ] **Step 5: Прогнать тесты**

Run: `cd backend && npm test -- src/health/health.calculator.spec.ts`
Expected: PASS, 11 тестов.

- [ ] **Step 6: Коммит**

```bash
git add backend/types/health.ts backend/src/health/health.calculator.ts backend/src/health/health.calculator.spec.ts
git commit -m "feat(health): add calorie and macro calculator"
```

---

### Task 2: Модели Prisma

**Files:**
- Modify: `backend/prisma/schema.prisma` (модель `User` — добавить обратные связи; в конец файла — две новые модели)

**Interfaces:**
- Consumes: ничего.
- Produces: модели `HealthProfile` и `HealthBodyEntry` в сгенерированном клиенте — `prismaService.healthProfile`, `prismaService.healthBodyEntry`.

- [ ] **Step 1: Добавить обратные связи в модель `User`**

В `model User`, сразу после строки `notifications  Notification[]`:

```prisma
	healthProfile     HealthProfile?
	healthBodyEntries HealthBodyEntry[]
```

- [ ] **Step 2: Добавить модели в конец `schema.prisma`**

```prisma
model HealthProfile {
	id     String @id @default(auto()) @map("_id") @db.ObjectId
	userId String @unique @db.ObjectId

	sex           String
	birthDate     DateTime
	heightCm      Float
	activityLevel String

	startWeightKg  Float
	targetWeightKg Float
	startedAt      DateTime

	dailyDeficit Int @default(500)

	proteinPerKg Float  @default(1.8)
	proteinBasis String @default("current")
	fatPercent   Float  @default(0.3)

	user User @relation(fields: [userId], references: [id], onDelete: Cascade)

	createdAt DateTime  @default(now())
	updatedAt DateTime? @default(now())
}

model HealthBodyEntry {
	id     String @id @default(auto()) @map("_id") @db.ObjectId
	userId String @db.ObjectId

	date     DateTime
	weightKg Float?
	chestCm  Float?
	waistCm  Float?
	armCm    Float?
	note     String?

	user User @relation(fields: [userId], references: [id], onDelete: Cascade)

	createdAt DateTime  @default(now())
	updatedAt DateTime? @default(now())

	@@unique([userId, date])
}
```

- [ ] **Step 3: Проверить схему**

Run: `cd backend && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`. В списке предупреждений **не должно быть** строк со словами `HealthProfile` или `HealthBodyEntry` — если они там есть, значит на `userId` забыли `@db.ObjectId`.

- [ ] **Step 4: Сгенерировать клиент и применить схему**

Убедиться, что `DATABASE_URL` в `backend/.env` указывает на дев-базу, затем:

```bash
cd backend && npm run prisma-generate && npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema`. Операция аддитивная — создаются две новые коллекции и уникальный индекс, существующие данные не трогаются.

- [ ] **Step 5: Убедиться, что проект собирается**

Run: `cd backend && npm run build`
Expected: сборка без ошибок.

- [ ] **Step 6: Коммит**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(health): add HealthProfile and HealthBodyEntry models"
```

---

### Task 3: Серализатор профиля

**Files:**
- Create: `backend/src/health/serializer/health-profile.serializer.ts`
- Test: `backend/src/health/serializer/health-profile.serializer.spec.ts`

**Interfaces:**
- Consumes: `calcAge`, `calcBmr`, `calcTdee`, `calcTargetKcal`, `calcMacroTargets`, `calcProgress` из Task 1.
- Produces: `ISerializedHealthProfile`, `INotConfiguredProfile`, `TSerializedProfileResponse`, `HealthProfileSerializer.serialize(profile: Record<string, any>, currentWeightKg: number, now?: Date): ISerializedHealthProfile`.

- [ ] **Step 1: Написать падающий тест**

`backend/src/health/serializer/health-profile.serializer.spec.ts`:

```ts
import { HealthProfileSerializer } from "./health-profile.serializer";

const profileRecord = (overrides: Record<string, unknown> = {}) => ({
	id: "p1",
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

const NOW = new Date("2026-08-26T00:00:00.000Z");

describe("HealthProfileSerializer", () => {
	it("reproduces the whole chain from the reference spreadsheet", () => {
		const result = HealthProfileSerializer.serialize(
			profileRecord(),
			75,
			NOW
		);

		expect(result.age).toBe(30);
		expect(result.bmr).toBe(1605);
		expect(result.tdee).toBe(2207);
		expect(result.targetKcal).toBe(1707);
	});

	it("recomputes the norm from the current weight, not the start weight", () => {
		const result = HealthProfileSerializer.serialize(
			profileRecord(),
			70,
			NOW
		);

		expect(result.bmr).toBe(1555);
		expect(result.currentWeightKg).toBe(70);
	});

	it("reports lost and remaining kilograms rounded to two decimals", () => {
		const result = HealthProfileSerializer.serialize(
			profileRecord(),
			71.25,
			NOW
		);

		expect(result.lostKg).toBe(3.75);
		expect(result.remainingKg).toBe(5.25);
		expect(result.progress).toBe(0.42);
	});

	it("lets remaining go negative when the target is already beaten", () => {
		const result = HealthProfileSerializer.serialize(
			profileRecord(),
			64,
			NOW
		);

		expect(result.remainingKg).toBe(-2);
	});

	it("passes the macro conflict flag through", () => {
		const result = HealthProfileSerializer.serialize(
			profileRecord({ proteinPerKg: 2.2, dailyDeficit: 1500 }),
			100,
			NOW
		);

		expect(result.isMacroConflict).toBe(true);
		expect(result.macroTargets.carbsG).toBe(0);
	});

	it("emits dates as plain ISO days so the client never parses timestamps", () => {
		const result = HealthProfileSerializer.serialize(
			profileRecord(),
			75,
			NOW
		);

		expect(result.birthDate).toBe("1996-08-26");
		expect(result.startedAt).toBe("2026-08-26");
		expect(result.isConfigured).toBe(true);
	});
});
```

Проверка ожиданий: BMR при 70 кг = 10·70 + 6.25·160 − 5·30 + 5 = 1555. Прогресс при 71.25: (75 − 71.25) / 9 = 0.4166… → 0.42.

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd backend && npm test -- src/health/serializer/health-profile.serializer.spec.ts`
Expected: FAIL — `Cannot find module './health-profile.serializer'`.

- [ ] **Step 3: Реализовать серализатор**

`backend/src/health/serializer/health-profile.serializer.ts`:

```ts
import {
	EActivityLevel,
	EHealthSex,
	EProteinBasis,
} from "../../../types/health";
import {
	calcAge,
	calcBmr,
	calcMacroTargets,
	calcProgress,
	calcTargetKcal,
	calcTdee,
} from "../health.calculator";

export interface ISerializedMacroTargets {
	proteinG: number;
	fatG: number;
	carbsG: number;
}

export interface ISerializedHealthProfile {
	isConfigured: true;
	id: string;
	sex: EHealthSex;
	birthDate: string;
	heightCm: number;
	activityLevel: EActivityLevel;
	startWeightKg: number;
	targetWeightKg: number;
	startedAt: string;
	dailyDeficit: number;
	proteinPerKg: number;
	proteinBasis: EProteinBasis;
	fatPercent: number;
	age: number;
	currentWeightKg: number;
	lostKg: number;
	remainingKg: number;
	progress: number;
	bmr: number;
	tdee: number;
	targetKcal: number;
	macroTargets: ISerializedMacroTargets;
	isMacroConflict: boolean;
}

export interface INotConfiguredProfile {
	isConfigured: false;
}

export type TSerializedProfileResponse =
	| ISerializedHealthProfile
	| INotConfiguredProfile;

const round2 = (value: number): number => +value.toFixed(2);

export const toIsoDay = (date: Date): string =>
	date.toISOString().slice(0, 10);

export class HealthProfileSerializer {
	static serialize(
		profile: Record<string, any>,
		currentWeightKg: number,
		now: Date = new Date()
	): ISerializedHealthProfile {
		const sex = profile.sex as EHealthSex;
		const age = calcAge(profile.birthDate, now);

		const bmr = calcBmr({
			sex,
			weightKg: currentWeightKg,
			heightCm: profile.heightCm,
			age,
		});
		const tdee = calcTdee(bmr, profile.activityLevel as EActivityLevel);
		const targetKcal = calcTargetKcal(tdee, profile.dailyDeficit, sex);

		const { proteinG, fatG, carbsG, isMacroConflict } = calcMacroTargets({
			targetKcal,
			proteinPerKg: profile.proteinPerKg,
			proteinBasis: profile.proteinBasis as EProteinBasis,
			currentWeightKg,
			targetWeightKg: profile.targetWeightKg,
			fatPercent: profile.fatPercent,
		});

		return {
			isConfigured: true,
			id: profile.id,
			sex,
			birthDate: toIsoDay(profile.birthDate),
			heightCm: profile.heightCm,
			activityLevel: profile.activityLevel as EActivityLevel,
			startWeightKg: profile.startWeightKg,
			targetWeightKg: profile.targetWeightKg,
			startedAt: toIsoDay(profile.startedAt),
			dailyDeficit: profile.dailyDeficit,
			proteinPerKg: profile.proteinPerKg,
			proteinBasis: profile.proteinBasis as EProteinBasis,
			fatPercent: profile.fatPercent,
			age,
			currentWeightKg,
			lostKg: round2(profile.startWeightKg - currentWeightKg),
			remainingKg: round2(currentWeightKg - profile.targetWeightKg),
			progress: calcProgress(
				profile.startWeightKg,
				currentWeightKg,
				profile.targetWeightKg
			),
			bmr,
			tdee,
			targetKcal,
			macroTargets: { proteinG, fatG, carbsG },
			isMacroConflict,
		};
	}
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `cd backend && npm test -- src/health/serializer/health-profile.serializer.spec.ts`
Expected: PASS, 6 тестов.

- [ ] **Step 5: Коммит**

```bash
git add backend/src/health/serializer/health-profile.serializer.ts backend/src/health/serializer/health-profile.serializer.spec.ts
git commit -m "feat(health): serialize the health profile with computed norms"
```

---

### Task 4: Сервис, DTO и контроллер профиля

**Files:**
- Create: `backend/src/health/dto/create-health-profile.dto.ts`
- Create: `backend/src/health/dto/update-health-profile.dto.ts`
- Create: `backend/src/health/health-profile.service.ts`
- Create: `backend/src/health/health-profile.controller.ts`
- Create: `backend/src/health/health.module.ts`
- Test: `backend/src/health/health-profile.service.spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `HealthProfileSerializer` из Task 3, модели из Task 2.
- Produces: `HealthProfileService` с `loadProfile(userId)`, `currentWeight(userId, startWeightKg)`, `get(req)`, `create(dto, req)`, `update(dto, req)`; `HealthModule`; маршруты `GET|POST|PATCH /api/v2/health/profile`.

- [ ] **Step 1: Написать DTO**

`backend/src/health/dto/create-health-profile.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import {
	IsDateString,
	IsEnum,
	IsInt,
	IsNumber,
	IsOptional,
	Max,
	Min,
} from "class-validator";
import {
	EActivityLevel,
	EHealthSex,
	EProteinBasis,
} from "../../../types/health";

export class CreateHealthProfileDto {
	@ApiProperty({ enum: EHealthSex })
	@IsEnum(EHealthSex)
	sex: EHealthSex;

	@ApiProperty()
	@IsDateString()
	birthDate: string;

	@ApiProperty()
	@IsNumber()
	@Min(50)
	@Max(260)
	heightCm: number;

	@ApiProperty({ enum: EActivityLevel })
	@IsEnum(EActivityLevel)
	activityLevel: EActivityLevel;

	@ApiProperty()
	@IsNumber()
	@Min(20)
	@Max(500)
	startWeightKg: number;

	@ApiProperty()
	@IsNumber()
	@Min(20)
	@Max(500)
	targetWeightKg: number;

	@ApiProperty()
	@IsDateString()
	startedAt: string;

	@ApiProperty({ required: false, default: 500 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(1500)
	dailyDeficit?: number;

	@ApiProperty({ required: false, default: 1.8 })
	@IsOptional()
	@IsNumber()
	@Min(0.5)
	@Max(4)
	proteinPerKg?: number;

	@ApiProperty({ required: false, enum: EProteinBasis })
	@IsOptional()
	@IsEnum(EProteinBasis)
	proteinBasis?: EProteinBasis;

	@ApiProperty({ required: false, default: 0.3 })
	@IsOptional()
	@IsNumber()
	@Min(0.15)
	@Max(0.6)
	fatPercent?: number;
}
```

`backend/src/health/dto/update-health-profile.dto.ts` — те же поля, все необязательные:

```ts
import { ApiProperty } from "@nestjs/swagger";
import {
	IsDateString,
	IsEnum,
	IsInt,
	IsNumber,
	IsOptional,
	Max,
	Min,
} from "class-validator";
import {
	EActivityLevel,
	EHealthSex,
	EProteinBasis,
} from "../../../types/health";

export class UpdateHealthProfileDto {
	@ApiProperty({ required: false, enum: EHealthSex })
	@IsOptional()
	@IsEnum(EHealthSex)
	sex?: EHealthSex;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsDateString()
	birthDate?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(50)
	@Max(260)
	heightCm?: number;

	@ApiProperty({ required: false, enum: EActivityLevel })
	@IsOptional()
	@IsEnum(EActivityLevel)
	activityLevel?: EActivityLevel;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(20)
	@Max(500)
	startWeightKg?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(20)
	@Max(500)
	targetWeightKg?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsDateString()
	startedAt?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(1500)
	dailyDeficit?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0.5)
	@Max(4)
	proteinPerKg?: number;

	@ApiProperty({ required: false, enum: EProteinBasis })
	@IsOptional()
	@IsEnum(EProteinBasis)
	proteinBasis?: EProteinBasis;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0.15)
	@Max(0.6)
	fatPercent?: number;
}
```

- [ ] **Step 2: Написать падающий тест сервиса**

`backend/src/health/health-profile.service.spec.ts`:

```ts
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
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `cd backend && npm test -- src/health/health-profile.service.spec.ts`
Expected: FAIL — `Cannot find module './health-profile.service'`.

- [ ] **Step 4: Реализовать сервис**

`backend/src/health/health-profile.service.ts`:

```ts
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
```

- [ ] **Step 5: Прогнать тесты**

Run: `cd backend && npm test -- src/health/health-profile.service.spec.ts`
Expected: PASS, 7 тестов.

- [ ] **Step 6: Контроллер и модуль**

`backend/src/health/health-profile.controller.ts`:

```ts
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Patch,
	Post,
	Req,
	UsePipes,
	ValidationPipe,
} from "@nestjs/common";
import { type Request } from "express";
import { HealthProfileService } from "./health-profile.service";
import { CreateHealthProfileDto } from "./dto/create-health-profile.dto";
import { UpdateHealthProfileDto } from "./dto/update-health-profile.dto";

@Controller("health/profile")
@UsePipes(new ValidationPipe({ transform: true }))
export class HealthProfileController {
	constructor(private readonly healthProfileService: HealthProfileService) {}

	@Get()
	get(@Req() req: Request) {
		return this.healthProfileService.get(req);
	}

	@HttpCode(HttpStatus.CREATED)
	@Post()
	create(@Body() dto: CreateHealthProfileDto, @Req() req: Request) {
		return this.healthProfileService.create(dto, req);
	}

	@Patch()
	update(@Body() dto: UpdateHealthProfileDto, @Req() req: Request) {
		return this.healthProfileService.update(dto, req);
	}
}
```

`backend/src/health/health.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { HealthProfileService } from "./health-profile.service";
import { HealthProfileController } from "./health-profile.controller";

@Module({
	controllers: [HealthProfileController],
	providers: [HealthProfileService],
	exports: [HealthProfileService],
})
export class HealthModule {}
```

В `backend/src/app.module.ts` добавить импорт рядом с `PlannerModule`:

```ts
import { HealthModule } from "./health/health.module";
```

и `HealthModule,` в массив `imports` после `PlannerModule,`.

- [ ] **Step 7: Проверить маршрут вручную**

Запустить `cd backend && npm run start:dev`, залогиниться во фронте, чтобы получить cookie, и открыть `http://localhost:8000/api/v2/health/profile`.
Expected: `{"isConfigured":false}` для пользователя без профиля.

- [ ] **Step 8: Коммит**

```bash
git add backend/src/health backend/src/app.module.ts
git commit -m "feat(health): add health profile endpoints"
```

---

### Task 5: Серализатор лога тела

**Files:**
- Create: `backend/src/health/serializer/health-body.serializer.ts`
- Test: `backend/src/health/serializer/health-body.serializer.spec.ts`

**Interfaces:**
- Consumes: `toIsoDay` из Task 3.
- Produces: `ISerializedBodyEntry`, `ISerializedWeightPoint`, `ISerializedMeasurementPoint`, `ISerializedBodyLog`, `HealthBodySerializer.serialize(records: Record<string, any>[], targetWeightKg: number): ISerializedBodyLog`.

- [ ] **Step 1: Написать падающий тест**

`backend/src/health/serializer/health-body.serializer.spec.ts`:

```ts
import { HealthBodySerializer } from "./health-body.serializer";

const entry = (overrides: Record<string, unknown> = {}) => ({
	id: "e1",
	date: new Date("2026-08-24T00:00:00.000Z"),
	weightKg: 74,
	chestCm: null,
	waistCm: null,
	armCm: null,
	note: null,
	...overrides,
});

describe("HealthBodySerializer", () => {
	it("keeps only weighed days on the weight chart and stamps every point with the target", () => {
		const result = HealthBodySerializer.serialize(
			[
				entry(),
				entry({
					id: "e2",
					date: new Date("2026-08-25T00:00:00.000Z"),
					weightKg: null,
					waistCm: 88,
				}),
			],
			66
		);

		expect(result.weightChart).toEqual([
			{ date: "2026-08-24", weight: 74, target: 66 },
		]);
	});

	it("puts a measurement-only day on the measurement chart", () => {
		const result = HealthBodySerializer.serialize(
			[
				entry({
					id: "e2",
					date: new Date("2026-08-25T00:00:00.000Z"),
					weightKg: null,
					waistCm: 88,
				}),
			],
			66
		);

		expect(result.measurementChart).toEqual([
			{ date: "2026-08-25", chest: null, waist: 88, arm: null },
		]);
	});

	it("leaves a weight-only day out of the measurement chart", () => {
		const result = HealthBodySerializer.serialize([entry()], 66);

		expect(result.measurementChart).toEqual([]);
	});

	it("returns entries newest first while the charts stay chronological", () => {
		const result = HealthBodySerializer.serialize(
			[
				entry(),
				entry({
					id: "e2",
					date: new Date("2026-08-25T00:00:00.000Z"),
					weightKg: 73.5,
				}),
			],
			66
		);

		expect(result.entries.map((item) => item.date)).toEqual([
			"2026-08-25",
			"2026-08-24",
		]);
		expect(result.weightChart.map((point) => point.date)).toEqual([
			"2026-08-24",
			"2026-08-25",
		]);
	});
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd backend && npm test -- src/health/serializer/health-body.serializer.spec.ts`
Expected: FAIL — `Cannot find module './health-body.serializer'`.

- [ ] **Step 3: Реализовать серализатор**

`backend/src/health/serializer/health-body.serializer.ts`:

```ts
import { toIsoDay } from "./health-profile.serializer";

export interface ISerializedBodyEntry {
	id: string;
	date: string;
	weightKg: number | null;
	chestCm: number | null;
	waistCm: number | null;
	armCm: number | null;
	note: string | null;
}

export interface ISerializedWeightPoint {
	date: string;
	weight: number;
	target: number;
}

export interface ISerializedMeasurementPoint {
	date: string;
	chest: number | null;
	waist: number | null;
	arm: number | null;
}

export interface ISerializedBodyLog {
	entries: ISerializedBodyEntry[];
	weightChart: ISerializedWeightPoint[];
	measurementChart: ISerializedMeasurementPoint[];
}

const hasMeasurement = (record: Record<string, any>): boolean =>
	record.chestCm !== null || record.waistCm !== null || record.armCm !== null;

export class HealthBodySerializer {
	/**
	 * На вход приходят записи по возрастанию даты: графики читаются слева
	 * направо, а таблица — сверху вниз от свежего, поэтому список переворачивается.
	 */
	static serialize(
		records: Record<string, any>[],
		targetWeightKg: number
	): ISerializedBodyLog {
		const entries: ISerializedBodyEntry[] = records.map((record) => ({
			id: record.id,
			date: toIsoDay(record.date),
			weightKg: record.weightKg ?? null,
			chestCm: record.chestCm ?? null,
			waistCm: record.waistCm ?? null,
			armCm: record.armCm ?? null,
			note: record.note ?? null,
		}));

		return {
			entries: [...entries].reverse(),
			weightChart: records
				.filter((record) => record.weightKg !== null)
				.map((record) => ({
					date: toIsoDay(record.date),
					weight: record.weightKg,
					target: targetWeightKg,
				})),
			measurementChart: records.filter(hasMeasurement).map((record) => ({
				date: toIsoDay(record.date),
				chest: record.chestCm ?? null,
				waist: record.waistCm ?? null,
				arm: record.armCm ?? null,
			})),
		};
	}
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `cd backend && npm test -- src/health/serializer/health-body.serializer.spec.ts`
Expected: PASS, 4 теста.

- [ ] **Step 5: Коммит**

```bash
git add backend/src/health/serializer/health-body.serializer.ts backend/src/health/serializer/health-body.serializer.spec.ts
git commit -m "feat(health): serialize the body log and its chart series"
```

---

### Task 6: Сервис, DTO и контроллер лога тела

**Files:**
- Create: `backend/src/health/dto/find-health-range.dto.ts`
- Create: `backend/src/health/dto/upsert-body-entry.dto.ts`
- Create: `backend/src/health/dto/update-body-entry.dto.ts`
- Create: `backend/src/health/health-body.service.ts`
- Create: `backend/src/health/health-body.controller.ts`
- Test: `backend/src/health/health-body.service.spec.ts`
- Modify: `backend/utils/date.ts`
- Modify: `backend/utils/date.spec.ts`
- Modify: `backend/src/health/health.module.ts`

**Interfaces:**
- Consumes: `HealthBodySerializer` (Task 5), `HealthProfileService` (Task 4), `startOfUtcDay` из `backend/utils/date.ts`.
- Produces: `addUtcDays(date: Date, days: number): Date`; `HealthBodyService` с `list(dto, req)`, `upsert(dto, req)`, `update(id, dto, req)`, `remove(id, req)`; маршруты `GET|POST /api/v2/health/body`, `PATCH|DELETE /api/v2/health/body/:id`.

- [ ] **Step 1: Тест на хелпер дат**

В конец `backend/utils/date.spec.ts` добавить (импорт `addUtcDays` дописать к существующему импорту из `./date`):

```ts
describe("addUtcDays", () => {
	it("shifts forward across a month boundary", () => {
		expect(addUtcDays(new Date("2026-08-30T00:00:00.000Z"), 3)).toEqual(
			new Date("2026-09-02T00:00:00.000Z")
		);
	});

	it("shifts backwards with a negative step", () => {
		expect(addUtcDays(new Date("2026-08-01T00:00:00.000Z"), -1)).toEqual(
			new Date("2026-07-31T00:00:00.000Z")
		);
	});

	it("does not mutate the date it was given", () => {
		const original = new Date("2026-08-01T00:00:00.000Z");

		addUtcDays(original, 5);

		expect(original).toEqual(new Date("2026-08-01T00:00:00.000Z"));
	});
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd backend && npm test -- utils/date.spec.ts`
Expected: FAIL — `addUtcDays is not defined`.

- [ ] **Step 3: Реализовать хелпер**

В конец `backend/utils/date.ts`:

```ts
export const addUtcDays = (date: Date, days: number): Date => {
	return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
};
```

Run: `cd backend && npm test -- utils/date.spec.ts`
Expected: PASS.

- [ ] **Step 4: Написать DTO**

`backend/src/health/dto/find-health-range.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

export class FindHealthRangeDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsDateString()
	from?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsDateString()
	to?: string;
}
```

`backend/src/health/dto/upsert-body-entry.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import {
	IsDateString,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from "class-validator";

export class UpsertBodyEntryDto {
	@ApiProperty()
	@IsDateString()
	date: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(20)
	@Max(500)
	weightKg?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(10)
	@Max(300)
	chestCm?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(10)
	@Max(300)
	waistCm?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(10)
	@Max(300)
	armCm?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	note?: string;
}
```

`backend/src/health/dto/update-body-entry.dto.ts` — то же самое без `date`:

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

export class UpdateBodyEntryDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(20)
	@Max(500)
	weightKg?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(10)
	@Max(300)
	chestCm?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(10)
	@Max(300)
	waistCm?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(10)
	@Max(300)
	armCm?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	note?: string;
}
```

- [ ] **Step 5: Написать падающий тест сервиса**

`backend/src/health/health-body.service.spec.ts`:

```ts
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
```

- [ ] **Step 6: Убедиться, что тест падает**

Run: `cd backend && npm test -- src/health/health-body.service.spec.ts`
Expected: FAIL — `Cannot find module './health-body.service'`.

- [ ] **Step 7: Реализовать сервис**

`backend/src/health/health-body.service.ts`:

```ts
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
```

- [ ] **Step 8: Прогнать тесты**

Run: `cd backend && npm test -- src/health/health-body.service.spec.ts`
Expected: PASS, 6 тестов.

- [ ] **Step 9: Контроллер и регистрация в модуле**

`backend/src/health/health-body.controller.ts`:

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
import { HealthBodyService } from "./health-body.service";
import { FindHealthRangeDto } from "./dto/find-health-range.dto";
import { UpsertBodyEntryDto } from "./dto/upsert-body-entry.dto";
import { UpdateBodyEntryDto } from "./dto/update-body-entry.dto";

@Controller("health/body")
@UsePipes(new ValidationPipe({ transform: true }))
export class HealthBodyController {
	constructor(private readonly healthBodyService: HealthBodyService) {}

	@Get()
	list(@Query() dto: FindHealthRangeDto, @Req() req: Request) {
		return this.healthBodyService.list(dto, req);
	}

	@HttpCode(HttpStatus.CREATED)
	@Post()
	upsert(@Body() dto: UpsertBodyEntryDto, @Req() req: Request) {
		return this.healthBodyService.upsert(dto, req);
	}

	@Patch(":id")
	update(
		@Param("id") id: string,
		@Body() dto: UpdateBodyEntryDto,
		@Req() req: Request
	) {
		return this.healthBodyService.update(id, dto, req);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(":id")
	async remove(@Param("id") id: string, @Req() req: Request) {
		await this.healthBodyService.remove(id, req);
		return;
	}
}
```

`backend/src/health/health.module.ts` целиком:

```ts
import { Module } from "@nestjs/common";
import { HealthProfileService } from "./health-profile.service";
import { HealthProfileController } from "./health-profile.controller";
import { HealthBodyService } from "./health-body.service";
import { HealthBodyController } from "./health-body.controller";

@Module({
	controllers: [HealthProfileController, HealthBodyController],
	providers: [HealthProfileService, HealthBodyService],
	exports: [HealthProfileService, HealthBodyService],
})
export class HealthModule {}
```

- [ ] **Step 10: Прогнать весь бэкенд**

Run: `cd backend && npm test && npm run build`
Expected: все тесты зелёные, сборка проходит.

- [ ] **Step 11: Коммит**

```bash
git add backend/src/health backend/utils/date.ts backend/utils/date.spec.ts
git commit -m "feat(health): add body log endpoints"
```

---

### Task 7: Фундамент фронта — типы, api, роуты, меню, i18n

**Files:**
- Create: `frontend/shared/types/health.ts`
- Modify: `frontend/shared/types/routes.ts`
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/app/assets/constants/menu.ts`
- Modify: `frontend/i18n/locales/en.json`
- Modify: `frontend/i18n/locales/ru.json`

**Interfaces:**
- Consumes: форму ответов из Task 3 и Task 5.
- Produces: типы `EHealthSex`, `EActivityLevel`, `EProteinBasis`, `IMacroTargets`, `IHealthProfile`, `THealthProfileResponse`, `IBodyEntry`, `IWeightPoint`, `IMeasurementPoint`, `IBodyLog`; `ERoutes.health`, `ERoutes.healthBody`; `api.health.profile`, `api.health.body`, `api.health.bodyDetail(id)`.

> `ERoutes.healthNutrition` и вторая вкладка появятся в отдельном плане по КБЖУ. Одна вкладка в `UTabs` — ожидаемое промежуточное состояние, а не недоделка.

- [ ] **Step 1: Типы**

`frontend/shared/types/health.ts`:

```ts
export enum EHealthSex {
	Male = "male",
	Female = "female",
}

export enum EActivityLevel {
	Sedentary = "sedentary",
	Light = "light",
	Moderate = "moderate",
	High = "high",
}

export enum EProteinBasis {
	Current = "current",
	Target = "target",
}

export interface IMacroTargets {
	proteinG: number;
	fatG: number;
	carbsG: number;
}

export interface IHealthProfile {
	isConfigured: true;
	id: string;
	sex: EHealthSex;
	birthDate: string;
	heightCm: number;
	activityLevel: EActivityLevel;
	startWeightKg: number;
	targetWeightKg: number;
	startedAt: string;
	dailyDeficit: number;
	proteinPerKg: number;
	proteinBasis: EProteinBasis;
	fatPercent: number;
	age: number;
	currentWeightKg: number;
	lostKg: number;
	remainingKg: number;
	progress: number;
	bmr: number;
	tdee: number;
	targetKcal: number;
	macroTargets: IMacroTargets;
	isMacroConflict: boolean;
}

export interface INotConfiguredProfile {
	isConfigured: false;
}

export type THealthProfileResponse = IHealthProfile | INotConfiguredProfile;

export interface IBodyEntry {
	id: string;
	date: string;
	weightKg: number | null;
	chestCm: number | null;
	waistCm: number | null;
	armCm: number | null;
	note: string | null;
}

export interface IWeightPoint {
	date: string;
	weight: number;
	target: number;
}

export interface IMeasurementPoint {
	date: string;
	chest: number | null;
	waist: number | null;
	arm: number | null;
}

export interface IBodyLog {
	entries: IBodyEntry[];
	weightChart: IWeightPoint[];
	measurementChart: IMeasurementPoint[];
}
```

- [ ] **Step 2: Роуты, api и меню**

В `frontend/shared/types/routes.ts` в enum `ERoutes` после `goals`:

```ts
	health = "/health",
	healthBody = "/health/body",
```

В `frontend/lib/api.ts` в объект `api` после блока `planner`:

```ts
	health: {
		profile: `${prefix}/health/profile/`,
		body: `${prefix}/health/body/`,
		bodyDetail: (id: string) => `${prefix}/health/body/${id}/`,
	},
```

В `frontend/app/assets/constants/menu.ts` в массив `navigation` после пункта `goals`:

```ts
	{ to: ERoutes.healthBody, key: "health", icon: "i-lucide-heart-pulse" },
```

- [ ] **Step 3: Локали**

В `frontend/i18n/locales/en.json`: в объект `routes` добавить `"health": "Health"`; в `buttons` — `"newBodyEntry": "Add entry"`, `"healthProfile": "Profile"`, `"fillProfile": "Fill in profile"`; в `modals` — `"healthProfile": "Health profile"`, `"newBodyEntry": "New entry"`. Затем добавить верхнеуровневый блок:

```json
	"health": {
		"tabs": { "body": "Weight & body" },
		"emptyProfile": "Fill in height, weight and activity level — we will work out your daily calorie and macro targets.",
		"start": "Start",
		"current": "Current",
		"target": "Target",
		"lost": "Lost",
		"remaining": "Remaining",
		"progress": "Progress to goal",
		"bmr": "BMR",
		"tdee": "TDEE",
		"deficit": "Deficit",
		"targetKcal": "Calorie target",
		"protein": "Protein",
		"fat": "Fat",
		"carbs": "Carbs",
		"macroConflict": "Protein and fat alone already use up the calorie target. Lower protein per kg or the fat share.",
		"weightChartTitle": "Weight",
		"measurementsChartTitle": "Body measurements",
		"chartEmpty": "Nothing logged for this period yet",
		"logTitle": "Diary",
		"date": "Date",
		"weight": "Weight, kg",
		"chest": "Chest, cm",
		"waist": "Waist, cm",
		"arm": "Arm, cm",
		"note": "Note",
		"kg": "kg",
		"gram": "g",
		"needValue": "Enter a weight or at least one measurement",
		"sex": "Sex",
		"male": "Male",
		"female": "Female",
		"birthDate": "Date of birth",
		"height": "Height, cm",
		"startWeight": "Start weight, kg",
		"targetWeight": "Target weight, kg",
		"startedAt": "Diary start date",
		"activity": "Activity level",
		"activityLevels": {
			"sedentary": "Sedentary (x1.2)",
			"light": "Light activity (x1.375)",
			"moderate": "Moderate activity (x1.55)",
			"high": "High activity (x1.725)"
		},
		"proteinPerKg": "Protein, g per kg",
		"proteinBasis": "Protein based on",
		"basisCurrent": "Current weight",
		"basisTarget": "Target weight",
		"fatPercent": "Fat, % of calories",
		"range": { "30": "30 days", "90": "90 days", "all": "All time" }
	}
```

В `frontend/i18n/locales/ru.json` — те же ключи: `routes.health` — `"Здоровье"`, `buttons.newBodyEntry` — `"Добавить запись"`, `buttons.healthProfile` — `"Профиль"`, `buttons.fillProfile` — `"Заполнить профиль"`, `modals.healthProfile` — `"Профиль здоровья"`, `modals.newBodyEntry` — `"Новая запись"`, и блок:

```json
	"health": {
		"tabs": { "body": "Вес и параметры тела" },
		"emptyProfile": "Заполните рост, вес и уровень активности — посчитаем дневную норму калорий и БЖУ.",
		"start": "Старт",
		"current": "Текущий вес",
		"target": "Цель",
		"lost": "Сброшено",
		"remaining": "Осталось",
		"progress": "Прогресс к цели",
		"bmr": "Базовый обмен",
		"tdee": "Расход с активностью",
		"deficit": "Дефицит",
		"targetKcal": "Цель по калориям",
		"protein": "Белки",
		"fat": "Жиры",
		"carbs": "Углеводы",
		"macroConflict": "Белок и жир уже съедают всю норму калорий. Уменьшите белок на кг или долю жиров.",
		"weightChartTitle": "Динамика веса",
		"measurementsChartTitle": "Параметры тела",
		"chartEmpty": "За этот период ещё нет записей",
		"logTitle": "Дневник",
		"date": "Дата",
		"weight": "Вес, кг",
		"chest": "Грудь, см",
		"waist": "Талия, см",
		"arm": "Рука, см",
		"note": "Заметка",
		"kg": "кг",
		"gram": "г",
		"needValue": "Укажите вес или хотя бы один замер",
		"sex": "Пол",
		"male": "Мужской",
		"female": "Женский",
		"birthDate": "Дата рождения",
		"height": "Рост, см",
		"startWeight": "Стартовый вес, кг",
		"targetWeight": "Целевой вес, кг",
		"startedAt": "Дата начала дневника",
		"activity": "Уровень активности",
		"activityLevels": {
			"sedentary": "Малоподвижный (x1.2)",
			"light": "Лёгкая активность (x1.375)",
			"moderate": "Умеренная активность (x1.55)",
			"high": "Высокая активность (x1.725)"
		},
		"proteinPerKg": "Белок, г на кг",
		"proteinBasis": "Белок считать от",
		"basisCurrent": "Текущего веса",
		"basisTarget": "Целевого веса",
		"fatPercent": "Жиры, % калорий",
		"range": { "30": "30 дней", "90": "90 дней", "all": "Всё время" }
	}
```

- [ ] **Step 4: Проверить, что фронт поднимается**

Run: `cd frontend && npm run dev`
Expected: сборка без ошибок; в левом меню появился пункт «Здоровье» (клик пока ведёт на 404 — страница появится в Task 8).

- [ ] **Step 5: Коммит**

```bash
git add frontend/shared/types/health.ts frontend/shared/types/routes.ts frontend/lib/api.ts frontend/app/assets/constants/menu.ts frontend/i18n/locales/en.json frontend/i18n/locales/ru.json
git commit -m "feat(health): add frontend types, routes and translations"
```

---

### Task 8: Каркас раздела — страницы, вкладки, пустое состояние

**Files:**
- Create: `frontend/app/pages/health/index.vue`
- Create: `frontend/app/pages/health/body/index.vue`
- Create: `frontend/app/components/health/Tabs.vue`
- Create: `frontend/app/components/health/EmptyProfile.vue`

**Interfaces:**
- Consumes: `THealthProfileResponse`, `IBodyLog`, `api.health.*`, `ERoutes.healthBody` из Task 7.
- Produces: страница `/health/body` с `profile`/`bodyLog` и функцией `refresh()`, компоненты `HealthTabs`, `HealthEmptyProfile`.

- [ ] **Step 1: Редирект с `/health`**

`frontend/app/pages/health/index.vue`:

```vue
<script setup lang="ts">
definePageMeta({
	redirect: ERoutes.healthBody,
});
</script>

<template>
	<div />
</template>
```

- [ ] **Step 2: Вкладки**

`frontend/app/components/health/Tabs.vue`:

```vue
<script setup lang="ts">
import type { TabsItem } from "@nuxt/ui";

const { t } = useI18n();
const route = useRoute();

const items = computed((): TabsItem[] => [
	{ label: t("health.tabs.body"), value: ERoutes.healthBody, icon: "i-lucide-scale" },
]);

const active = computed((): string => {
	const match = items.value.find((item) => route.path.startsWith(String(item.value)));

	return String(match?.value ?? ERoutes.healthBody);
});

function handleChange(value: string | number): void {
	navigateTo(String(value));
}
</script>

<template>
	<UTabs
		:items="items"
		:model-value="active"
		:content="false"
		variant="link"
		@update:model-value="handleChange"
	/>
</template>
```

- [ ] **Step 3: Пустое состояние**

`frontend/app/components/health/EmptyProfile.vue`:

```vue
<script setup lang="ts"></script>

<template>
	<CommonCardWrapper>
		<div class="flex flex-col items-center gap-4 py-8 text-center">
			<UIcon name="i-lucide-heart-pulse" class="size-10 text-gray-400" />

			<p class="max-w-md text-gray-400">{{ $t("health.emptyProfile") }}</p>

			<slot />
		</div>
	</CommonCardWrapper>
</template>
```

- [ ] **Step 4: Страница вкладки**

`frontend/app/pages/health/body/index.vue`:

```vue
<script setup lang="ts">
import { api } from "~~/lib/api";

const { data: profile, error, refresh: refreshProfile } = await useFetch<THealthProfileResponse>(
	api.health.profile,
	{ key: "HealthProfile" },
);

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}

const isConfigured = computed((): boolean => Boolean(profile.value?.isConfigured));
</script>

<template>
	<section class="grid gap-4">
		<h1 class="lg:text-3xl text-2xl font-bold">{{ $t("routes.health") }}</h1>

		<HealthTabs />

		<CommonSuspenseWrapper>
			<HealthEmptyProfile v-if="!isConfigured" />

			<div v-else class="grid gap-6">
				<p class="text-gray-400">{{ $t("health.logTitle") }}</p>
			</div>
		</CommonSuspenseWrapper>
	</section>
</template>
```

- [ ] **Step 5: Проверить вручную**

Запустить `cd backend && npm run start:dev` и `cd frontend && npm run dev`, залогиниться, открыть `http://localhost:3000/health`.
Expected: редирект на `/health/body`, заголовок «Здоровье», одна активная вкладка «Вес и параметры тела», карточка пустого состояния с текстом про заполнение профиля. Переключение языка меняет все подписи.

- [ ] **Step 6: Коммит**

```bash
git add frontend/app/pages/health frontend/app/components/health
git commit -m "feat(health): add health section shell with tabs and empty state"
```

---

### Task 9: Форма профиля

**Files:**
- Create: `frontend/app/components/modals/EditHealthProfile.vue`
- Modify: `frontend/app/pages/health/body/index.vue`

**Interfaces:**
- Consumes: `IHealthProfile`, `THealthProfileResponse`, `api.health.profile`, `HealthEmptyProfile` из Task 8.
- Produces: компонент `ModalsEditHealthProfile` с пропсом `profile: THealthProfileResponse | null` и событием `refresh`.

- [ ] **Step 1: Написать модалку**

`frontend/app/components/modals/EditHealthProfile.vue`:

```vue
<script setup lang="ts">
import { z } from "zod";
import { api } from "~~/lib/api";
import { getError } from "~/assets/utils/common.ts";

const props = defineProps<{
	profile: THealthProfileResponse | null;
}>();

const emit = defineEmits(["refresh"]);

const { t } = useI18n();
const toast = useToast();
const slideOverRef = useTemplateRef("slideOver");

const isExisting = computed((): boolean => Boolean(props.profile?.isConfigured));

const schema = z.object({
	sex: z.enum([EHealthSex.Male, EHealthSex.Female]),
	birthDate: z.string().nonempty({ message: t("inputsErrors.required") }),
	heightCm: z.number().min(50).max(260),
	activityLevel: z.enum([
		EActivityLevel.Sedentary,
		EActivityLevel.Light,
		EActivityLevel.Moderate,
		EActivityLevel.High,
	]),
	startWeightKg: z.number().min(20).max(500),
	targetWeightKg: z.number().min(20).max(500),
	startedAt: z.string().nonempty({ message: t("inputsErrors.required") }),
	dailyDeficit: z.number().min(0).max(1500),
	proteinPerKg: z.number().min(0.5).max(4),
	proteinBasis: z.enum([EProteinBasis.Current, EProteinBasis.Target]),
	fatPercent: z.number().min(15).max(60),
});

const today = new Date().toISOString().slice(0, 10);

function initialState() {
	const profile = props.profile?.isConfigured ? props.profile : null;

	return {
		sex: profile?.sex ?? EHealthSex.Male,
		birthDate: profile?.birthDate ?? "",
		heightCm: profile?.heightCm ?? 170,
		activityLevel: profile?.activityLevel ?? EActivityLevel.Light,
		startWeightKg: profile?.startWeightKg ?? 75,
		targetWeightKg: profile?.targetWeightKg ?? 70,
		startedAt: profile?.startedAt ?? today,
		dailyDeficit: profile?.dailyDeficit ?? 500,
		proteinPerKg: profile?.proteinPerKg ?? 1.8,
		proteinBasis: profile?.proteinBasis ?? EProteinBasis.Current,
		fatPercent: Math.round((profile?.fatPercent ?? 0.3) * 100),
	};
}

const state = reactive(initialState());
const isLoading = ref<boolean>(false);

const sexItems = computed(() => [
	{ label: t("health.male"), value: EHealthSex.Male },
	{ label: t("health.female"), value: EHealthSex.Female },
]);

const activityItems = computed(() =>
	Object.values(EActivityLevel).map((value) => ({
		label: t(`health.activityLevels.${value}`),
		value,
	})),
);

const basisItems = computed(() => [
	{ label: t("health.basisCurrent"), value: EProteinBasis.Current },
	{ label: t("health.basisTarget"), value: EProteinBasis.Target },
]);

const isValid = computed(() => schema.safeParse(state).success);

async function onSubmit() {
	try {
		isLoading.value = true;

		await $fetch(api.health.profile, {
			method: isExisting.value ? "PATCH" : "POST",
			body: JSON.stringify({
				...state,
				fatPercent: state.fatPercent / 100,
			}),
		});

		emit("refresh");
		toast.add({
			title: isExisting.value ? t("common.updated") : t("common.added"),
			color: "success",
			icon: "i-lucide-circle-check",
		});
	} catch (e) {
		console.warn("EditHealthProfile / onSubmit: ", e);
		toast.add({ title: getError(e) || t("common.error"), color: "error" });
	} finally {
		isLoading.value = false;
		slideOverRef.value?.handleClose();
	}
}

function handleClose() {
	Object.assign(state, initialState());
}
</script>

<template>
	<ModalsBaseSlideOver
		ref="slideOver"
		:btnLabel="isExisting ? 'healthProfile' : 'fillProfile'"
		btnIcon="i-lucide-settings-2"
		btnVariant="subtle"
		title="healthProfile"
		:isDisabled="!isValid"
		:isLoading="isLoading"
		@close="handleClose"
		@click="onSubmit"
	>
		<UForm :schema="schema" :state="state" class="w-full flex flex-col space-y-4" @submit="onSubmit">
			<UFormField class="w-full" :label="$t('health.sex')" name="sex">
				<URadioGroup v-model="state.sex" :items="sexItems" orientation="horizontal" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.birthDate')" name="birthDate">
				<UInput v-model="state.birthDate" type="date" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.height')" name="heightCm">
				<UInput v-model.number="state.heightCm" type="number" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.startWeight')" name="startWeightKg">
				<UInput v-model.number="state.startWeightKg" type="number" step="0.1" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.targetWeight')" name="targetWeightKg">
				<UInput v-model.number="state.targetWeightKg" type="number" step="0.1" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.startedAt')" name="startedAt">
				<UInput v-model="state.startedAt" type="date" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.activity')" name="activityLevel">
				<USelect v-model="state.activityLevel" :items="activityItems" value-key="value" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.deficit')" name="dailyDeficit">
				<UInput v-model.number="state.dailyDeficit" type="number" step="50" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.proteinPerKg')" name="proteinPerKg">
				<UInput v-model.number="state.proteinPerKg" type="number" step="0.1" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.proteinBasis')" name="proteinBasis">
				<USelect v-model="state.proteinBasis" :items="basisItems" value-key="value" class="w-full" size="md" />
			</UFormField>

			<UFormField
				class="w-full"
				:label="`${$t('health.fatPercent')}: ${state.fatPercent}%`"
				name="fatPercent"
			>
				<USlider v-model="state.fatPercent" :min="15" :max="60" :step="1" />
			</UFormField>
		</UForm>
	</ModalsBaseSlideOver>
</template>
```

- [ ] **Step 2: Подключить на странице**

В `frontend/app/pages/health/body/index.vue` заменить блок `<template>` на:

```vue
<template>
	<section class="grid gap-4">
		<h1 class="lg:text-3xl text-2xl font-bold">{{ $t("routes.health") }}</h1>

		<HealthTabs />

		<CommonSectionHeader>
			<ModalsEditHealthProfile :profile="profile ?? null" @refresh="refreshProfile" />
		</CommonSectionHeader>

		<CommonSuspenseWrapper>
			<HealthEmptyProfile v-if="!isConfigured" />

			<div v-else class="grid gap-6">
				<p class="text-gray-400">{{ $t("health.logTitle") }}</p>
			</div>
		</CommonSuspenseWrapper>
	</section>
</template>
```

- [ ] **Step 3: Проверить вручную**

Открыть `/health/body`, нажать «Заполнить профиль», заполнить: М, дата рождения `1996-08-26`, рост 160, старт 75, цель 66, дата начала — сегодня, активность «Лёгкая», дефицит 500, белок 1.8, база «текущего веса», жиры 30%. Сохранить.
Expected: тост об успехе, пустое состояние исчезает, кнопка в шапке меняет подпись на «Профиль». В `GET /api/v2/health/profile` в ответе `bmr: 1605`, `tdee: 2207`, `targetKcal: 1707` — те же числа, что в референсном Excel.

- [ ] **Step 4: Коммит**

```bash
git add frontend/app/components/modals/EditHealthProfile.vue frontend/app/pages/health/body/index.vue
git commit -m "feat(health): add the health profile form"
```

---

### Task 10: Карточки прогресса и нормы

**Files:**
- Create: `frontend/app/components/health/Summary.vue`
- Create: `frontend/app/components/health/NormCard.vue`
- Modify: `frontend/app/pages/health/body/index.vue`

**Interfaces:**
- Consumes: `IHealthProfile` из Task 7.
- Produces: `HealthSummary` и `HealthNormCard`, оба с пропсом `profile: IHealthProfile`.

- [ ] **Step 1: Карточки прогресса**

`frontend/app/components/health/Summary.vue`:

```vue
<script setup lang="ts">
import { splitThousandsFloat } from "~/assets/utils/numbers";

const props = defineProps<{
	profile: IHealthProfile;
}>();

const percent = computed((): number => Math.round(props.profile.progress * 100));

const color = computed((): UiColors => {
	if (props.profile.progress >= 1) {
		return UiColors.success;
	}

	if (props.profile.progress > 0) {
		return UiColors.primary;
	}

	return UiColors.warning;
});

const cards = computed(() => [
	{ label: "health.start", value: props.profile.startWeightKg },
	{ label: "health.current", value: props.profile.currentWeightKg },
	{ label: "health.target", value: props.profile.targetWeightKg },
	{ label: "health.lost", value: props.profile.lostKg },
	{ label: "health.remaining", value: props.profile.remainingKg },
]);
</script>

<template>
	<CommonCardWrapper>
		<div class="grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
			<div v-for="card in cards" :key="card.label">
				<div class="text-xs text-gray-400">{{ $t(card.label) }}</div>
				<div class="text-lg">{{ splitThousandsFloat(card.value) }} {{ $t("health.kg") }}</div>
			</div>
		</div>

		<div class="mt-4 grid gap-2">
			<UProgress :model-value="Math.min(Math.max(percent, 0), 100)" :color="color" />

			<div class="text-xs text-gray-400">{{ $t("health.progress") }}: {{ percent }}%</div>
		</div>
	</CommonCardWrapper>
</template>
```

- [ ] **Step 2: Карточка нормы**

`frontend/app/components/health/NormCard.vue`:

```vue
<script setup lang="ts">
import { splitThousands } from "~/assets/utils/numbers";

const props = defineProps<{
	profile: IHealthProfile;
}>();

const norms = computed(() => [
	{ label: "health.bmr", value: `${splitThousands(props.profile.bmr)}` },
	{ label: "health.tdee", value: `${splitThousands(props.profile.tdee)}` },
	{ label: "health.deficit", value: `${splitThousands(props.profile.dailyDeficit)}` },
	{ label: "health.targetKcal", value: `${splitThousands(props.profile.targetKcal)}` },
]);

const macros = computed(() => [
	{ label: "health.protein", value: props.profile.macroTargets.proteinG },
	{ label: "health.fat", value: props.profile.macroTargets.fatG },
	{ label: "health.carbs", value: props.profile.macroTargets.carbsG },
]);
</script>

<template>
	<CommonCardWrapper>
		<template #header>{{ $t("health.targetKcal") }}</template>

		<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
			<div v-for="norm in norms" :key="norm.label">
				<div class="text-xs text-gray-400">{{ $t(norm.label) }}</div>
				<div class="text-lg">{{ norm.value }}</div>
			</div>
		</div>

		<div class="mt-4 grid grid-cols-3 gap-4">
			<div v-for="macro in macros" :key="macro.label">
				<div class="text-xs text-gray-400">{{ $t(macro.label) }}</div>
				<div class="text-lg">{{ macro.value }} {{ $t("health.gram") }}</div>
			</div>
		</div>

		<UAlert
			v-if="props.profile.isMacroConflict"
			class="mt-4"
			color="warning"
			variant="subtle"
			icon="i-lucide-triangle-alert"
			:description="$t('health.macroConflict')"
		/>
	</CommonCardWrapper>
</template>
```

- [ ] **Step 3: Подключить на странице**

В `frontend/app/pages/health/body/index.vue` заменить содержимое ветки `v-else` на:

```vue
			<div v-else-if="profile?.isConfigured" class="grid gap-6">
				<HealthSummary :profile="profile" />
				<HealthNormCard :profile="profile" />
			</div>
```

- [ ] **Step 4: Проверить вручную**

Открыть `/health/body` с заполненным профилем.
Expected: пять карточек (старт 75, текущий 75, цель 66, сброшено 0, осталось 9), прогресс 0%; карточка нормы с BMR 1605, TDEE 2207, дефицит 500, цель 1707 и БЖУ 135 / 56.9 / 163.7 г.

- [ ] **Step 5: Коммит**

```bash
git add frontend/app/components/health frontend/app/pages/health/body/index.vue
git commit -m "feat(health): add progress and calorie norm cards"
```

---

### Task 11: Дневник — таблица и форма записи

**Files:**
- Create: `frontend/app/components/health/RangeSwitcher.vue`
- Create: `frontend/app/components/health/BodyTable.vue`
- Create: `frontend/app/components/modals/AddBodyEntry.vue`
- Modify: `frontend/app/pages/health/body/index.vue`

**Interfaces:**
- Consumes: `IBodyLog`, `IBodyEntry`, `api.health.body`, `api.health.bodyDetail` из Task 7.
- Produces: `HealthRangeSwitcher` (`modelValue: number | null`, событие `update:modelValue`), `HealthBodyTable` (`entries`, события `edit`, `delete`), `ModalsAddBodyEntry` (`entry?: IBodyEntry | null`, событие `refresh`).

- [ ] **Step 1: Переключатель периода**

`frontend/app/components/health/RangeSwitcher.vue`:

```vue
<script setup lang="ts">
const props = defineProps<{
	modelValue: number | null;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: number | null];
}>();

const { t } = useI18n();

const items = computed(() => [
	{ label: t("health.range.30"), value: 30 },
	{ label: t("health.range.90"), value: 90 },
	{ label: t("health.range.all"), value: null },
]);
</script>

<template>
	<div class="flex items-center gap-2 mr-auto">
		<UButton
			v-for="item in items"
			:key="String(item.value)"
			size="xs"
			:variant="props.modelValue === item.value ? 'solid' : 'ghost'"
			@click="emit('update:modelValue', item.value)"
		>
			{{ item.label }}
		</UButton>
	</div>
</template>
```

- [ ] **Step 2: Таблица дневника**

`frontend/app/components/health/BodyTable.vue`:

```vue
<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import type { Row } from "@tanstack/table-core";

const props = defineProps<{
	entries: IBodyEntry[];
}>();

const emit = defineEmits<{
	delete: [value: string];
}>();

const { t, locale } = useI18n();

const UButton = resolveComponent("UButton");
const UDropdownMenu = resolveComponent("UDropdownMenu");

const dash = "—";

const formatDate = (value: string): string =>
	new Intl.DateTimeFormat(locale.value, {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(value));

const numberCell = (value: number | null): string =>
	value === null ? dash : String(value);

const columns: TableColumn<IBodyEntry>[] = [
	{
		accessorKey: "date",
		header: t("health.date"),
		cell: ({ row }) => formatDate(row.original.date),
	},
	{
		accessorKey: "weightKg",
		header: t("health.weight"),
		cell: ({ row }) => numberCell(row.original.weightKg),
	},
	{
		accessorKey: "chestCm",
		header: t("health.chest"),
		cell: ({ row }) => numberCell(row.original.chestCm),
	},
	{
		accessorKey: "waistCm",
		header: t("health.waist"),
		cell: ({ row }) => numberCell(row.original.waistCm),
	},
	{
		accessorKey: "armCm",
		header: t("health.arm"),
		cell: ({ row }) => numberCell(row.original.armCm),
	},
	{
		accessorKey: "note",
		header: t("health.note"),
		cell: ({ row }) => row.original.note || dash,
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

function getRowItems(row: Row<IBodyEntry>) {
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
	<CommonCardWrapper>
		<template #header>{{ $t("health.logTitle") }}</template>

		<UTable class="w-full" sticky :data="props.entries" :columns="columns" />
	</CommonCardWrapper>
</template>
```

- [ ] **Step 3: Форма записи**

`frontend/app/components/modals/AddBodyEntry.vue`:

```vue
<script setup lang="ts">
import { z } from "zod";
import { api } from "~~/lib/api";
import { getError } from "~/assets/utils/common.ts";

const emit = defineEmits(["refresh"]);

const { t } = useI18n();
const toast = useToast();
const slideOverRef = useTemplateRef("slideOver");

const optionalNumber = z.number().nullable();

const schema = z.object({
	date: z.string().nonempty({ message: t("inputsErrors.required") }),
	weightKg: optionalNumber,
	chestCm: optionalNumber,
	waistCm: optionalNumber,
	armCm: optionalNumber,
	note: z.string().nullable(),
});

const today = new Date().toISOString().slice(0, 10);

const state = reactive({
	date: today,
	weightKg: null as number | null,
	chestCm: null as number | null,
	waistCm: null as number | null,
	armCm: null as number | null,
	note: null as string | null,
});

const isLoading = ref<boolean>(false);

const hasValue = computed((): boolean =>
	[state.weightKg, state.chestCm, state.waistCm, state.armCm].some(
		(value) => value !== null && value !== undefined && !Number.isNaN(value),
	),
);

const isValid = computed(() => schema.safeParse(state).success && hasValue.value);

async function onSubmit() {
	try {
		isLoading.value = true;

		const payload: Record<string, unknown> = { date: state.date };

		(["weightKg", "chestCm", "waistCm", "armCm"] as const).forEach((key) => {
			if (state[key] !== null && !Number.isNaN(state[key])) {
				payload[key] = state[key];
			}
		});

		if (state.note) {
			payload.note = state.note;
		}

		await $fetch(api.health.body, {
			method: "POST",
			body: JSON.stringify(payload),
		});

		emit("refresh");
		toast.add({
			title: t("common.added"),
			color: "success",
			icon: "i-lucide-circle-check",
		});
	} catch (e) {
		console.warn("AddBodyEntry / onSubmit: ", e);
		toast.add({ title: getError(e) || t("common.error"), color: "error" });
	} finally {
		isLoading.value = false;
		slideOverRef.value?.handleClose();
	}
}

function handleClose() {
	state.date = today;
	state.weightKg = null;
	state.chestCm = null;
	state.waistCm = null;
	state.armCm = null;
	state.note = null;
}
</script>

<template>
	<ModalsBaseSlideOver
		ref="slideOver"
		btnLabel="newBodyEntry"
		btnIcon="i-lucide-plus"
		title="newBodyEntry"
		:isDisabled="!isValid"
		:isLoading="isLoading"
		@close="handleClose"
		@click="onSubmit"
	>
		<UForm :schema="schema" :state="state" class="w-full flex flex-col space-y-4" @submit="onSubmit">
			<UFormField class="w-full" :label="$t('health.date')" name="date">
				<UInput v-model="state.date" type="date" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.weight')" name="weightKg">
				<UInput v-model.number="state.weightKg" type="number" step="0.1" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.chest')" name="chestCm">
				<UInput v-model.number="state.chestCm" type="number" step="0.5" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.waist')" name="waistCm">
				<UInput v-model.number="state.waistCm" type="number" step="0.5" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.arm')" name="armCm">
				<UInput v-model.number="state.armCm" type="number" step="0.5" class="w-full" size="md" />
			</UFormField>

			<UFormField class="w-full" :label="$t('health.note')" name="note">
				<UTextarea v-model="state.note" class="w-full" size="md" />
			</UFormField>

			<p v-if="!hasValue" class="text-xs text-amber-500">{{ $t("health.needValue") }}</p>
		</UForm>
	</ModalsBaseSlideOver>
</template>
```

- [ ] **Step 4: Собрать страницу**

`frontend/app/pages/health/body/index.vue` целиком:

```vue
<script setup lang="ts">
import { api } from "~~/lib/api";

const { t } = useI18n();
const toast = useToast();

const rangeDays = ref<number | null>(90);

const bodyParams = computed(() => {
	if (rangeDays.value === null) {
		return {};
	}

	const to = new Date();
	const from = new Date(to.getTime() - rangeDays.value * 24 * 60 * 60 * 1000);

	return {
		from: from.toISOString().slice(0, 10),
		to: to.toISOString().slice(0, 10),
	};
});

const { data: profile, error, refresh: refreshProfile } = await useFetch<THealthProfileResponse>(
	api.health.profile,
	{ key: "HealthProfile" },
);

const { data: bodyLog, refresh: refreshBody } = await useFetch<IBodyLog>(api.health.body, {
	key: "HealthBodyLog",
	params: bodyParams,
});

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}

const isConfigured = computed((): boolean => Boolean(profile.value?.isConfigured));

async function refreshAll() {
	await Promise.all([refreshProfile(), refreshBody()]);
}

async function handleDelete(id: string) {
	try {
		await $fetch(api.health.bodyDetail(id), { method: "DELETE" });

		await refreshAll();
		toast.add({
			title: t("common.deleted"),
			color: "success",
			icon: "i-lucide-circle-check",
		});
	} catch (e) {
		console.warn("Health body / handleDelete: ", e);
		toast.add({ title: t("common.error"), color: "error" });
	}
}
</script>

<template>
	<section class="grid gap-4">
		<h1 class="lg:text-3xl text-2xl font-bold">{{ $t("routes.health") }}</h1>

		<HealthTabs />

		<CommonSectionHeader>
			<HealthRangeSwitcher v-model="rangeDays" />

			<ModalsEditHealthProfile :profile="profile ?? null" @refresh="refreshAll" />
			<ModalsAddBodyEntry v-if="isConfigured" @refresh="refreshAll" />
		</CommonSectionHeader>

		<CommonSuspenseWrapper>
			<HealthEmptyProfile v-if="!isConfigured">
				<ModalsEditHealthProfile :profile="null" @refresh="refreshAll" />
			</HealthEmptyProfile>

			<div v-else-if="profile?.isConfigured" class="grid gap-6">
				<HealthSummary :profile="profile" />
				<HealthNormCard :profile="profile" />
				<HealthBodyTable :entries="bodyLog?.entries || []" @delete="handleDelete" />
			</div>
		</CommonSuspenseWrapper>
	</section>
</template>
```

> Отдельной формы правки записи в таблице нет намеренно: запись сохраняется upsert'ом по дате, поэтому повторное добавление той же даты перезаписывает строку — это и есть правка. В меню строки остаётся только удаление.

- [ ] **Step 5: Проверить вручную**

Открыть `/health/body`, добавить запись за сегодня с весом 74.2, затем ещё одну за вчера с весом 74.8 и талией 88.
Expected: в таблице две строки, свежая сверху; в карточках «Текущий вес» стал 74.2, «Сброшено» 0.8, «Осталось» 8.2, BMR пересчитался. Повторное сохранение сегодняшней даты с другим весом меняет ту же строку, а не добавляет вторую. Удаление через меню строки убирает запись и обновляет карточки. Кнопка «Добавить запись» неактивна, пока не заполнено ни одно числовое поле.

- [ ] **Step 6: Коммит**

```bash
git add frontend/app/components/health frontend/app/components/modals/AddBodyEntry.vue frontend/app/pages/health/body/index.vue
git commit -m "feat(health): add the body diary table and entry form"
```

---

### Task 12: Графики веса и обхватов

**Files:**
- Create: `frontend/app/components/health/WeightChart.vue`
- Create: `frontend/app/components/health/MeasurementsChart.vue`
- Modify: `frontend/app/pages/health/body/index.vue`

**Interfaces:**
- Consumes: `IWeightPoint`, `IMeasurementPoint` из Task 7.
- Produces: `HealthWeightChart` (`points: IWeightPoint[]`), `HealthMeasurementsChart` (`points: IMeasurementPoint[]`).

- [ ] **Step 1: График веса**

`frontend/app/components/health/WeightChart.vue`:

```vue
<script setup lang="ts">
const props = defineProps<{
	points: IWeightPoint[];
}>();

const { t, locale } = useI18n();

const categories = computed((): Record<string, BulletLegendItemInterface> => ({
	weight: { name: t("health.weight"), color: "#22c55e" },
	target: { name: t("health.target"), color: "#64748b" },
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

function formatWeight(tick: number): string {
	return String(Math.round(tick * 10) / 10);
}
</script>

<template>
	<CommonCardWrapper>
		<template #header>{{ $t("health.weightChartTitle") }}</template>

		<p v-if="!hasData" class="text-sm text-gray-500">{{ $t("health.chartEmpty") }}</p>

		<LineChart
			v-else
			:data="props.points"
			:categories="categories"
			:height="320"
			:x-num-ticks="6"
			:curve-type="CurveType.Linear"
			:legend-position="LegendPosition.TopLeft"
			:x-formatter="formatDate"
			:y-formatter="formatWeight"
		/>
	</CommonCardWrapper>
</template>
```

- [ ] **Step 2: График обхватов**

`frontend/app/components/health/MeasurementsChart.vue`:

```vue
<script setup lang="ts">
const props = defineProps<{
	points: IMeasurementPoint[];
}>();

const { t, locale } = useI18n();

const categories = computed((): Record<string, BulletLegendItemInterface> => ({
	chest: { name: t("health.chest"), color: "#3b82f6" },
	waist: { name: t("health.waist"), color: "#f97316" },
	arm: { name: t("health.arm"), color: "#a855f7" },
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

function formatCm(tick: number): string {
	return String(Math.round(tick));
}
</script>

<template>
	<CommonCardWrapper>
		<template #header>{{ $t("health.measurementsChartTitle") }}</template>

		<p v-if="!hasData" class="text-sm text-gray-500">{{ $t("health.chartEmpty") }}</p>

		<LineChart
			v-else
			:data="props.points"
			:categories="categories"
			:height="320"
			:x-num-ticks="6"
			:curve-type="CurveType.Linear"
			:legend-position="LegendPosition.TopLeft"
			:x-formatter="formatDate"
			:y-formatter="formatCm"
		/>
	</CommonCardWrapper>
</template>
```

- [ ] **Step 3: Подключить на странице**

В `frontend/app/pages/health/body/index.vue` в ветке `v-else-if="profile?.isConfigured"` после `HealthNormCard` вставить:

```vue
				<div class="grid gap-6 lg:grid-cols-2 lg:items-start">
					<HealthWeightChart :points="bodyLog?.weightChart || []" />
					<HealthMeasurementsChart :points="bodyLog?.measurementChart || []" />
				</div>
```

- [ ] **Step 4: Проверить вручную**

Открыть `/health/body` с тремя-четырьмя записями за разные дни, часть — с обхватами.
Expected: график веса рисует линию факта и ровную серую линию цели на 66; график обхватов рисует только те дни, где есть замеры; при переключении периода на «30 дней» оба графика перерисовываются; при пустом периоде вместо графика видна строка «За этот период ещё нет записей».

- [ ] **Step 5: Финальная проверка**

Run: `cd backend && npm test && npm run build`
Expected: все тесты зелёные, сборка проходит.

Run: `cd frontend && npm run build`
Expected: сборка проходит без ошибок типов.

- [ ] **Step 6: Коммит**

```bash
git add frontend/app/components/health frontend/app/pages/health/body/index.vue
git commit -m "feat(health): add weight and measurement charts"
```

---

## Что этот план не покрывает

Вкладка «КБЖУ» — справочник продуктов, сид, приёмы пищи, агрегация по гранулярности —
идёт отдельным планом по тому же спеку. После Task 12 раздел «Здоровье» рабочий и
самодостаточный: профиль считает норму, дневник ведётся, графики рисуются.

Открытые вопросы спека, оставленные на умолчаниях: единицы измерения зафиксированы
кг/см; период по умолчанию — 90 дней с переключателем 30 / 90 / всё время.
