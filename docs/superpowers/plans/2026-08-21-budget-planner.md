# Budget Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пользователь планирует бюджет на календарный месяц (заработок + обязательные и дополнительные статьи расхода), бэкенд считает фактические траты по каждой статье и создаёт in-app уведомление при достижении настраиваемого порога (по умолчанию 70%).

**Architecture:** Новые модули `planner` и `notifications` в NestJS-бэкенде. Плановые статьи связываются с фактом через существующий справочник `ExpenseCategory` — факт считается агрегацией `FinanceItem` по категории за период месяца. Проверка порога реактивная: `FinanceService.create` дёргает `BudgetAlertService`, тот пишет `Notification` и возвращает её в ответе, фронт показывает toast. Уведомления хранятся как `type` + `params` и рендерятся на чтении через `nestjs-i18n`.

**Tech Stack:** NestJS 11, Prisma 6 (MongoDB), `nestjs-i18n`, `@nestjs/schedule`, Jest + ts-jest; Nuxt 4, Nuxt UI 4, Pinia, `@nuxtjs/i18n`, zod.

**Спека:** `docs/superpowers/specs/2026-08-21-budget-planner-design.md`

## Global Constraints

- Базовая валюта пользователя — `req.payload.exchange`, fallback `"EUR"`.
- Все денежные величины хранятся парой: `curX` + `currencyFromId` (как ввёл юзер) и `convertedX` + `currencyToId` (в базовой валюте). Конвертация — `RatesService.convertPrice({ from, to, price })`, только при записи.
- Порог хранится на `FinancePlanner.alertThreshold`, дефолт `0.7`, диапазон `(0, 1]`. Поля порога в `User` нет. Переопределения на уровне `BudgetItem` нет.
- Период месяца — `[1-е число 00:00 UTC, 1-е число след. месяца 00:00 UTC)`, всегда через `getMonthRange`.
- Prisma-клиент генерируется в `backend/generated/prisma`, импорт типов — из `../../generated/prisma/client` (глубина `../` зависит от расположения файла).
- Тексты уведомлений живут только в `backend/src/i18n/{en,ru}/notification.json`. В БД — `type` и `params`.
- Отступы во всех файлах — табы (`.editorconfig`), кавычки двойные, точки с запятой обязательны (`.prettierrc`).
- Коммиты — на ветке `feature/budget-planner`.
- MongoDB: миграций нет, схема применяется через `npx prisma db push`.

---

### Task 1: Границы месяца и конфигурация Jest

**Files:**
- Modify: `backend/package.json:60-80` (секция `jest`)
- Modify: `backend/utils/date.ts`
- Create: `backend/utils/date.spec.ts`
- Modify: `backend/src/finance/finance.service.ts:79-140` (`getStatistics`)

**Interfaces:**
- Consumes: ничего
- Produces: `getMonthRange(year: number, month: number): { gte: Date; lt: Date }` из `backend/utils/date.ts`. `month` — 1..12. Используется во всех последующих задачах для фильтрации `FinanceItem.createdAt`.

**Почему это первая задача.** Сейчас `getStatistics` считает конец месяца как ``new Date(`${year}-${month}-${lastDay}`)`` — это полночь последнего дня, поэтому траты за последний день месяца в статистику не попадают. Планер будет считать тот же период, и без общей утилиты цифры на дашборде и в планере разойдутся. Плюс jest сейчас видит только `src/`, а утилита лежит в `backend/utils/`.

- [ ] **Step 1: Расширить область видимости Jest**

В `backend/package.json` заменить секцию `"jest"` целиком на:

```json
	"jest": {
		"moduleFileExtensions": [
			"js",
			"json",
			"ts"
		],
		"rootDir": ".",
		"testRegex": ".*\\.spec\\.ts$",
		"testPathIgnorePatterns": [
			"/node_modules/",
			"/dist/",
			"/generated/"
		],
		"transform": {
			"^.+\\.(t|j)s$": "ts-jest"
		},
		"collectCoverageFrom": [
			"src/**/*.(t|j)s",
			"utils/**/*.(t|j)s"
		],
		"coverageDirectory": "./coverage",
		"testEnvironment": "node"
	}
```

- [ ] **Step 2: Написать падающий тест**

Создать `backend/utils/date.spec.ts`:

```ts
import { getMonthRange } from "./date";

describe("getMonthRange", () => {
	it("returns the first instant of the month and the first instant of the next month", () => {
		const range = getMonthRange(2026, 8);

		expect(range.gte.toISOString()).toBe("2026-08-01T00:00:00.000Z");
		expect(range.lt.toISOString()).toBe("2026-09-01T00:00:00.000Z");
	});

	it("rolls over into the next year for December", () => {
		const range = getMonthRange(2026, 12);

		expect(range.gte.toISOString()).toBe("2026-12-01T00:00:00.000Z");
		expect(range.lt.toISOString()).toBe("2027-01-01T00:00:00.000Z");
	});

	it("covers the 29th of February in a leap year", () => {
		const range = getMonthRange(2024, 2);

		expect(range.gte.toISOString()).toBe("2024-02-01T00:00:00.000Z");
		expect(range.lt.toISOString()).toBe("2024-03-01T00:00:00.000Z");
		expect(new Date("2024-02-29T23:59:59.000Z") < range.lt).toBe(true);
	});

	it("includes an expense made on the last day of the month", () => {
		const range = getMonthRange(2026, 8);
		const lastDayExpense = new Date("2026-08-31T18:30:00.000Z");

		expect(lastDayExpense >= range.gte && lastDayExpense < range.lt).toBe(true);
	});
});
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `cd backend && npx jest utils/date.spec.ts`
Expected: FAIL — `TS2305: Module './date' has no exported member 'getMonthRange'`

- [ ] **Step 4: Реализовать утилиту**

Дописать в конец `backend/utils/date.ts`:

```ts
export const getMonthRange = (
	year: number,
	month: number
): { gte: Date; lt: Date } => {
	return {
		gte: new Date(Date.UTC(year, month - 1, 1)),
		lt: new Date(Date.UTC(year, month, 1)),
	};
};
```

`Date.UTC` сам обрабатывает переполнение: `Date.UTC(2026, 12, 1)` даёт 1 января 2027.

- [ ] **Step 5: Убедиться, что тесты проходят**

Run: `cd backend && npx jest utils/date.spec.ts`
Expected: PASS, 4 passed

- [ ] **Step 6: Перевести `getStatistics` на `getMonthRange`**

В `backend/src/finance/finance.service.ts` заменить импорт:

```ts
import { daysInMonth } from "../../utils/date";
```

на:

```ts
import { getMonthRange } from "../../utils/date";
```

Внутри `getStatistics` заменить блок вычисления дат:

```ts
			const date = new Date();
			const year = date.getFullYear();
			const month = date.getMonth() + 1;
			const lastDay = daysInMonth(month, year);
```

на:

```ts
			const date = new Date();
			const period = getMonthRange(
				date.getUTCFullYear(),
				date.getUTCMonth() + 1
			);
```

И в обоих вызовах `groupBy` заменить фильтр по дате:

```ts
							createdAt: {
								gte: new Date(`${year}-${month}-1`),
								lte: new Date(`${year}-${month}-${lastDay}`),
							},
```

на:

```ts
							createdAt: period,
```

`period` — это объект `{ gte, lt }`, Prisma принимает его как фильтр напрямую.

- [ ] **Step 7: Проверить, что бэкенд собирается**

Run: `cd backend && npm run build`
Expected: сборка без ошибок, `daysInMonth` больше нигде не используется в `finance.service.ts`

Run: `cd backend && grep -rn "daysInMonth" src/`
Expected: пусто

- [ ] **Step 8: Коммит**

```bash
git add backend/package.json backend/utils/date.ts backend/utils/date.spec.ts backend/src/finance/finance.service.ts
git commit -m "Add getMonthRange util and fix month boundary in finance statistics"
```

---

### Task 2: Схема Prisma

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Consumes: ничего
- Produces: модели `FinancePlanner`, `BudgetItem`, `Notification` и сгенерированные типы `FinancePlanner`, `BudgetItem`, `Notification` в `backend/generated/prisma/client`. Все последующие задачи бэкенда зависят от них.

**Контекст.** Модели `FinancePlanner` и `Payments` в схеме уже есть, но за ними нет ни одной строчки кода — их можно переделывать свободно. В них же опечатки `plnnerId` и `lable`.

- [ ] **Step 1: Убедиться, что коллекции пустые**

Прежде чем менять схему, проверить, что данных нет — переименование коллекций их бы осиротило.

Run: `cd backend && npx prisma studio`
Открыть `FinancePlanner`, `Payments`, `Notification` — все три должны быть пустыми. Закрыть studio (Ctrl+C).

Если в какой-то коллекции есть документы — остановиться и сообщить пользователю, не выполняя `db push`.

- [ ] **Step 2: Заменить модель `FinancePlanner`**

В `backend/prisma/schema.prisma` заменить блок `model FinancePlanner { ... }` целиком на:

```prisma
model FinancePlanner {
	id     String @id @default(auto()) @map("_id") @db.ObjectId
	userId String

	year  Int
	month Int

	curIncome       Float  @default(0)
	currencyFromId  String
	convertedIncome Float  @default(0)
	currencyToId    String

	alertThreshold    Float   @default(0.7)
	notifiedThreshold Float?
	isRegular         Boolean @default(false)

	items BudgetItem[]
	user  User         @relation(fields: [userId], references: [id], onDelete: Cascade)

	createdAt DateTime  @default(now())
	updatedAt DateTime? @default(now())

	@@unique([userId, year, month])
}
```

- [ ] **Step 3: Заменить модель `Payments` на `BudgetItem`**

Заменить блок `model Payments { ... }` целиком на:

```prisma
model BudgetItem {
	id        String @id @default(auto()) @map("_id") @db.ObjectId
	plannerId String

	label String

	curAmount       Float  @default(0)
	currencyFromId  String
	convertedAmount Float  @default(0)
	currencyToId    String

	expenseCategoryId String
	isRequired        Boolean @default(false)
	notifiedThreshold Float?

	planner         FinancePlanner  @relation(fields: [plannerId], references: [id], onDelete: Cascade)
	expenseCategory ExpenseCategory @relation(fields: [expenseCategoryId], references: [value])

	createdAt DateTime  @default(now())
	updatedAt DateTime? @default(now())

	@@unique([plannerId, expenseCategoryId])
}
```

- [ ] **Step 4: Заменить модель `Notification`**

Заменить блок `model Notification { ... }` целиком на:

```prisma
model Notification {
	id       String  @id @default(auto()) @map("_id") @db.ObjectId
	userId   String
	type     String
	params   Json    @default("{}")
	isReaded Boolean @default(false)

	user User @relation(fields: [userId], references: [id], onDelete: Cascade)

	createdAt DateTime  @default(now())
	updatedAt DateTime? @default(now())
}
```

- [ ] **Step 5: Починить обратные связи**

В `model User` после строки `financePlanner FinancePlanner[]` добавить:

```prisma
	notifications  Notification[]
```

В `model ExpenseCategory` после строки `financeItem FinanceItem[]` добавить:

```prisma
	budgetItems BudgetItem[]
```

В `model ExchangeItem` удалить строку, ссылающуюся на удалённую модель:

```prisma
	requiredPayments Payments[]
```

`BudgetItem` не ссылается на `ExchangeItem` — валюта хранится строкой `currencyFromId` / `currencyToId`, как и в `FinanceItem`, где связь идёт через `value`. Обратная связь для `BudgetItem` в `ExchangeItem` не нужна, потому что relation-полей на `ExchangeItem` в `BudgetItem` нет.

- [ ] **Step 6: Проверить схему**

Run: `cd backend && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 7: Применить схему и сгенерировать клиент**

Run: `cd backend && npx prisma db push`
Expected: `Your database indexes are now in sync with your Prisma schema` и `Generated Prisma Client`

Run: `cd backend && npx prisma generate`
Expected: `Generated Prisma Client`

- [ ] **Step 8: Проверить, что типы сгенерированы**

Run: `cd backend && grep -l "BudgetItem" generated/prisma/models.ts`
Expected: `generated/prisma/models.ts`

Run: `cd backend && npm run build`
Expected: сборка без ошибок

- [ ] **Step 9: Коммит**

```bash
git add backend/prisma/schema.prisma
git commit -m "Rework FinancePlanner, replace Payments with BudgetItem, add Notification relations"
```

---

### Task 3: Модуль уведомлений

**Files:**
- Create: `backend/src/notifications/types.ts`
- Create: `backend/src/notifications/serializer/notification.serializer.ts`
- Create: `backend/src/notifications/serializer/notification.serializer.spec.ts`
- Create: `backend/src/notifications/notifications.service.ts`
- Create: `backend/src/notifications/notifications.controller.ts`
- Create: `backend/src/notifications/notifications.module.ts`
- Create: `backend/src/i18n/en/notification.json`
- Create: `backend/src/i18n/ru/notification.json`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService` из `../prisma.service`, `I18nService` / `I18nContext` из `nestjs-i18n`
- Produces:
  - `ENotificationType` со значениями `BudgetItemThreshold = "budget.item.threshold"` и `BudgetTotalThreshold = "budget.total.threshold"`
  - `INotificationParams` — `{ label?: string; percent: number; spent: number; planned: number; currency: string }`
  - `ISerializedNotification` — `{ id: string; type: string; title: string; text: string; isReaded: boolean; createdAt: Date }`
  - `NotificationsService.create({ userId, type, params }): Promise<ISerializedNotification | null>`
  - `NotificationsService.findAll(req): Promise<{ result: ISerializedNotification[]; unreadCount: number }>`
  - `NotificationsService.markRead(id, req): Promise<void>`
  - `NotificationsService.markAllRead(req): Promise<void>`
  - `NotificationSerializer.serialize(notification, i18n, lang): ISerializedNotification | null`
  - `NotificationSerializer.serializeMany(list, i18n, lang): ISerializedNotification[]`
  - `NotificationsModule` экспортирует `NotificationsService`

- [ ] **Step 1: Определить типы**

Создать `backend/src/notifications/types.ts`:

```ts
export enum ENotificationType {
	BudgetItemThreshold = "budget.item.threshold",
	BudgetTotalThreshold = "budget.total.threshold",
}

export interface INotificationParams {
	label?: string;
	percent: number;
	spent: number;
	planned: number;
	currency: string;
}

export interface ISerializedNotification {
	id: string;
	type: string;
	title: string;
	text: string;
	isReaded: boolean;
	createdAt: Date;
}
```

- [ ] **Step 2: Добавить локали**

Создать `backend/src/i18n/en/notification.json`:

```json
{
	"budget": {
		"item": {
			"threshold": {
				"title": "{label}: {percent}% of the plan spent",
				"text": "You have spent {spent} of {planned} {currency} planned for this goal."
			}
		},
		"total": {
			"threshold": {
				"title": "{percent}% of the monthly budget spent",
				"text": "You have spent {spent} of {planned} {currency} of your monthly income."
			}
		}
	}
}
```

Создать `backend/src/i18n/ru/notification.json`:

```json
{
	"budget": {
		"item": {
			"threshold": {
				"title": "{label}: израсходовано {percent}% плана",
				"text": "Потрачено {spent} из {planned} {currency}, запланированных на эту цель."
			}
		},
		"total": {
			"threshold": {
				"title": "Израсходовано {percent}% бюджета месяца",
				"text": "Потрачено {spent} из {planned} {currency} месячного заработка."
			}
		}
	}
}
```

Файлы попадут в `dist` автоматически: в `nest-cli.json` уже есть asset-правило `i18n/**/*`.

- [ ] **Step 3: Написать падающий тест сериализатора**

Создать `backend/src/notifications/serializer/notification.serializer.spec.ts`:

```ts
import { NotificationSerializer } from "./notification.serializer";
import { ENotificationType } from "../types";

const i18nMock = {
	translate: jest.fn(
		(key: string, options: { lang: string; args: Record<string, unknown> }) =>
			`${options.lang}:${key}:${JSON.stringify(options.args)}`
	),
} as any;

const baseNotification = {
	id: "n1",
	userId: "u1",
	type: ENotificationType.BudgetItemThreshold,
	params: { label: "Rent", percent: 70, spent: 700, planned: 1000, currency: "EUR" },
	isReaded: false,
	createdAt: new Date("2026-08-10T00:00:00.000Z"),
	updatedAt: new Date("2026-08-10T00:00:00.000Z"),
};

describe("NotificationSerializer", () => {
	beforeEach(() => {
		i18nMock.translate.mockClear();
	});

	it("renders title and text from the notification type and params", () => {
		const result = NotificationSerializer.serialize(
			baseNotification as any,
			i18nMock,
			"en"
		);

		expect(i18nMock.translate).toHaveBeenCalledWith(
			"notification.budget.item.threshold.title",
			{ lang: "en", args: baseNotification.params }
		);
		expect(result?.title).toContain("en:notification.budget.item.threshold.title");
		expect(result?.text).toContain("en:notification.budget.item.threshold.text");
		expect(result?.id).toBe("n1");
		expect(result?.isReaded).toBe(false);
	});

	it("renders the same notification in another language", () => {
		const result = NotificationSerializer.serialize(
			baseNotification as any,
			i18nMock,
			"ru"
		);

		expect(result?.title).toContain("ru:notification.budget.item.threshold.title");
	});

	it("returns null for an unknown notification type instead of throwing", () => {
		const result = NotificationSerializer.serialize(
			{ ...baseNotification, type: "some.removed.type" } as any,
			i18nMock,
			"en"
		);

		expect(result).toBeNull();
		expect(i18nMock.translate).not.toHaveBeenCalled();
	});

	it("drops unknown types from a list without dropping valid ones", () => {
		const result = NotificationSerializer.serializeMany(
			[
				baseNotification,
				{ ...baseNotification, id: "n2", type: "some.removed.type" },
				{ ...baseNotification, id: "n3", type: ENotificationType.BudgetTotalThreshold },
			] as any,
			i18nMock,
			"en"
		);

		expect(result.map((n) => n.id)).toEqual(["n1", "n3"]);
	});

	it("tolerates a notification with empty params", () => {
		const result = NotificationSerializer.serialize(
			{ ...baseNotification, params: null } as any,
			i18nMock,
			"en"
		);

		expect(i18nMock.translate).toHaveBeenCalledWith(
			"notification.budget.item.threshold.title",
			{ lang: "en", args: {} }
		);
		expect(result).not.toBeNull();
	});
});
```

- [ ] **Step 4: Убедиться, что тест падает**

Run: `cd backend && npx jest src/notifications`
Expected: FAIL — `Cannot find module './notification.serializer'`

- [ ] **Step 5: Реализовать сериализатор**

Создать `backend/src/notifications/serializer/notification.serializer.ts`:

```ts
import { I18nService } from "nestjs-i18n";
import { Notification } from "../../../generated/prisma/client";
import { ENotificationType, ISerializedNotification } from "../types";

const KNOWN_TYPES: string[] = Object.values(ENotificationType);

export class NotificationSerializer {
	static serialize(
		notification: Notification,
		i18n: I18nService,
		lang: string
	): ISerializedNotification | null {
		if (!KNOWN_TYPES.includes(notification.type)) {
			console.warn(
				"[NotificationSerializer / serialize]: unknown type ",
				notification.type
			);
			return null;
		}

		const args = (notification.params ?? {}) as Record<string, unknown>;

		return {
			id: notification.id,
			type: notification.type,
			title: i18n.translate<string>(
				`notification.${notification.type}.title`,
				{ lang, args }
			),
			text: i18n.translate<string>(
				`notification.${notification.type}.text`,
				{ lang, args }
			),
			isReaded: notification.isReaded,
			createdAt: notification.createdAt,
		};
	}

	static serializeMany(
		notifications: Notification[],
		i18n: I18nService,
		lang: string
	): ISerializedNotification[] {
		return notifications
			.map((n) => this.serialize(n, i18n, lang))
			.filter((n): n is ISerializedNotification => n !== null);
	}
}
```

- [ ] **Step 6: Убедиться, что тесты проходят**

Run: `cd backend && npx jest src/notifications`
Expected: PASS, 5 passed

- [ ] **Step 7: Коммит сериализатора**

```bash
git add backend/src/notifications backend/src/i18n
git commit -m "Add notification types, locales and i18n-backed serializer"
```

- [ ] **Step 8: Реализовать сервис**

Создать `backend/src/notifications/notifications.service.ts`:

```ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { I18nContext, I18nService } from "nestjs-i18n";
import { PrismaService } from "../prisma.service";
import { NotificationSerializer } from "./serializer/notification.serializer";
import {
	ENotificationType,
	INotificationParams,
	ISerializedNotification,
} from "./types";

interface ICreateNotification {
	userId: string;
	type: ENotificationType;
	params: INotificationParams;
	lang?: string;
}

@Injectable()
export class NotificationsService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly i18nService: I18nService
	) {}

	private currentLang(fallback?: string): string {
		return fallback || I18nContext.current()?.lang || "en";
	}

	async create({
		userId,
		type,
		params,
		lang,
	}: ICreateNotification): Promise<ISerializedNotification | null> {
		try {
			const notification = await this.prismaService.notification.create({
				data: {
					userId,
					type,
					params: params as unknown as object,
				},
			});

			return NotificationSerializer.serialize(
				notification,
				this.i18nService,
				this.currentLang(lang)
			);
		} catch (e) {
			console.warn("[NotificationsService / create]: ", e);
			throw new Error(e);
		}
	}

	async findAll(req: Record<string, any>) {
		try {
			const userId: string = req.payload.id;

			const [result, unreadCount] = await Promise.all([
				this.prismaService.notification.findMany({
					where: { userId },
					orderBy: { createdAt: "desc" },
					take: 50,
				}),
				this.prismaService.notification.count({
					where: { userId, isReaded: false },
				}),
			]);

			return {
				result: NotificationSerializer.serializeMany(
					result,
					this.i18nService,
					this.currentLang()
				),
				unreadCount,
			};
		} catch (e) {
			console.warn("[NotificationsService / findAll]: ", e);
			throw new Error(e);
		}
	}

	async markRead(id: string, req: Record<string, any>): Promise<void> {
		const userId: string = req.payload.id;

		const notification = await this.prismaService.notification.findUnique({
			where: { id },
		});

		if (!notification || notification.userId !== userId) {
			throw new NotFoundException();
		}

		await this.prismaService.notification.update({
			where: { id },
			data: { isReaded: true, updatedAt: new Date() },
		});
	}

	async markAllRead(req: Record<string, any>): Promise<void> {
		const userId: string = req.payload.id;

		await this.prismaService.notification.updateMany({
			where: { userId, isReaded: false },
			data: { isReaded: true, updatedAt: new Date() },
		});
	}
}
```

- [ ] **Step 9: Реализовать контроллер**

Создать `backend/src/notifications/notifications.controller.ts`:

```ts
import {
	Controller,
	Get,
	Param,
	Patch,
	Req,
	HttpCode,
	HttpStatus,
} from "@nestjs/common";
import { type Request } from "express";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
	constructor(private readonly notificationsService: NotificationsService) {}

	@Get()
	findAll(@Req() req: Request) {
		return this.notificationsService.findAll(req);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Patch("read-all")
	async markAllRead(@Req() req: Request) {
		await this.notificationsService.markAllRead(req);
		return HttpStatus.NO_CONTENT;
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Patch(":id/read")
	async markRead(@Param("id") id: string, @Req() req: Request) {
		await this.notificationsService.markRead(id, req);
		return HttpStatus.NO_CONTENT;
	}
}
```

Порядок методов важен: `read-all` объявлен до `:id/read`, иначе Nest сматчит `read-all` как `:id`.

- [ ] **Step 10: Реализовать модуль и зарегистрировать его**

Создать `backend/src/notifications/notifications.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { PrismaService } from "../prisma.service";

@Module({
	controllers: [NotificationsController],
	providers: [NotificationsService, PrismaService],
	exports: [NotificationsService],
})
export class NotificationsModule {}
```

В `backend/src/app.module.ts` добавить импорт после строки `import { GoalsModule } from "./goals/goals.module";`:

```ts
import { NotificationsModule } from "./notifications/notifications.module";
```

и в массив `imports` после `GoalsModule,`:

```ts
		NotificationsModule,
```

- [ ] **Step 11: Проверить сборку и юнит-тесты**

Run: `cd backend && npm run build && npx jest src/notifications`
Expected: сборка без ошибок, 5 passed

- [ ] **Step 12: Проверить эндпоинт вручную**

Run: `cd backend && npm run start:dev`
В другом терминале, с валидной кукой `token` от залогиненного юзера:

Run: `curl -s -b "token=$TOKEN" http://localhost:8000/api/v2/notifications`
Expected: `{"result":[],"unreadCount":0}`

Остановить сервер.

- [ ] **Step 13: Коммит**

```bash
git add backend/src/notifications backend/src/app.module.ts
git commit -m "Add notifications module with read tracking"
```

---

### Task 4: Модуль планера — CRUD

**Files:**
- Create: `backend/src/planner/dto/update-planner.dto.ts`
- Create: `backend/src/planner/dto/create-budget-item.dto.ts`
- Create: `backend/src/planner/dto/update-budget-item.dto.ts`
- Create: `backend/src/planner/dto/find-planner.dto.ts`
- Create: `backend/src/planner/serializer/planner.serializer.ts`
- Create: `backend/src/planner/planner.service.ts`
- Create: `backend/src/planner/planner.service.spec.ts`
- Create: `backend/src/planner/planner.controller.ts`
- Create: `backend/src/planner/planner.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`, `RatesService.convertPrice({ from, to, price }): Promise<number>`, `getMonthRange` (Task 1), сгенерированные типы Prisma (Task 2)
- Produces:
  - `PlannerService.getOrCreate(dto: FindPlannerDto, req): Promise<ISerializedPlanner>`
  - `PlannerService.update(id, dto: UpdatePlannerDto, req): Promise<ISerializedPlanner>`
  - `PlannerService.remove(id, req): Promise<void>`
  - `PlannerService.addItem(plannerId, dto: CreateBudgetItemDto, req): Promise<ISerializedPlanner>`
  - `PlannerService.updateItem(itemId, dto: UpdateBudgetItemDto, req): Promise<ISerializedPlanner>`
  - `PlannerService.removeItem(itemId, req): Promise<void>`
  - `PlannerSerializer.serialize(planner, spentByCategory: Record<string, number>, totalSpent: number): ISerializedPlanner`
  - `PlannerModule` экспортирует `PlannerService`

- [ ] **Step 1: Написать DTO**

Создать `backend/src/planner/dto/find-planner.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class FindPlannerDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsInt()
	@Min(2000)
	@Max(2100)
	@Type(() => Number)
	year?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(12)
	@Type(() => Number)
	month?: number;
}
```

Отдельного `CreatePlannerDto` нет: план создаётся пустым автоматически при первом `GET /planner`, а заработок и порог задаются через `PATCH`. Явный `POST /planner` не нужен.

Создать `backend/src/planner/dto/update-planner.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import {
	IsBoolean,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	Min,
} from "class-validator";

export class UpdatePlannerDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0)
	curIncome?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	currencyFromId?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0.01)
	@Max(1)
	alertThreshold?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsBoolean()
	isRegular?: boolean;
}
```

Создать `backend/src/planner/dto/create-budget-item.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import {
	IsBoolean,
	IsNumber,
	IsOptional,
	IsString,
	Min,
} from "class-validator";

export class CreateBudgetItemDto {
	@ApiProperty()
	@IsString()
	label: string;

	@ApiProperty()
	@IsNumber()
	@Min(0)
	curAmount: number;

	@ApiProperty()
	@IsString()
	currencyFromId: string;

	@ApiProperty()
	@IsString()
	expenseCategoryId: string;

	@ApiProperty({ required: false, default: false })
	@IsOptional()
	@IsBoolean()
	isRequired?: boolean;
}
```

Создать `backend/src/planner/dto/update-budget-item.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import {
	IsBoolean,
	IsNumber,
	IsOptional,
	IsString,
	Min,
} from "class-validator";

export class UpdateBudgetItemDto {
	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	label?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsNumber()
	@Min(0)
	curAmount?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	currencyFromId?: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsBoolean()
	isRequired?: boolean;
}
```

`expenseCategoryId` в update отсутствует намеренно: смена категории у существующей статьи ломает накопленный `notifiedThreshold` и требует пересчёта факта. Чтобы сменить категорию, статью удаляют и создают заново.

- [ ] **Step 2: Написать сериализатор**

Создать `backend/src/planner/serializer/planner.serializer.ts`:

```ts
export interface ISerializedBudgetItem {
	id: string;
	label: string;
	expenseCategory: {
		value: string;
		label: string;
		color: string;
	};
	curAmount: number;
	currency: string;
	convertedAmount: number;
	spent: number;
	progress: number;
	isRequired: boolean;
}

export interface ISerializedPlanner {
	id: string;
	year: number;
	month: number;
	currency: string;
	alertThreshold: number;
	isRegular: boolean;
	income: {
		cur: number;
		currency: string;
		converted: number;
	};
	planned: number;
	totalSpent: number;
	unallocated: number;
	progress: number;
	required: ISerializedBudgetItem[];
	additional: ISerializedBudgetItem[];
}

const round = (value: number): number => +value.toFixed(2);

export class PlannerSerializer {
	private static serializeItem(
		item: Record<string, any>,
		spent: number
	): ISerializedBudgetItem {
		return {
			id: item.id,
			label: item.label,
			expenseCategory: {
				value: item.expenseCategoryId,
				label:
					item.expenseCategory?.label?.[0]?.label ||
					item.expenseCategoryId,
				color: item.expenseCategory?.color || "#fff",
			},
			curAmount: item.curAmount,
			currency: item.currencyFromId,
			convertedAmount: item.convertedAmount,
			spent: round(spent),
			progress:
				item.convertedAmount > 0
					? round(spent / item.convertedAmount)
					: 0,
			isRequired: item.isRequired,
		};
	}

	static serialize(
		planner: Record<string, any>,
		spentByCategory: Record<string, number>,
		totalSpent: number
	): ISerializedPlanner {
		const items: Record<string, any>[] = planner.items || [];

		const planned = items.reduce(
			(acc, item) => acc + item.convertedAmount,
			0
		);

		const serializedItems = items.map((item) =>
			this.serializeItem(item, spentByCategory[item.expenseCategoryId] || 0)
		);

		return {
			id: planner.id,
			year: planner.year,
			month: planner.month,
			currency: planner.currencyToId,
			alertThreshold: planner.alertThreshold,
			isRegular: planner.isRegular,
			income: {
				cur: planner.curIncome,
				currency: planner.currencyFromId,
				converted: planner.convertedIncome,
			},
			planned: round(planned),
			totalSpent: round(totalSpent),
			unallocated: round(planner.convertedIncome - planned),
			progress:
				planner.convertedIncome > 0
					? round(totalSpent / planner.convertedIncome)
					: 0,
			required: serializedItems.filter((i) => i.isRequired),
			additional: serializedItems.filter((i) => !i.isRequired),
		};
	}
}
```

- [ ] **Step 3: Написать падающий тест сервиса**

Создать `backend/src/planner/planner.service.spec.ts`:

```ts
import { ConflictException, NotFoundException } from "@nestjs/common";
import { PlannerService } from "./planner.service";

const buildPrismaMock = () => ({
	financePlanner: {
		findUnique: jest.fn(),
		findFirst: jest.fn(),
		findMany: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
	},
	budgetItem: {
		findUnique: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		createMany: jest.fn(),
	},
	financeItem: {
		groupBy: jest.fn().mockResolvedValue([]),
		aggregate: jest.fn().mockResolvedValue({ _sum: { convertedPrice: 0 } }),
	},
});

const ratesMock = {
	convertPrice: jest.fn(),
};

const req = { payload: { id: "u1", exchange: "EUR" } };

const plannerRecord = {
	id: "p1",
	userId: "u1",
	year: 2026,
	month: 8,
	curIncome: 5000,
	currencyFromId: "USD",
	convertedIncome: 4600,
	currencyToId: "EUR",
	alertThreshold: 0.7,
	notifiedThreshold: null,
	isRegular: false,
	items: [],
};

describe("PlannerService", () => {
	let prisma: ReturnType<typeof buildPrismaMock>;
	let service: PlannerService;

	beforeEach(() => {
		prisma = buildPrismaMock();
		ratesMock.convertPrice.mockReset();
		service = new PlannerService(prisma as any, ratesMock as any);
	});

	describe("getOrCreate", () => {
		it("returns the existing planner for the requested month", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue(plannerRecord);

			const result = await service.getOrCreate({ year: 2026, month: 8 }, req);

			expect(prisma.financePlanner.findUnique).toHaveBeenCalledWith({
				where: { userId_year_month: { userId: "u1", year: 2026, month: 8 } },
				include: expect.any(Object),
			});
			expect(prisma.financePlanner.create).not.toHaveBeenCalled();
			expect(result.id).toBe("p1");
		});

		it("creates an empty planner in the user base currency when none exists", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue(null);
			prisma.financePlanner.create.mockResolvedValue({
				...plannerRecord,
				curIncome: 0,
				currencyFromId: "EUR",
				convertedIncome: 0,
			});

			const result = await service.getOrCreate({ year: 2026, month: 8 }, req);

			expect(prisma.financePlanner.create).toHaveBeenCalledWith({
				data: {
					userId: "u1",
					year: 2026,
					month: 8,
					curIncome: 0,
					currencyFromId: "EUR",
					convertedIncome: 0,
					currencyToId: "EUR",
				},
				include: expect.any(Object),
			});
			expect(result.income.converted).toBe(0);
		});
	});

	describe("update", () => {
		it("reconverts the income when the amount changes", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue(plannerRecord);
			ratesMock.convertPrice.mockResolvedValue(5520);
			prisma.financePlanner.update.mockResolvedValue({
				...plannerRecord,
				curIncome: 6000,
				convertedIncome: 5520,
			});

			await service.update("p1", { curIncome: 6000 }, req);

			expect(ratesMock.convertPrice).toHaveBeenCalledWith({
				from: "USD",
				to: "EUR",
				price: 6000,
			});
			expect(prisma.financePlanner.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						curIncome: 6000,
						convertedIncome: 5520,
					}),
				})
			);
		});

		it("clears notifiedThreshold when the threshold itself changes", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue({
				...plannerRecord,
				notifiedThreshold: 0.7,
			});
			prisma.financePlanner.update.mockResolvedValue(plannerRecord);

			await service.update("p1", { alertThreshold: 0.5 }, req);

			expect(prisma.financePlanner.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						alertThreshold: 0.5,
						notifiedThreshold: null,
					}),
				})
			);
		});

		it("rejects a planner that belongs to someone else", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue({
				...plannerRecord,
				userId: "someone-else",
			});

			await expect(
				service.update("p1", { curIncome: 1 }, req)
			).rejects.toBeInstanceOf(NotFoundException);
		});
	});

	describe("addItem", () => {
		it("converts the planned amount into the planner currency", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue(plannerRecord);
			ratesMock.convertPrice.mockResolvedValue(920);
			prisma.budgetItem.create.mockResolvedValue({});

			await service.addItem(
				"p1",
				{
					label: "Vacation",
					curAmount: 1000,
					currencyFromId: "USD",
					expenseCategoryId: "travel",
				},
				req
			);

			expect(ratesMock.convertPrice).toHaveBeenCalledWith({
				from: "USD",
				to: "EUR",
				price: 1000,
			});
			expect(prisma.budgetItem.create).toHaveBeenCalledWith({
				data: {
					plannerId: "p1",
					label: "Vacation",
					curAmount: 1000,
					currencyFromId: "USD",
					convertedAmount: 920,
					currencyToId: "EUR",
					expenseCategoryId: "travel",
					isRequired: false,
				},
			});
		});

		it("rejects a second item on the same expense category", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue({
				...plannerRecord,
				items: [{ id: "i1", expenseCategoryId: "travel" }],
			});

			await expect(
				service.addItem(
					"p1",
					{
						label: "Another trip",
						curAmount: 500,
						currencyFromId: "EUR",
						expenseCategoryId: "travel",
					},
					req
				)
			).rejects.toBeInstanceOf(ConflictException);
			expect(prisma.budgetItem.create).not.toHaveBeenCalled();
		});
	});

	describe("updateItem", () => {
		it("clears notifiedThreshold when the planned amount grows past the threshold", async () => {
			prisma.budgetItem.findUnique.mockResolvedValue({
				id: "i1",
				plannerId: "p1",
				curAmount: 1000,
				currencyFromId: "EUR",
				convertedAmount: 1000,
				currencyToId: "EUR",
				expenseCategoryId: "travel",
				notifiedThreshold: 0.7,
				planner: plannerRecord,
			});
			prisma.financeItem.aggregate.mockResolvedValue({
				_sum: { convertedPrice: 700 },
			});
			ratesMock.convertPrice.mockResolvedValue(2000);
			prisma.financePlanner.findUnique.mockResolvedValue(plannerRecord);
			prisma.budgetItem.update.mockResolvedValue({});

			await service.updateItem("i1", { curAmount: 2000 }, req);

			expect(prisma.budgetItem.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						convertedAmount: 2000,
						notifiedThreshold: null,
					}),
				})
			);
		});
	});

	describe("copyRegularPlanners", () => {
		it("copies items into the next month without carrying notifiedThreshold", async () => {
			prisma.financePlanner.findMany.mockResolvedValue([
				{
					...plannerRecord,
					isRegular: true,
					notifiedThreshold: 0.7,
					items: [
						{
							label: "Rent",
							curAmount: 1200,
							currencyFromId: "EUR",
							convertedAmount: 1200,
							currencyToId: "EUR",
							expenseCategoryId: "housing",
							isRequired: true,
							notifiedThreshold: 0.7,
						},
					],
				},
			]);
			prisma.financePlanner.findUnique.mockResolvedValue(null);
			prisma.financePlanner.create.mockResolvedValue({ id: "p2" });

			await service.copyRegularPlanners(2026, 9);

			expect(prisma.financePlanner.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					year: 2026,
					month: 9,
					notifiedThreshold: null,
					isRegular: true,
				}),
			});
			expect(prisma.budgetItem.createMany).toHaveBeenCalledWith({
				data: [
					{
						plannerId: "p2",
						label: "Rent",
						curAmount: 1200,
						currencyFromId: "EUR",
						convertedAmount: 1200,
						currencyToId: "EUR",
						expenseCategoryId: "housing",
						isRequired: true,
					},
				],
			});
		});

		it("skips a month that already has a planner", async () => {
			prisma.financePlanner.findMany.mockResolvedValue([
				{ ...plannerRecord, isRegular: true, items: [] },
			]);
			prisma.financePlanner.findUnique.mockResolvedValue({ id: "existing" });

			await service.copyRegularPlanners(2026, 9);

			expect(prisma.financePlanner.create).not.toHaveBeenCalled();
		});
	});
});
```

- [ ] **Step 4: Убедиться, что тест падает**

Run: `cd backend && npx jest src/planner`
Expected: FAIL — `Cannot find module './planner.service'`

- [ ] **Step 5: Реализовать сервис**

Создать `backend/src/planner/planner.service.ts`:

```ts
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import { PrismaService } from "../prisma.service";
import { RatesService } from "../rates/rates.service";
import { getMonthRange } from "../../utils/date";
import { CreateBudgetItemDto } from "./dto/create-budget-item.dto";
import { UpdateBudgetItemDto } from "./dto/update-budget-item.dto";
import { UpdatePlannerDto } from "./dto/update-planner.dto";
import { FindPlannerDto } from "./dto/find-planner.dto";
import { ISerializedPlanner, PlannerSerializer } from "./serializer/planner.serializer";

const DEFAULT_CURRENCY = "EUR";

@Injectable()
export class PlannerService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly ratesService: RatesService
	) {}

	private itemsInclude() {
		const lang = I18nContext.current()?.lang || "en";

		return {
			items: {
				orderBy: { createdAt: "asc" as const },
				include: {
					expenseCategory: {
						include: {
							label: { where: { lang } },
						},
					},
				},
			},
		};
	}

	private baseCurrency(req: Record<string, any>): string {
		return req.payload?.exchange || DEFAULT_CURRENCY;
	}

	private async convert(
		price: number,
		from: string,
		to: string
	): Promise<number> {
		if (from === to) {
			return price;
		}

		return this.ratesService.convertPrice({ from, to, price });
	}

	private async loadOwnedPlanner(id: string, userId: string) {
		const planner = await this.prismaService.financePlanner.findUnique({
			where: { id },
			include: this.itemsInclude(),
		});

		if (!planner || planner.userId !== userId) {
			throw new NotFoundException();
		}

		return planner;
	}

	private async collectSpent(userId: string, year: number, month: number) {
		const period = getMonthRange(year, month);

		const grouped = await this.prismaService.financeItem.groupBy({
			by: ["expenseCategoryId"],
			where: {
				userId,
				operationCategoryId: "expense",
				createdAt: period,
			},
			_sum: { convertedPrice: true },
		});

		const spentByCategory: Record<string, number> = {};
		let totalSpent = 0;

		for (const row of grouped) {
			const sum = row._sum.convertedPrice || 0;
			totalSpent += sum;

			if (row.expenseCategoryId) {
				spentByCategory[row.expenseCategoryId] = sum;
			}
		}

		return { spentByCategory, totalSpent };
	}

	private async present(
		planner: Record<string, any>
	): Promise<ISerializedPlanner> {
		const { spentByCategory, totalSpent } = await this.collectSpent(
			planner.userId,
			planner.year,
			planner.month
		);

		return PlannerSerializer.serialize(planner, spentByCategory, totalSpent);
	}

	async getOrCreate(
		dto: FindPlannerDto,
		req: Record<string, any>
	): Promise<ISerializedPlanner> {
		try {
			const userId: string = req.payload.id;
			const now = new Date();
			const year = dto.year || now.getUTCFullYear();
			const month = dto.month || now.getUTCMonth() + 1;

			let planner = await this.prismaService.financePlanner.findUnique({
				where: { userId_year_month: { userId, year, month } },
				include: this.itemsInclude(),
			});

			if (!planner) {
				const currency = this.baseCurrency(req);

				planner = await this.prismaService.financePlanner.create({
					data: {
						userId,
						year,
						month,
						curIncome: 0,
						currencyFromId: currency,
						convertedIncome: 0,
						currencyToId: currency,
					},
					include: this.itemsInclude(),
				});
			}

			return this.present(planner);
		} catch (e) {
			console.warn("[PlannerService / getOrCreate]: ", e);
			throw e;
		}
	}

	async update(
		id: string,
		dto: UpdatePlannerDto,
		req: Record<string, any>
	): Promise<ISerializedPlanner> {
		const userId: string = req.payload.id;
		const planner = await this.loadOwnedPlanner(id, userId);

		const data: Record<string, any> = { updatedAt: new Date() };

		if (dto.isRegular !== undefined) {
			data.isRegular = dto.isRegular;
		}

		if (dto.alertThreshold !== undefined) {
			data.alertThreshold = dto.alertThreshold;

			if (dto.alertThreshold !== planner.alertThreshold) {
				data.notifiedThreshold = null;
			}
		}

		if (dto.curIncome !== undefined || dto.currencyFromId !== undefined) {
			const curIncome =
				dto.curIncome !== undefined ? dto.curIncome : planner.curIncome;
			const currencyFromId = dto.currencyFromId || planner.currencyFromId;

			data.curIncome = curIncome;
			data.currencyFromId = currencyFromId;
			data.convertedIncome = await this.convert(
				curIncome,
				currencyFromId,
				planner.currencyToId
			);
			data.notifiedThreshold = null;
		}

		await this.prismaService.financePlanner.update({
			where: { id },
			data,
		});

		return this.present(await this.loadOwnedPlanner(id, userId));
	}

	async remove(id: string, req: Record<string, any>): Promise<void> {
		const userId: string = req.payload.id;
		await this.loadOwnedPlanner(id, userId);

		await this.prismaService.financePlanner.delete({ where: { id } });
	}

	async addItem(
		plannerId: string,
		dto: CreateBudgetItemDto,
		req: Record<string, any>
	): Promise<ISerializedPlanner> {
		const userId: string = req.payload.id;
		const planner = await this.loadOwnedPlanner(plannerId, userId);

		const isTaken = (planner.items || []).some(
			(item: Record<string, any>) =>
				item.expenseCategoryId === dto.expenseCategoryId
		);

		if (isTaken) {
			throw new ConflictException({ message: "category_already_planned" });
		}

		const convertedAmount = await this.convert(
			dto.curAmount,
			dto.currencyFromId,
			planner.currencyToId
		);

		await this.prismaService.budgetItem.create({
			data: {
				plannerId,
				label: dto.label,
				curAmount: dto.curAmount,
				currencyFromId: dto.currencyFromId,
				convertedAmount,
				currencyToId: planner.currencyToId,
				expenseCategoryId: dto.expenseCategoryId,
				isRequired: dto.isRequired || false,
			},
		});

		return this.present(await this.loadOwnedPlanner(plannerId, userId));
	}

	async updateItem(
		itemId: string,
		dto: UpdateBudgetItemDto,
		req: Record<string, any>
	): Promise<ISerializedPlanner> {
		const userId: string = req.payload.id;

		const item = await this.prismaService.budgetItem.findUnique({
			where: { id: itemId },
			include: { planner: true },
		});

		if (!item || item.planner.userId !== userId) {
			throw new NotFoundException();
		}

		const data: Record<string, any> = { updatedAt: new Date() };

		if (dto.label !== undefined) {
			data.label = dto.label;
		}

		if (dto.isRequired !== undefined) {
			data.isRequired = dto.isRequired;
		}

		if (dto.curAmount !== undefined || dto.currencyFromId !== undefined) {
			const curAmount =
				dto.curAmount !== undefined ? dto.curAmount : item.curAmount;
			const currencyFromId = dto.currencyFromId || item.currencyFromId;

			data.curAmount = curAmount;
			data.currencyFromId = currencyFromId;
			data.convertedAmount = await this.convert(
				curAmount,
				currencyFromId,
				item.currencyToId
			);

			const spent = await this.spentForCategory(
				userId,
				item.expenseCategoryId,
				item.planner.year,
				item.planner.month
			);

			const progress =
				data.convertedAmount > 0 ? spent / data.convertedAmount : 0;

			if (progress < item.planner.alertThreshold) {
				data.notifiedThreshold = null;
			}
		}

		await this.prismaService.budgetItem.update({
			where: { id: itemId },
			data,
		});

		return this.present(
			await this.loadOwnedPlanner(item.plannerId, userId)
		);
	}

	async removeItem(itemId: string, req: Record<string, any>): Promise<void> {
		const userId: string = req.payload.id;

		const item = await this.prismaService.budgetItem.findUnique({
			where: { id: itemId },
			include: { planner: true },
		});

		if (!item || item.planner.userId !== userId) {
			throw new NotFoundException();
		}

		await this.prismaService.budgetItem.delete({ where: { id: itemId } });
	}

	async spentForCategory(
		userId: string,
		expenseCategoryId: string,
		year: number,
		month: number
	): Promise<number> {
		const result = await this.prismaService.financeItem.aggregate({
			where: {
				userId,
				operationCategoryId: "expense",
				expenseCategoryId,
				createdAt: getMonthRange(year, month),
			},
			_sum: { convertedPrice: true },
		});

		return result._sum.convertedPrice || 0;
	}

	async copyRegularPlanners(year: number, month: number): Promise<void> {
		const previousMonth = month === 1 ? 12 : month - 1;
		const previousYear = month === 1 ? year - 1 : year;

		const sources = await this.prismaService.financePlanner.findMany({
			where: { isRegular: true, year: previousYear, month: previousMonth },
			include: { items: true },
		});

		for (const source of sources) {
			const existing =
				await this.prismaService.financePlanner.findUnique({
					where: {
						userId_year_month: {
							userId: source.userId,
							year,
							month,
						},
					},
				});

			if (existing) {
				continue;
			}

			const created = await this.prismaService.financePlanner.create({
				data: {
					userId: source.userId,
					year,
					month,
					curIncome: source.curIncome,
					currencyFromId: source.currencyFromId,
					convertedIncome: source.convertedIncome,
					currencyToId: source.currencyToId,
					alertThreshold: source.alertThreshold,
					notifiedThreshold: null,
					isRegular: true,
				},
			});

			if (!source.items.length) {
				continue;
			}

			await this.prismaService.budgetItem.createMany({
				data: source.items.map((item: Record<string, any>) => ({
					plannerId: created.id,
					label: item.label,
					curAmount: item.curAmount,
					currencyFromId: item.currencyFromId,
					convertedAmount: item.convertedAmount,
					currencyToId: item.currencyToId,
					expenseCategoryId: item.expenseCategoryId,
					isRequired: item.isRequired,
				})),
			});
		}
	}
}
```

- [ ] **Step 6: Убедиться, что тесты проходят**

Run: `cd backend && npx jest src/planner`
Expected: PASS, 10 passed

- [ ] **Step 7: Реализовать контроллер**

Создать `backend/src/planner/planner.controller.ts`:

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
import { PlannerService } from "./planner.service";
import { FindPlannerDto } from "./dto/find-planner.dto";
import { UpdatePlannerDto } from "./dto/update-planner.dto";
import { CreateBudgetItemDto } from "./dto/create-budget-item.dto";
import { UpdateBudgetItemDto } from "./dto/update-budget-item.dto";

@Controller("planner")
@UsePipes(new ValidationPipe({ transform: true }))
export class PlannerController {
	constructor(private readonly plannerService: PlannerService) {}

	@Get()
	getOrCreate(@Query() dto: FindPlannerDto, @Req() req: Request) {
		return this.plannerService.getOrCreate(dto, req);
	}

	@Patch(":id")
	update(
		@Param("id") id: string,
		@Body() dto: UpdatePlannerDto,
		@Req() req: Request
	) {
		return this.plannerService.update(id, dto, req);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(":id")
	async remove(@Param("id") id: string, @Req() req: Request) {
		await this.plannerService.remove(id, req);
		return HttpStatus.NO_CONTENT;
	}

	@HttpCode(HttpStatus.CREATED)
	@Post(":id/items")
	addItem(
		@Param("id") id: string,
		@Body() dto: CreateBudgetItemDto,
		@Req() req: Request
	) {
		return this.plannerService.addItem(id, dto, req);
	}

	@Patch("items/:itemId")
	updateItem(
		@Param("itemId") itemId: string,
		@Body() dto: UpdateBudgetItemDto,
		@Req() req: Request
	) {
		return this.plannerService.updateItem(itemId, dto, req);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete("items/:itemId")
	async removeItem(@Param("itemId") itemId: string, @Req() req: Request) {
		await this.plannerService.removeItem(itemId, req);
		return HttpStatus.NO_CONTENT;
	}
}
```

Конфликта между `:id` и `items/:itemId` нет: `:id` — это ровно один сегмент пути, а `items/:itemId` — два, так что `PATCH /planner/items/x` не может быть перехвачен маршрутом `PATCH /planner/:id`.

- [ ] **Step 8: Реализовать модуль и зарегистрировать**

Создать `backend/src/planner/planner.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PlannerService } from "./planner.service";
import { PlannerController } from "./planner.controller";
import { PrismaService } from "../prisma.service";
import { RatesService } from "../rates/rates.service";
import { TranslateService } from "../translate/translate.service";
import { MailService } from "../mail/mail.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
	imports: [ConfigModule, NotificationsModule],
	controllers: [PlannerController],
	providers: [
		PlannerService,
		PrismaService,
		RatesService,
		TranslateService,
		MailService,
	],
	exports: [PlannerService],
})
export class PlannerModule {}
```

`RatesService` тянет за собой `TranslateService` и `MailService` — точно так же, как это уже сделано в `FinanceModule`.

В `backend/src/app.module.ts` добавить импорт:

```ts
import { PlannerModule } from "./planner/planner.module";
```

и в массив `imports` после `NotificationsModule,`:

```ts
		PlannerModule,
```

- [ ] **Step 9: Проверить сборку и тесты**

Run: `cd backend && npm run build && npx jest`
Expected: сборка без ошибок, все тесты зелёные

- [ ] **Step 10: Проверить эндпоинт вручную**

Run: `cd backend && npm run start:dev`

Run: `curl -s -b "token=$TOKEN" http://localhost:8000/api/v2/planner`
Expected: JSON с `"planned":0`, `"required":[]`, `"additional":[]`, `"alertThreshold":0.7`

Остановить сервер.

- [ ] **Step 11: Коммит**

```bash
git add backend/src/planner backend/src/app.module.ts
git commit -m "Add planner module with monthly budget CRUD"
```

---

### Task 5: Проверка порога и уведомления

**Files:**
- Create: `backend/src/planner/budget-alert.service.ts`
- Create: `backend/src/planner/budget-alert.service.spec.ts`
- Modify: `backend/src/planner/planner.module.ts`
- Modify: `backend/src/finance/finance.service.ts`
- Modify: `backend/src/finance/finance.controller.ts`
- Modify: `backend/src/finance/finance.module.ts`

**Interfaces:**
- Consumes: `PrismaService`, `NotificationsService.create` (Task 3), `PlannerService.spentForCategory` (Task 4), `getMonthRange` (Task 1), `ENotificationType` (Task 3)
- Produces:
  - `BudgetAlertService.checkAfterExpense({ userId, expenseCategoryId, date? }): Promise<ISerializedNotification[]>`
  - `BudgetAlertService.resetAfterChange({ userId, expenseCategoryId, date? }): Promise<void>`
  - `FinanceService.create` возвращает `Promise<{ notifications: ISerializedNotification[] }>`

- [ ] **Step 1: Написать падающий тест**

Создать `backend/src/planner/budget-alert.service.spec.ts`:

```ts
import { BudgetAlertService } from "./budget-alert.service";
import { ENotificationType } from "../notifications/types";

const plannerWithItem = (overrides: Record<string, any> = {}) => ({
	id: "p1",
	userId: "u1",
	year: 2026,
	month: 8,
	convertedIncome: 5000,
	currencyToId: "EUR",
	alertThreshold: 0.7,
	notifiedThreshold: null,
	items: [
		{
			id: "i1",
			label: "Vacation",
			expenseCategoryId: "travel",
			convertedAmount: 1000,
			notifiedThreshold: null,
		},
	],
	...overrides,
});

const buildMocks = () => {
	const prisma = {
		financePlanner: {
			findUnique: jest.fn(),
			update: jest.fn().mockResolvedValue({}),
		},
		budgetItem: {
			update: jest.fn().mockResolvedValue({}),
		},
		financeItem: {
			aggregate: jest.fn(),
			groupBy: jest.fn().mockResolvedValue([]),
		},
	};

	const notifications = {
		create: jest.fn().mockImplementation(async ({ type }) => ({
			id: "n1",
			type,
			title: "t",
			text: "x",
			isReaded: false,
			createdAt: new Date(),
		})),
	};

	return { prisma, notifications };
};

const args = {
	userId: "u1",
	expenseCategoryId: "travel",
	date: new Date("2026-08-15T12:00:00.000Z"),
};

/**
 * spentByCategory drives the per-item aggregate, totalSpent drives the
 * plan-wide aggregate. The service calls aggregate for the category first
 * and for the whole month second.
 */
const stubSpend = (
	prisma: ReturnType<typeof buildMocks>["prisma"],
	categorySpent: number,
	totalSpent: number
) => {
	prisma.financeItem.aggregate
		.mockResolvedValueOnce({ _sum: { convertedPrice: categorySpent } })
		.mockResolvedValueOnce({ _sum: { convertedPrice: totalSpent } });
};

describe("BudgetAlertService", () => {
	let prisma: ReturnType<typeof buildMocks>["prisma"];
	let notifications: ReturnType<typeof buildMocks>["notifications"];
	let service: BudgetAlertService;

	beforeEach(() => {
		({ prisma, notifications } = buildMocks());
		service = new BudgetAlertService(prisma as any, notifications as any);
	});

	it("stays silent at 69.9% of the item plan", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(plannerWithItem());
		stubSpend(prisma, 699, 699);

		const result = await service.checkAfterExpense(args);

		expect(notifications.create).not.toHaveBeenCalled();
		expect(result).toEqual([]);
	});

	it("fires exactly at 70% of the item plan", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(plannerWithItem());
		stubSpend(prisma, 700, 700);

		const result = await service.checkAfterExpense(args);

		expect(notifications.create).toHaveBeenCalledWith({
			userId: "u1",
			type: ENotificationType.BudgetItemThreshold,
			params: {
				label: "Vacation",
				percent: 70,
				spent: 700,
				planned: 1000,
				currency: "EUR",
			},
		});
		expect(prisma.budgetItem.update).toHaveBeenCalledWith({
			where: { id: "i1" },
			data: { notifiedThreshold: 0.7, updatedAt: expect.any(Date) },
		});
		expect(result).toHaveLength(1);
	});

	it("fires above the threshold too", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(plannerWithItem());
		stubSpend(prisma, 701, 701);

		await service.checkAfterExpense(args);

		expect(notifications.create).toHaveBeenCalledTimes(1);
	});

	it("does not fire twice for the same threshold", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(
			plannerWithItem({
				items: [
					{
						id: "i1",
						label: "Vacation",
						expenseCategoryId: "travel",
						convertedAmount: 1000,
						notifiedThreshold: 0.7,
					},
				],
			})
		);
		stubSpend(prisma, 850, 850);

		const result = await service.checkAfterExpense(args);

		expect(notifications.create).not.toHaveBeenCalled();
		expect(result).toEqual([]);
	});

	it("fires again after the threshold is lowered", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(
			plannerWithItem({
				alertThreshold: 0.5,
				items: [
					{
						id: "i1",
						label: "Vacation",
						expenseCategoryId: "travel",
						convertedAmount: 1000,
						notifiedThreshold: 0.7,
					},
				],
			})
		);
		stubSpend(prisma, 600, 600);

		await service.checkAfterExpense(args);

		expect(notifications.create).toHaveBeenCalledTimes(1);
		expect(prisma.budgetItem.update).toHaveBeenCalledWith({
			where: { id: "i1" },
			data: { notifiedThreshold: 0.5, updatedAt: expect.any(Date) },
		});
	});

	it("fires for the overall budget when total spending crosses the threshold", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(
			plannerWithItem({ items: [] })
		);
		prisma.financeItem.aggregate.mockResolvedValue({
			_sum: { convertedPrice: 3500 },
		});

		const result = await service.checkAfterExpense(args);

		expect(notifications.create).toHaveBeenCalledWith({
			userId: "u1",
			type: ENotificationType.BudgetTotalThreshold,
			params: {
				percent: 70,
				spent: 3500,
				planned: 5000,
				currency: "EUR",
			},
		});
		expect(result).toHaveLength(1);
	});

	it("can fire for the item and the overall budget at once", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(plannerWithItem());
		stubSpend(prisma, 700, 3500);

		const result = await service.checkAfterExpense(args);

		expect(result).toHaveLength(2);
	});

	it("does nothing when the user has no planner for that month", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(null);

		const result = await service.checkAfterExpense(args);

		expect(result).toEqual([]);
		expect(prisma.financeItem.aggregate).not.toHaveBeenCalled();
	});

	it("skips an item with a zero planned amount", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(
			plannerWithItem({
				convertedIncome: 0,
				items: [
					{
						id: "i1",
						label: "Vacation",
						expenseCategoryId: "travel",
						convertedAmount: 0,
						notifiedThreshold: null,
					},
				],
			})
		);
		stubSpend(prisma, 500, 500);

		const result = await service.checkAfterExpense(args);

		expect(notifications.create).not.toHaveBeenCalled();
		expect(result).toEqual([]);
	});

	it("ignores an expense in a category that is not planned", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(plannerWithItem());
		prisma.financeItem.aggregate.mockResolvedValue({
			_sum: { convertedPrice: 100 },
		});

		const result = await service.checkAfterExpense({
			...args,
			expenseCategoryId: "food",
		});

		expect(notifications.create).not.toHaveBeenCalled();
		expect(result).toEqual([]);
	});

	it("tolerates an expense with no category at all", async () => {
		prisma.financePlanner.findUnique.mockResolvedValue(plannerWithItem());
		prisma.financeItem.aggregate.mockResolvedValue({
			_sum: { convertedPrice: 100 },
		});

		const result = await service.checkAfterExpense({
			...args,
			expenseCategoryId: null,
		});

		expect(result).toEqual([]);
	});

	describe("resetAfterChange", () => {
		it("clears notifiedThreshold once spending drops below the threshold", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue(
				plannerWithItem({
					notifiedThreshold: 0.7,
					items: [
						{
							id: "i1",
							label: "Vacation",
							expenseCategoryId: "travel",
							convertedAmount: 1000,
							notifiedThreshold: 0.7,
						},
					],
				})
			);
			stubSpend(prisma, 300, 300);

			await service.resetAfterChange(args);

			expect(prisma.budgetItem.update).toHaveBeenCalledWith({
				where: { id: "i1" },
				data: { notifiedThreshold: null, updatedAt: expect.any(Date) },
			});
			expect(prisma.financePlanner.update).toHaveBeenCalledWith({
				where: { id: "p1" },
				data: { notifiedThreshold: null, updatedAt: expect.any(Date) },
			});
		});

		it("leaves notifiedThreshold alone while spending is still above the threshold", async () => {
			prisma.financePlanner.findUnique.mockResolvedValue(
				plannerWithItem({
					notifiedThreshold: 0.7,
					items: [
						{
							id: "i1",
							label: "Vacation",
							expenseCategoryId: "travel",
							convertedAmount: 1000,
							notifiedThreshold: 0.7,
						},
					],
				})
			);
			stubSpend(prisma, 900, 4500);

			await service.resetAfterChange(args);

			expect(prisma.budgetItem.update).not.toHaveBeenCalled();
			expect(prisma.financePlanner.update).not.toHaveBeenCalled();
		});
	});
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd backend && npx jest src/planner/budget-alert.service.spec.ts`
Expected: FAIL — `Cannot find module './budget-alert.service'`

- [ ] **Step 3: Реализовать сервис**

Создать `backend/src/planner/budget-alert.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ENotificationType, ISerializedNotification } from "../notifications/types";
import { getMonthRange } from "../../utils/date";

interface ICheckArgs {
	userId: string;
	expenseCategoryId: string | null;
	date?: Date;
}

const round = (value: number): number => +value.toFixed(2);

@Injectable()
export class BudgetAlertService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly notificationsService: NotificationsService
	) {}

	private async loadPlanner(userId: string, date: Date) {
		const year = date.getUTCFullYear();
		const month = date.getUTCMonth() + 1;

		const planner = await this.prismaService.financePlanner.findUnique({
			where: { userId_year_month: { userId, year, month } },
			include: { items: true },
		});

		return { planner, year, month };
	}

	private async sumExpenses(
		userId: string,
		year: number,
		month: number,
		expenseCategoryId?: string
	): Promise<number> {
		const where: Record<string, any> = {
			userId,
			operationCategoryId: "expense",
			createdAt: getMonthRange(year, month),
		};

		if (expenseCategoryId) {
			where.expenseCategoryId = expenseCategoryId;
		}

		const result = await this.prismaService.financeItem.aggregate({
			where,
			_sum: { convertedPrice: true },
		});

		return result._sum.convertedPrice || 0;
	}

	async checkAfterExpense({
		userId,
		expenseCategoryId,
		date = new Date(),
	}: ICheckArgs): Promise<ISerializedNotification[]> {
		try {
			const { planner, year, month } = await this.loadPlanner(userId, date);

			if (!planner) {
				return [];
			}

			const threshold = planner.alertThreshold;
			const notifications: ISerializedNotification[] = [];

			const item = expenseCategoryId
				? (planner.items || []).find(
						(i: Record<string, any>) =>
							i.expenseCategoryId === expenseCategoryId
					)
				: undefined;

			if (item && item.convertedAmount > 0) {
				const spent = await this.sumExpenses(
					userId,
					year,
					month,
					expenseCategoryId
				);
				const progress = spent / item.convertedAmount;

				if (
					progress >= threshold &&
					item.notifiedThreshold !== threshold
				) {
					const notification =
						await this.notificationsService.create({
							userId,
							type: ENotificationType.BudgetItemThreshold,
							params: {
								label: item.label,
								percent: Math.round(progress * 100),
								spent: round(spent),
								planned: item.convertedAmount,
								currency: planner.currencyToId,
							},
						});

					await this.prismaService.budgetItem.update({
						where: { id: item.id },
						data: {
							notifiedThreshold: threshold,
							updatedAt: new Date(),
						},
					});

					if (notification) {
						notifications.push(notification);
					}
				}
			}

			if (planner.convertedIncome > 0) {
				const totalSpent = await this.sumExpenses(userId, year, month);
				const progress = totalSpent / planner.convertedIncome;

				if (
					progress >= threshold &&
					planner.notifiedThreshold !== threshold
				) {
					const notification =
						await this.notificationsService.create({
							userId,
							type: ENotificationType.BudgetTotalThreshold,
							params: {
								percent: Math.round(progress * 100),
								spent: round(totalSpent),
								planned: planner.convertedIncome,
								currency: planner.currencyToId,
							},
						});

					await this.prismaService.financePlanner.update({
						where: { id: planner.id },
						data: {
							notifiedThreshold: threshold,
							updatedAt: new Date(),
						},
					});

					if (notification) {
						notifications.push(notification);
					}
				}
			}

			return notifications;
		} catch (e) {
			console.warn("[BudgetAlertService / checkAfterExpense]: ", e);
			return [];
		}
	}

	async resetAfterChange({
		userId,
		expenseCategoryId,
		date = new Date(),
	}: ICheckArgs): Promise<void> {
		try {
			const { planner, year, month } = await this.loadPlanner(userId, date);

			if (!planner) {
				return;
			}

			const threshold = planner.alertThreshold;

			const item = expenseCategoryId
				? (planner.items || []).find(
						(i: Record<string, any>) =>
							i.expenseCategoryId === expenseCategoryId
					)
				: undefined;

			if (
				item &&
				item.notifiedThreshold !== null &&
				item.convertedAmount > 0
			) {
				const spent = await this.sumExpenses(
					userId,
					year,
					month,
					expenseCategoryId
				);

				if (spent / item.convertedAmount < threshold) {
					await this.prismaService.budgetItem.update({
						where: { id: item.id },
						data: {
							notifiedThreshold: null,
							updatedAt: new Date(),
						},
					});
				}
			}

			if (
				planner.notifiedThreshold !== null &&
				planner.convertedIncome > 0
			) {
				const totalSpent = await this.sumExpenses(userId, year, month);

				if (totalSpent / planner.convertedIncome < threshold) {
					await this.prismaService.financePlanner.update({
						where: { id: planner.id },
						data: {
							notifiedThreshold: null,
							updatedAt: new Date(),
						},
					});
				}
			}
		} catch (e) {
			console.warn("[BudgetAlertService / resetAfterChange]: ", e);
		}
	}
}
```

`checkAfterExpense` глотает ошибки и возвращает пустой массив намеренно: сбой подсчёта порога не должен отменять уже сохранённую трату.

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `cd backend && npx jest src/planner/budget-alert.service.spec.ts`
Expected: PASS, 13 passed

- [ ] **Step 5: Экспортировать сервис из модуля**

В `backend/src/planner/planner.module.ts` добавить импорт:

```ts
import { BudgetAlertService } from "./budget-alert.service";
```

Добавить `BudgetAlertService` в массив `providers` и заменить `exports`:

```ts
	exports: [PlannerService, BudgetAlertService],
```

- [ ] **Step 6: Подключить проверку к созданию траты**

В `backend/src/finance/finance.service.ts` добавить импорты:

```ts
import { BudgetAlertService } from "../planner/budget-alert.service";
import { ISerializedNotification } from "../notifications/types";
```

Добавить зависимость в конструктор `FinanceService` последним параметром:

```ts
		private readonly budgetAlertService: BudgetAlertService
```

Изменить сигнатуру `create` и её последние строки. Было:

```ts
	async create(
		createFinanceDto: CreateFinanceDto,
		req: Record<string, any>
	): Promise<void> {
```

Стало:

```ts
	async create(
		createFinanceDto: CreateFinanceDto,
		req: Record<string, any>
	): Promise<{ notifications: ISerializedNotification[] }> {
```

В конце метода заменить:

```ts
		await this.usersService.update({ total }, req);
	}
```

на:

```ts
		await this.usersService.update({ total }, req);

		if (operationCategoryId !== "expense") {
			return { notifications: [] };
		}

		const notifications = await this.budgetAlertService.checkAfterExpense({
			userId: user.id,
			expenseCategoryId: createFinanceDto.expenseCategoryId || null,
		});

		return { notifications };
	}
```

- [ ] **Step 7: Подключить сброс к удалению траты**

В `backend/src/finance/finance.service.ts` заменить метод `remove` целиком:

```ts
	async remove(id: string) {
		try {
			const item = await this.prismaService.financeItem.findUnique({
				where: { id },
			});

			await this.prismaService.financeItem.delete({
				where: { id },
			});

			if (item && item.operationCategoryId === "expense") {
				await this.budgetAlertService.resetAfterChange({
					userId: item.userId,
					expenseCategoryId: item.expenseCategoryId,
					date: item.createdAt,
				});
			}
		} catch (e) {
			console.warn("[FinanceService / remove]: ", e);
			throw new Error(e);
		}
	}
```

- [ ] **Step 8: Вернуть уведомления из контроллера**

В `backend/src/finance/finance.controller.ts` заменить метод `create`:

```ts
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UsePipes(new ValidationPipe({ transform: true }))
	async create(
		@Body() createFinanceDto: CreateFinanceDto,
		@Req() req: Request
	) {
		return this.financeService.create(createFinanceDto, req);
	}
```

- [ ] **Step 9: Подключить `PlannerModule` к `FinanceModule`**

В `backend/src/finance/finance.module.ts` добавить импорт:

```ts
import { PlannerModule } from "../planner/planner.module";
```

и добавить `PlannerModule` в массив `imports` — после `JwtModule.registerAsync({...})`:

```ts
		PlannerModule,
```

`PlannerModule` уже импортирует `NotificationsModule`, а `BudgetAlertService` в его `exports` — так что `FinanceService` получит зависимость без дублирования провайдеров.

- [ ] **Step 10: Проверить сборку и все тесты**

Run: `cd backend && npm run build && npx jest`
Expected: сборка без ошибок, все тесты зелёные

- [ ] **Step 11: Проверить сценарий вручную**

Run: `cd backend && npm run start:dev`

1. Создать план и статью:

```bash
curl -s -b "token=$TOKEN" -X PATCH http://localhost:8000/api/v2/planner/$PLANNER_ID \
  -H "Content-Type: application/json" \
  -d '{"curIncome":1000,"currencyFromId":"EUR"}'
```

```bash
curl -s -b "token=$TOKEN" -X POST http://localhost:8000/api/v2/planner/$PLANNER_ID/items \
  -H "Content-Type: application/json" \
  -d '{"label":"Vacation","curAmount":100,"currencyFromId":"EUR","expenseCategoryId":"travel"}'
```

2. Добавить трату на 70 EUR в категории `travel`:

```bash
curl -s -b "token=$TOKEN" -X POST http://localhost:8000/api/v2/finance \
  -H "Content-Type: application/json" \
  -d '{"curPrice":70,"currencyFromId":"EUR","operationCategoryId":"expense","expenseCategoryId":"travel"}'
```

Expected: ответ содержит `"notifications"` с одним элементом типа `budget.item.threshold` и заголовком, включающим `Vacation` и `70%`.

3. Повторить тот же запрос ещё раз.

Expected: `"notifications":[]` по статье — второй раз порог не срабатывает (уведомление про общий бюджет может прийти отдельно).

Остановить сервер.

- [ ] **Step 12: Коммит**

```bash
git add backend/src/planner backend/src/finance
git commit -m "Add budget threshold alerts on expense creation"
```

---

### Task 6: Автокопирование регулярных планов

**Files:**
- Create: `backend/src/planner/planner.cron.ts`
- Create: `backend/src/planner/planner.cron.spec.ts`
- Modify: `backend/src/planner/planner.module.ts`

**Interfaces:**
- Consumes: `PlannerService.copyRegularPlanners(year, month)` (Task 4)
- Produces: `PlannerCron.copyRegularPlanners()` — метод с декоратором `@Cron`, срабатывающий 1-го числа каждого месяца в 00:05 UTC

- [ ] **Step 1: Написать падающий тест**

Создать `backend/src/planner/planner.cron.spec.ts`:

```ts
import { PlannerCron } from "./planner.cron";

describe("PlannerCron", () => {
	const plannerService = { copyRegularPlanners: jest.fn() };
	let cron: PlannerCron;

	beforeEach(() => {
		plannerService.copyRegularPlanners.mockReset().mockResolvedValue(undefined);
		cron = new PlannerCron(plannerService as any);
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("copies planners into the month it is running in", async () => {
		jest.setSystemTime(new Date("2026-09-01T00:05:00.000Z"));

		await cron.copyRegularPlanners();

		expect(plannerService.copyRegularPlanners).toHaveBeenCalledWith(2026, 9);
	});

	it("handles the January run, whose source is the previous December", async () => {
		jest.setSystemTime(new Date("2027-01-01T00:05:00.000Z"));

		await cron.copyRegularPlanners();

		expect(plannerService.copyRegularPlanners).toHaveBeenCalledWith(2027, 1);
	});

	it("does not let a failure escape the cron handler", async () => {
		jest.setSystemTime(new Date("2026-09-01T00:05:00.000Z"));
		plannerService.copyRegularPlanners.mockRejectedValue(new Error("db down"));

		await expect(cron.copyRegularPlanners()).resolves.toBeUndefined();
	});
});
```

Обработка перехода года живёт в `PlannerService.copyRegularPlanners` (Task 4 вычисляет предыдущий месяц сам) — крон только передаёт целевой месяц.

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd backend && npx jest src/planner/planner.cron.spec.ts`
Expected: FAIL — `Cannot find module './planner.cron'`

- [ ] **Step 3: Реализовать крон**

Создать `backend/src/planner/planner.cron.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PlannerService } from "./planner.service";

@Injectable()
export class PlannerCron {
	constructor(private readonly plannerService: PlannerService) {}

	@Cron("5 0 1 * *", { name: "copyRegularPlanners", timeZone: "UTC" })
	async copyRegularPlanners(): Promise<void> {
		try {
			const now = new Date();

			await this.plannerService.copyRegularPlanners(
				now.getUTCFullYear(),
				now.getUTCMonth() + 1
			);
		} catch (e) {
			console.warn("[PlannerCron / copyRegularPlanners]: ", e);
		}
	}
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `cd backend && npx jest src/planner/planner.cron.spec.ts`
Expected: PASS, 3 passed

- [ ] **Step 5: Зарегистрировать провайдер**

В `backend/src/planner/planner.module.ts` добавить импорт:

```ts
import { PlannerCron } from "./planner.cron";
```

и добавить `PlannerCron` в массив `providers`. `ScheduleModule.forRoot()` уже вызван в `app.module.ts`.

- [ ] **Step 6: Проверить сборку и все тесты**

Run: `cd backend && npm run build && npx jest`
Expected: сборка без ошибок, все тесты зелёные

- [ ] **Step 7: Коммит**

```bash
git add backend/src/planner
git commit -m "Add monthly cron that copies regular budget planners"
```

---

### Task 7: Фронтенд — типы, API и страница планера

**Files:**
- Create: `frontend/shared/types/planner.ts`
- Modify: `frontend/lib/api.ts`
- Create: `frontend/app/components/planner/Summary.vue`
- Create: `frontend/app/components/planner/Item.vue`
- Create: `frontend/app/components/planner/Group.vue`
- Create: `frontend/app/components/modals/AddBudgetItem.vue`
- Create: `frontend/app/components/modals/EditPlanner.vue`
- Modify: `frontend/app/pages/finance/planner/index.vue`
- Modify: `frontend/i18n/locales/en.json`
- Modify: `frontend/i18n/locales/ru.json`

**Interfaces:**
- Consumes: `GET /api/v2/planner`, `PATCH /api/v2/planner/:id`, `POST /api/v2/planner/:id/items`, `DELETE /api/v2/planner/items/:itemId` (Task 4); `FinanceSpecs` из `api.finance.specs` — уже существует и отдаёт `exchange`, `expenseCategory`
- Produces: типы `IPlanner`, `IBudgetItem` в `frontend/shared/types/planner.ts` (авто-импортируются Nuxt); компоненты `PlannerSummary`, `PlannerGroup`, `PlannerItem`, `ModalsAddBudgetItem`, `ModalsEditPlanner`

- [ ] **Step 1: Добавить типы**

Создать `frontend/shared/types/planner.ts`:

```ts
export interface IBudgetItem {
	id: string;
	label: string;
	expenseCategory: {
		value: string;
		label: string;
		color: string;
	};
	curAmount: number;
	currency: string;
	convertedAmount: number;
	spent: number;
	progress: number;
	isRequired: boolean;
}

export interface IPlanner {
	id: string;
	year: number;
	month: number;
	currency: string;
	alertThreshold: number;
	isRegular: boolean;
	income: {
		cur: number;
		currency: string;
		converted: number;
	};
	planned: number;
	totalSpent: number;
	unallocated: number;
	progress: number;
	required: IBudgetItem[];
	additional: IBudgetItem[];
}
```

- [ ] **Step 2: Добавить эндпоинты в `lib/api.ts`**

В `frontend/lib/api.ts` внутри объекта `api` после секции `goals` добавить:

```ts
	planner: {
		common: `${prefix}/planner/`,
		detail: (id: string) => `${prefix}/planner/${id}/`,
		items: (id: string) => `${prefix}/planner/${id}/items/`,
		item: (itemId: string) => `${prefix}/planner/items/${itemId}/`,
	},
	notifications: {
		common: `${prefix}/notifications/`,
		read: (id: string) => `${prefix}/notifications/${id}/read/`,
		readAll: `${prefix}/notifications/read-all/`,
	},
```

- [ ] **Step 3: Добавить ключи локалей**

В `frontend/i18n/locales/en.json` заменить секцию `"financePlanner"` целиком на:

```json
	"financePlanner": {
		"income": "Income",
		"required": "Mandatory payments",
		"additional": "Additional expenses",
		"period": "Period",
		"planned": "Planned",
		"spent": "Spent",
		"unallocated": "Unallocated",
		"overplanned": "Over the income by {amount}",
		"threshold": "Alert threshold",
		"thresholdHint": "You will be notified once spending reaches this share of a plan.",
		"isRegular": "Repeat this plan every month",
		"empty": "No expenses planned yet",
		"ofPlan": "{spent} of {planned} {currency}"
	},
	"notifications": {
		"title": "Notifications",
		"empty": "No notifications yet",
		"markAllRead": "Mark all as read"
	},
```

В `frontend/i18n/locales/ru.json` заменить секцию `"financePlanner"` целиком на:

```json
	"financePlanner": {
		"income": "Заработок",
		"required": "Обязательные расходы",
		"additional": "Дополнительные расходы",
		"period": "Период",
		"planned": "Запланировано",
		"spent": "Потрачено",
		"unallocated": "Не распределено",
		"overplanned": "Превышение заработка на {amount}",
		"threshold": "Порог уведомления",
		"thresholdHint": "Уведомим, когда траты достигнут этой доли плана.",
		"isRegular": "Повторять план каждый месяц",
		"empty": "Расходы пока не запланированы",
		"ofPlan": "{spent} из {planned} {currency}"
	},
	"notifications": {
		"title": "Уведомления",
		"empty": "Уведомлений пока нет",
		"markAllRead": "Отметить все прочитанными"
	},
```

Дополнительно в обоих файлах в секцию `"inputs"` добавить:

```json
		"budgetItemLabel": "Expense goal",
		"budgetItemAmount": "Planned amount",
		"isRequired": "Mandatory payment"
```

и ru-вариант:

```json
		"budgetItemLabel": "Цель расхода",
		"budgetItemAmount": "Планируемая сумма",
		"isRequired": "Обязательный расход"
```

В секцию `"modals"` обоих файлов добавить:

```json
		"newBudgetItem": "Add a planned expense",
		"editPlanner": "Monthly budget settings"
```

и ru-вариант:

```json
		"newBudgetItem": "Добавить плановый расход",
		"editPlanner": "Настройки бюджета месяца"
```

- [ ] **Step 4: Написать компонент строки статьи**

Создать `frontend/app/components/planner/Item.vue`:

```vue
<script setup lang="ts">
import { splitThousandsFloat } from "~/assets/utils/numbers";

const props = defineProps<{
	item: IBudgetItem;
	threshold: number;
	currency: string;
}>();

const emit = defineEmits(["remove"]);

const percent = computed((): number => Math.round(props.item.progress * 100));

const color = computed((): UiColors => {
	if (props.item.progress >= 1) {
		return UiColors.error;
	}

	if (props.item.progress >= props.threshold) {
		return UiColors.warning;
	}

	return UiColors.success;
});
</script>

<template>
	<CommonCardWrapper>
		<template #header>
			<div class="flex items-center justify-between gap-2">
				<span class="flex items-center gap-2">
					<span
						class="inline-block w-2 h-2 rounded-full"
						:style="{ backgroundColor: props.item.expenseCategory.color }"
					/>
					{{ props.item.label }}
				</span>

				<UButton
					color="error"
					variant="ghost"
					icon="i-lucide-trash-2"
					:aria-label="$t('buttons.delete')"
					@click="emit('remove', props.item)"
				/>
			</div>
		</template>

		<div class="flex flex-col gap-2">
			<div class="text-xs text-gray-400">
				{{ props.item.expenseCategory.label }}
			</div>

			<UProgress :model-value="Math.min(percent, 100)" :color="color" />

			<div class="text-xs">
				{{
					$t("financePlanner.ofPlan", {
						spent: splitThousandsFloat(props.item.spent),
						planned: splitThousandsFloat(props.item.convertedAmount),
						currency: props.currency,
					})
				}}
				&nbsp;·&nbsp; {{ percent }}%
			</div>
		</div>
	</CommonCardWrapper>
</template>
```

- [ ] **Step 5: Написать компонент группы**

Создать `frontend/app/components/planner/Group.vue`:

```vue
<script setup lang="ts">
const props = defineProps<{
	title: string;
	items: IBudgetItem[];
	threshold: number;
	currency: string;
}>();

const emit = defineEmits(["remove"]);
</script>

<template>
	<section class="grid gap-3">
		<h2 class="text-sm uppercase tracking-wide text-gray-400">
			{{ props.title }}
		</h2>

		<p v-if="!props.items.length" class="text-sm text-gray-500">
			{{ $t("financePlanner.empty") }}
		</p>

		<PlannerItem
			v-for="item in props.items"
			:key="item.id"
			:item="item"
			:threshold="props.threshold"
			:currency="props.currency"
			@remove="emit('remove', $event)"
		/>
	</section>
</template>
```

- [ ] **Step 6: Написать сводку**

Создать `frontend/app/components/planner/Summary.vue`:

```vue
<script setup lang="ts">
import { splitThousandsFloat } from "~/assets/utils/numbers";

const props = defineProps<{
	planner: IPlanner;
}>();

const percent = computed((): number => Math.round(props.planner.progress * 100));

const color = computed((): UiColors => {
	if (props.planner.progress >= 1) {
		return UiColors.error;
	}

	if (props.planner.progress >= props.planner.alertThreshold) {
		return UiColors.warning;
	}

	return UiColors.success;
});

const isOverplanned = computed((): boolean => props.planner.unallocated < 0);
</script>

<template>
	<CommonCardWrapper>
		<div class="grid sm:grid-cols-3 gap-4">
			<div>
				<div class="text-xs text-gray-400">{{ $t("financePlanner.income") }}</div>
				<div class="text-lg">
					{{ splitThousandsFloat(props.planner.income.converted) }}
					{{ props.planner.currency }}
				</div>
			</div>

			<div>
				<div class="text-xs text-gray-400">{{ $t("financePlanner.planned") }}</div>
				<div class="text-lg">
					{{ splitThousandsFloat(props.planner.planned) }}
					{{ props.planner.currency }}
				</div>
			</div>

			<div>
				<div class="text-xs text-gray-400">{{ $t("financePlanner.spent") }}</div>
				<div class="text-lg">
					{{ splitThousandsFloat(props.planner.totalSpent) }}
					{{ props.planner.currency }}
				</div>
			</div>
		</div>

		<div class="mt-4 grid gap-2">
			<UProgress :model-value="Math.min(percent, 100)" :color="color" />

			<div class="text-xs" :class="isOverplanned ? 'text-red-400' : 'text-gray-400'">
				<template v-if="isOverplanned">
					{{
						$t("financePlanner.overplanned", {
							amount: `${splitThousandsFloat(Math.abs(props.planner.unallocated))} ${props.planner.currency}`,
						})
					}}
				</template>
				<template v-else>
					{{ $t("financePlanner.unallocated") }}:
					{{ splitThousandsFloat(props.planner.unallocated) }}
					{{ props.planner.currency }}
				</template>
			</div>
		</div>
	</CommonCardWrapper>
</template>
```

- [ ] **Step 7: Написать модалку добавления статьи**

Создать `frontend/app/components/modals/AddBudgetItem.vue`:

```vue
<script setup lang="ts">
import { z } from "zod";
import { api } from "~~/lib/api";

const props = defineProps<{
	plannerId: string;
	usedCategories: string[];
}>();

const emit = defineEmits(["refresh"]);

interface IState {
	label: string;
	curAmount: number | null;
	currencyFromId: string;
	expenseCategoryId: string;
	isRequired: boolean;
}

const initialValues: IState = {
	label: "",
	curAmount: null,
	currencyFromId: "",
	expenseCategoryId: "",
	isRequired: false,
};

const { t } = useI18n();

const schema = z.object({
	label: z.string({ error: t("inputsErrors.required") }).nonempty({ message: t("inputsErrors.required") }),
	curAmount: z.number({ error: t("inputsErrors.required") }).min(0, { message: t("inputsErrors.min", { min: 0 }) }),
	currencyFromId: z.string({ error: t("inputsErrors.required") }).nonempty({ message: t("inputsErrors.required") }),
	expenseCategoryId: z
		.string({ error: t("inputsErrors.required") })
		.nonempty({ message: t("inputsErrors.required") }),
	isRequired: z.boolean(),
});

const state = reactive<IState>({ ...initialValues });
const isLoading = ref<boolean>(false);
const toast = useToast();
const slideOverRef = useTemplateRef("slideOver");

const { data, error } = await useFetch<FinanceSpecs>(api.finance.specs, {
	key: "FinanceSpecs",
});

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}

const availableCategories = computed(() =>
	(data.value?.expenseCategory || []).filter((c) => !props.usedCategories.includes(c.value)),
);

const isValid = computed(() => schema.safeParse(state).success);

async function onSubmit() {
	try {
		isLoading.value = true;

		await $fetch(api.planner.items(props.plannerId), {
			method: "POST",
			body: JSON.stringify(state),
		});

		emit("refresh");
		toast.add({
			title: t("common.added"),
			color: "success",
			icon: "i-lucide-circle-check",
		});
	} catch (e) {
		console.warn("onSubmit: ", e);
		toast.add({
			title: e?.data?.message?.[0] || e?.data?.message || t("common.error"),
			color: "error",
		});
	} finally {
		isLoading.value = false;
		slideOverRef.value?.handleClose();
	}
}

function handleClose() {
	Object.assign(state, initialValues);
}
</script>

<template>
	<ModalsBaseSlideOver
		ref="slideOver"
		btnLabel="new"
		title="newBudgetItem"
		:isDisabled="!isValid"
		:isLoading="isLoading"
		@close="handleClose"
		@click="onSubmit"
	>
		<UForm :schema="schema" :state="state" class="w-full flex flex-col items-center space-y-4" @submit="onSubmit">
			<UFormField class="w-full" :label="$t('inputs.budgetItemLabel')" name="label">
				<UInput class="w-full" size="md" :placeholder="$t('inputs.budgetItemLabel')" v-model="state.label" />
			</UFormField>

			<UFormField class="w-full" :label="$t('inputs.expenseCategory')" name="expenseCategoryId">
				<USelectMenu
					class="w-full"
					size="md"
					v-model="state.expenseCategoryId"
					:items="availableCategories"
					value-key="value"
					virtualize
				/>
			</UFormField>

			<UFormField class="w-full" :label="$t('inputs.budgetItemAmount')" name="curAmount">
				<UInput type="number" class="w-full" size="md" placeholder="1 000" v-model="state.curAmount" />
			</UFormField>

			<UFormField class="w-full" :label="$t('inputs.exchange')" name="currencyFromId">
				<USelectMenu
					class="w-full"
					size="md"
					v-model="state.currencyFromId"
					:items="data?.exchange"
					placeholder="EUR"
					value-key="value"
					virtualize
				/>
			</UFormField>

			<UFormField class="w-full" :label="$t('inputs.isRequired')" name="isRequired">
				<USwitch v-model="state.isRequired" />
			</UFormField>
		</UForm>
	</ModalsBaseSlideOver>
</template>
```

Фильтр `availableCategories` не даёт выбрать категорию, которая уже занята другой статьёй — бэкенд вернул бы `409`.

- [ ] **Step 8: Написать модалку настроек плана**

Создать `frontend/app/components/modals/EditPlanner.vue`:

```vue
<script setup lang="ts">
import { z } from "zod";
import { api } from "~~/lib/api";

const props = defineProps<{
	planner: IPlanner;
}>();

const emit = defineEmits(["refresh"]);

const { t } = useI18n();

const schema = z.object({
	curIncome: z.number({ error: t("inputsErrors.required") }).min(0, { message: t("inputsErrors.min", { min: 0 }) }),
	currencyFromId: z.string({ error: t("inputsErrors.required") }).nonempty({ message: t("inputsErrors.required") }),
	alertThreshold: z.number().min(1).max(100),
	isRegular: z.boolean(),
});

const state = reactive({
	curIncome: props.planner.income.cur,
	currencyFromId: props.planner.income.currency,
	alertThreshold: Math.round(props.planner.alertThreshold * 100),
	isRegular: props.planner.isRegular,
});

const isLoading = ref<boolean>(false);
const toast = useToast();
const slideOverRef = useTemplateRef("slideOver");

const { data, error } = await useFetch<FinanceSpecs>(api.finance.specs, {
	key: "FinanceSpecs",
});

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}

const isValid = computed(() => schema.safeParse(state).success);

async function onSubmit() {
	try {
		isLoading.value = true;

		await $fetch(api.planner.detail(props.planner.id), {
			method: "PATCH",
			body: JSON.stringify({
				curIncome: state.curIncome,
				currencyFromId: state.currencyFromId,
				alertThreshold: state.alertThreshold / 100,
				isRegular: state.isRegular,
			}),
		});

		emit("refresh");
		toast.add({
			title: t("common.updated"),
			color: "success",
			icon: "i-lucide-circle-check",
		});
	} catch (e) {
		console.warn("onSubmit: ", e);
		toast.add({
			title: e?.data?.message?.[0] || e?.data?.message || t("common.error"),
			color: "error",
		});
	} finally {
		isLoading.value = false;
		slideOverRef.value?.handleClose();
	}
}

function handleClose() {
	state.curIncome = props.planner.income.cur;
	state.currencyFromId = props.planner.income.currency;
	state.alertThreshold = Math.round(props.planner.alertThreshold * 100);
	state.isRegular = props.planner.isRegular;
}
</script>

<template>
	<ModalsBaseSlideOver
		ref="slideOver"
		btnLabel="save"
		title="editPlanner"
		:isDisabled="!isValid"
		:isLoading="isLoading"
		@close="handleClose"
		@click="onSubmit"
	>
		<UForm :schema="schema" :state="state" class="w-full flex flex-col items-center space-y-4" @submit="onSubmit">
			<UFormField class="w-full" :label="$t('financePlanner.income')" name="curIncome">
				<UInput type="number" class="w-full" size="md" placeholder="5 000" v-model="state.curIncome" />
			</UFormField>

			<UFormField class="w-full" :label="$t('inputs.exchange')" name="currencyFromId">
				<USelectMenu
					class="w-full"
					size="md"
					v-model="state.currencyFromId"
					:items="data?.exchange"
					placeholder="EUR"
					value-key="value"
					virtualize
				/>
			</UFormField>

			<UFormField
				class="w-full"
				:label="`${$t('financePlanner.threshold')}: ${state.alertThreshold}%`"
				:hint="$t('financePlanner.thresholdHint')"
				name="alertThreshold"
			>
				<USlider v-model="state.alertThreshold" :min="1" :max="100" :step="1" />
			</UFormField>

			<UFormField class="w-full" :label="$t('financePlanner.isRegular')" name="isRegular">
				<USwitch v-model="state.isRegular" />
			</UFormField>
		</UForm>
	</ModalsBaseSlideOver>
</template>
```

- [ ] **Step 9: Заполнить страницу планера**

Заменить `frontend/app/pages/finance/planner/index.vue` целиком:

```vue
<script setup lang="ts">
import { api } from "~~/lib/api";

const { t } = useI18n();
const toast = useToast();

const { data, error, refresh } = await useFetch<IPlanner>(api.planner.common, {
	key: "Planner",
});

if (error.value) {
	throw createError({
		statusCode: error.value?.statusCode,
		statusMessage: error.value?.statusMessage,
	});
}

const usedCategories = computed((): string[] =>
	[...(data.value?.required || []), ...(data.value?.additional || [])].map(
		(item) => item.expenseCategory.value,
	),
);

async function removeItem(item: IBudgetItem) {
	try {
		await $fetch(api.planner.item(item.id), { method: "DELETE" });

		await refresh();
		toast.add({
			title: t("common.deleted"),
			color: "success",
			icon: "i-lucide-circle-check",
		});
	} catch (e) {
		console.warn("removeItem: ", e);
		toast.add({ title: t("common.error"), color: "error" });
	}
}
</script>

<template>
	<section class="overflow-hidden grid gap-4">
		<CommonSectionHeader>
			<ModalsEditPlanner v-if="data" :planner="data" @refresh="refresh" />
			<ModalsAddBudgetItem
				v-if="data"
				:plannerId="data.id"
				:usedCategories="usedCategories"
				@refresh="refresh"
			/>
		</CommonSectionHeader>

		<CommonSuspenseWrapper>
			<div v-if="data" class="grid gap-6">
				<PlannerSummary :planner="data" />

				<PlannerGroup
					:title="$t('financePlanner.required')"
					:items="data.required"
					:threshold="data.alertThreshold"
					:currency="data.currency"
					@remove="removeItem"
				/>

				<PlannerGroup
					:title="$t('financePlanner.additional')"
					:items="data.additional"
					:threshold="data.alertThreshold"
					:currency="data.currency"
					@remove="removeItem"
				/>
			</div>
		</CommonSuspenseWrapper>
	</section>
</template>
```

- [ ] **Step 10: Проверить в браузере**

Run: `cd backend && npm run start:dev` (в одном терминале)
Run: `cd frontend && npm run dev` (в другом)

Открыть `http://localhost:3000/finance/planner`, залогинившись.

Expected:
- Сводка показывает заработок, запланировано, потрачено и прогресс-бар
- Кнопка настроек открывает слайдовер со слайдером порога, значение по умолчанию 70%
- Добавление статьи в USD при базовой валюте EUR показывает пересчитанную сумму в EUR
- Категория, уже занятая статьёй, не появляется в списке при добавлении второй статьи
- Удаление статьи убирает её из списка и обновляет сводку

- [ ] **Step 11: Проверить сборку фронта**

Run: `cd frontend && npm run build`
Expected: сборка без ошибок

- [ ] **Step 12: Коммит**

```bash
git add frontend/shared/types/planner.ts frontend/lib/api.ts frontend/app/components/planner frontend/app/components/modals/AddBudgetItem.vue frontend/app/components/modals/EditPlanner.vue frontend/app/pages/finance/planner/index.vue frontend/i18n/locales
git commit -m "Add budget planner page with summary, groups and edit modals"
```

---

### Task 8: Фронтенд — уведомления

**Files:**
- Create: `frontend/shared/types/notification.ts`
- Create: `frontend/app/stores/notifications.ts`
- Create: `frontend/app/components/layout/NotificationsBell.vue`
- Modify: `frontend/app/components/layout/TheHeader.vue`
- Modify: `frontend/app/components/modals/AddNewFinance.vue`

**Interfaces:**
- Consumes: `GET /api/v2/notifications`, `PATCH /api/v2/notifications/:id/read`, `PATCH /api/v2/notifications/read-all` (Task 3); ответ `POST /api/v2/finance` вида `{ notifications: INotification[] }` (Task 5)
- Produces: тип `INotification`; store `useNotificationsStore` с `list`, `unreadCount`, `fetchNotifications()`, `markRead(id)`, `markAllRead()`, `push(items)`; компонент `LayoutNotificationsBell`

- [ ] **Step 1: Добавить тип**

Создать `frontend/shared/types/notification.ts`:

```ts
export interface INotification {
	id: string;
	type: string;
	title: string;
	text: string;
	isReaded: boolean;
	createdAt: string;
}
```

- [ ] **Step 2: Написать store**

Создать `frontend/app/stores/notifications.ts`:

```ts
import { defineStore } from "pinia";
import { api } from "~~/lib/api";

export interface INotificationsStore {
	list: INotification[];
	unreadCount: number;
}

export const useNotificationsStore = defineStore("notifications", () => {
	const state = reactive<INotificationsStore>({
		list: [],
		unreadCount: 0,
	});

	async function fetchNotifications() {
		try {
			const data = await $fetch<{ result: INotification[]; unreadCount: number }>(
				api.notifications.common,
			);

			state.list = data.result;
			state.unreadCount = data.unreadCount;
		} catch (e) {
			console.warn("fetchNotifications: ", e);
		}
	}

	function push(items: INotification[]) {
		if (!items?.length) {
			return;
		}

		state.list = [...items, ...state.list];
		state.unreadCount += items.length;
	}

	async function markRead(id: string) {
		try {
			await $fetch(api.notifications.read(id), { method: "PATCH" });

			const target = state.list.find((n) => n.id === id);

			if (target && !target.isReaded) {
				target.isReaded = true;
				state.unreadCount = Math.max(0, state.unreadCount - 1);
			}
		} catch (e) {
			console.warn("markRead: ", e);
		}
	}

	async function markAllRead() {
		try {
			await $fetch(api.notifications.readAll, { method: "PATCH" });

			state.list = state.list.map((n) => ({ ...n, isReaded: true }));
			state.unreadCount = 0;
		} catch (e) {
			console.warn("markAllRead: ", e);
		}
	}

	return {
		...toRefs(state),
		fetchNotifications,
		push,
		markRead,
		markAllRead,
	};
});
```

- [ ] **Step 3: Написать колокольчик**

Создать `frontend/app/components/layout/NotificationsBell.vue`:

```vue
<script setup lang="ts">
const store = useNotificationsStore();
const { list, unreadCount } = storeToRefs(store);

onMounted(() => {
	store.fetchNotifications();
});
</script>

<template>
	<UPopover>
		<UChip :text="unreadCount" :show="unreadCount > 0" size="lg">
			<UButton
				color="neutral"
				variant="ghost"
				icon="i-lucide-bell"
				:aria-label="$t('notifications.title')"
			/>
		</UChip>

		<template #content>
			<div class="w-80 max-h-96 overflow-y-auto p-2 grid gap-2">
				<div class="flex items-center justify-between px-1">
					<span class="text-sm font-medium">{{ $t("notifications.title") }}</span>

					<UButton
						v-if="unreadCount > 0"
						size="xs"
						variant="ghost"
						:label="$t('notifications.markAllRead')"
						@click="store.markAllRead()"
					/>
				</div>

				<p v-if="!list.length" class="text-sm text-gray-500 px-1 py-4">
					{{ $t("notifications.empty") }}
				</p>

				<button
					v-for="item in list"
					:key="item.id"
					type="button"
					class="text-left rounded-md p-2 transition-colors hover:bg-gray-800"
					:class="{ 'opacity-60': item.isReaded }"
					@click="store.markRead(item.id)"
				>
					<div class="flex items-start gap-2">
						<span
							class="mt-1.5 inline-block w-2 h-2 rounded-full shrink-0"
							:class="item.isReaded ? 'bg-transparent' : 'bg-primary-500'"
						/>
						<span class="grid gap-1">
							<span class="text-sm">{{ item.title }}</span>
							<span class="text-xs text-gray-400">{{ item.text }}</span>
						</span>
					</div>
				</button>
			</div>
		</template>
	</UPopover>
</template>
```

- [ ] **Step 4: Встроить колокольчик в хедер**

В `frontend/app/components/layout/TheHeader.vue` в шаблоне вставить перед `<LayoutProfileAvatar />`:

```vue
		<LayoutNotificationsBell />
```

- [ ] **Step 5: Показывать toast сразу после траты**

В `frontend/app/components/modals/AddNewFinance.vue` заменить тело `onSubmit`. Было:

```ts
		await $fetch(api.finance.common, {
			method: "POST",
			body: JSON.stringify(state),
		});

		sliderOverRef.value?.handleClose();
		emit("refresh");
		toast.add({
			title: t("common.added"),
			color: "success",
			icon: "i-lucide-circle-check",
		});
```

Стало:

```ts
		const response = await $fetch<{ notifications: INotification[] }>(api.finance.common, {
			method: "POST",
			body: JSON.stringify(state),
		});

		sliderOverRef.value?.handleClose();
		emit("refresh");
		toast.add({
			title: t("common.added"),
			color: "success",
			icon: "i-lucide-circle-check",
		});

		const notifications = response?.notifications || [];

		if (notifications.length) {
			useNotificationsStore().push(notifications);

			notifications.forEach((notification) => {
				toast.add({
					title: notification.title,
					description: notification.text,
					color: "warning",
					icon: "i-lucide-triangle-alert",
				});
			});
		}
```

- [ ] **Step 6: Проверить сценарий в браузере**

Run: `cd backend && npm run start:dev` и `cd frontend && npm run dev`

1. На `/finance/planner` создать план с заработком 1000 EUR и статью «Vacation», категория `travel`, 100 EUR.
2. На `/finance/list` добавить расход 70 EUR в категории `travel`.

Expected:
- Появляется зелёный toast «Successfully added» и оранжевый toast с заголовком, содержащим `Vacation` и `70%`
- На колокольчике в хедере появляется бейдж `1`
- В попапе колокольчика видно уведомление; клик по нему гасит точку и уменьшает бейдж
- Переключение языка в шапке меняет язык уже созданного уведомления после перезагрузки страницы

3. Добавить ещё один расход 10 EUR в той же категории.

Expected: второй раз оранжевый toast по статье не появляется.

- [ ] **Step 7: Проверить сборку фронта**

Run: `cd frontend && npm run build`
Expected: сборка без ошибок

- [ ] **Step 8: Финальный прогон бэкенд-тестов**

Run: `cd backend && npx jest`
Expected: все тесты зелёные

- [ ] **Step 9: Коммит**

```bash
git add frontend/shared/types/notification.ts frontend/app/stores/notifications.ts frontend/app/components/layout/NotificationsBell.vue frontend/app/components/modals/AddNewFinance.vue
git commit -m "Add in-app notifications bell, store and budget alert toasts"
```

---

## Итоговая проверка

- [ ] `cd backend && npm run build && npx jest` — сборка и все тесты зелёные
- [ ] `cd frontend && npm run build` — сборка зелёная
- [ ] `cd backend && npm run lint` и `cd frontend && npx prettier --check "app/**/*.vue"` — без ошибок
- [ ] Ручной сценарий из Task 8 Step 6 пройден целиком
