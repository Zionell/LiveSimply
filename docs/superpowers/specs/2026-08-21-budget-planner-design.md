# Планирование бюджета на месяц

Дата: 2026-08-21
Статус: утверждено

## Задача

Пользователь планирует бюджет на календарный месяц: вносит общий заработок, обязательные
расходы и дополнительные расходы (у каждого — цель расхода и планируемая сумма). Бэкенд
считает фактические траты по каждой статье и уведомляет пользователя, когда израсходовано
70% плана (порог настраивается).

## Что уже есть в проекте

**Стек.** Backend — NestJS 11 + Prisma 6 (MongoDB), префикс `/api/v2`, Swagger, `nestjs-i18n`
(en/ru), `@nestjs/schedule`, `MailService` на pug. Frontend — Nuxt 4 + Nuxt UI 4 + Pinia +
`@nuxtjs/i18n`. Деплой на Vercel двумя сервисами.

**Заготовки под фичу, к которым не привязан ни один модуль:**

- `FinancePlanner` и `Payments` в `backend/prisma/schema.prisma` — с опечатками `plnnerId`,
  `lable`
- `Notification` — без relation на `User`, без модуля
- `frontend/app/pages/finance/planner/index.vue` — пустая заглушка с закомментированным
  `PlannerWrapper` (порт со старого React-приложения)
- Ключи i18n `financePlanner.income / required / period`
- Пункт меню `financePlanner` в `app/assets/constants/menu.ts`

**Рабочие части, на которые опираемся:**

- `FinanceItem` — фактические транзакции: `curPrice`, `convertedPrice` (в базовой валюте
  юзера), `operationCategoryId` (`expense` / `income` / `goals`), `expenseCategoryId`
- `ExpenseCategory` — глобальный справочник категорий с i18n-лейблами и цветом
- `RatesService.convertPrice({ from, to, price })`
- Паттерн модуля: `controller` → `service` → `PrismaService`, DTO на `class-validator`,
  сериализаторы в `serializer/`

## Принятые решения

| Решение | Выбор |
|---|---|
| Связь плана с фактом | Через `ExpenseCategory`: статья указывает категорию, факт считается автоматически по транзакциям этой категории |
| Канал уведомлений | In-app: запись `Notification` + колокольчик в хедере + toast сразу после траты |
| Период плана | Календарный месяц, один план на юзера на месяц, автокопирование по флагу `isRegular` |
| Область порога | Каждая статья + общий бюджет месяца |
| Триггер проверки | Реактивно при добавлении траты в `FinanceService.create` |
| Конвертация валют | Как в finance list: конвертация при записи, храним обе суммы с валютами |
| Хранение уведомлений | `type` + `params` в БД, текст рендерится на чтении через `nestjs-i18n` |
| Порог | На `FinancePlanner`, дефолт `0.7`, меняется для каждого плана |

## Модель данных

Модели `FinancePlanner` / `Payments` переделываются, а не дополняются: кода за ними нет,
коллекции пустые. Перед `prisma db push` проверить, что в Mongo действительно нет документов.

```prisma
model FinancePlanner {
  id     String @id @default(auto()) @map("_id") @db.ObjectId
  userId String
  year   Int
  month  Int    // 1..12

  curIncome       Float  @default(0)   // как ввёл пользователь
  currencyFromId  String               // валюта ввода
  convertedIncome Float  @default(0)   // в базовой валюте пользователя
  currencyToId    String

  alertThreshold    Float   @default(0.7)  // 0..1, меняется для каждого плана
  notifiedThreshold Float?                 // порог, уже отработавший по общему бюджету
  isRegular         Boolean @default(false)

  items BudgetItem[]
  user  User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime  @default(now())
  updatedAt DateTime? @default(now())

  @@unique([userId, year, month])
}

model BudgetItem {
  id        String @id @default(auto()) @map("_id") @db.ObjectId
  plannerId String
  label     String   // «цель расхода»

  curAmount       Float  @default(0)
  currencyFromId  String
  convertedAmount Float  @default(0)
  currencyToId    String

  expenseCategoryId String            // → ExpenseCategory.value
  isRequired        Boolean @default(false)
  notifiedThreshold Float?            // дедупликация уведомлений

  planner         FinancePlanner  @relation(fields: [plannerId], references: [id], onDelete: Cascade)
  expenseCategory ExpenseCategory @relation(fields: [expenseCategoryId], references: [value])

  createdAt DateTime  @default(now())
  updatedAt DateTime? @default(now())

  @@unique([plannerId, expenseCategoryId])
}

model Notification {
  id       String  @id @default(auto()) @map("_id") @db.ObjectId
  userId   String
  type     String                    // значение ENotificationType
  params   Json    @default("{}")
  isReaded Boolean @default(false)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime  @default(now())
  updatedAt DateTime? @default(now())
}
```

Модель `Payments` удаляется целиком, её место занимает `BudgetItem`. Из `FinancePlanner`
удаляются как неиспользуемые: `commonBudget`, `remainder`, `period`, `customPeriodFrom`,
`customPeriodTo`, `name`. Из `Notification` удаляются `title` и `text` — текст больше не
хранится.

Обратные связи, которые нужно дописать: `User.notifications Notification[]`,
`ExpenseCategory.budgetItems BudgetItem[]`. В `ExchangeItem` связь `requiredPayments
Payments[]` удаляется вместе с моделью. Поля порога в `User` нет.

`@@unique([plannerId, expenseCategoryId])` — прямое следствие связи через категорию: две
статьи на одну категорию дали бы двойной учёт одной траты и дублирующиеся уведомления.

### Валюта

Каждая денежная величина хранится парой «как ввели» + «в базовой валюте», по образцу
`FinanceItem`. Базовая валюта — `User.exchange`, fallback `EUR`. Конвертация выполняется
`RatesService.convertPrice` в момент создания и обновления записи; на чтении и при проверке
порога конвертации нет — сравниваются `convertedAmount` и сумма `convertedPrice`.

Известное ограничение (унаследованное, `getStatistics` работает так же): при смене базовой
валюты в середине месяца ранее сохранённые `convertedPrice` остаются в прежней валюте.
В рамках этой задачи не исправляется.

## Правила подсчёта

Период плана: `[1-е число месяца 00:00, 1-е число следующего месяца 00:00)`.

Сейчас `FinanceService.getStatistics` вычисляет границы как
``new Date(`${year}-${month}-${lastDay}`)``, из-за чего последний день месяца обрезается по
00:00 и его траты не попадают в статистику. Корректный расчёт выносится в
`utils/date.ts` → `getMonthRange(year, month)` и применяется и в планере, и в
`getStatistics` — иначе цифры на дашборде и в планере разойдутся.

Для статьи `item`:

- `spent(item)` = сумма `convertedPrice` по `FinanceItem`, где `userId` совпадает,
  `operationCategoryId = 'expense'`, `expenseCategoryId = item.expenseCategoryId`,
  `createdAt` внутри периода
- `progress(item)` = `spent / item.convertedAmount` (при `convertedAmount = 0` прогресс не
  определён, порог не проверяется)

Для плана:

- `totalSpent` = сумма `convertedPrice` по всем расходам пользователя за период
- `progress(plan)` = `totalSpent / plan.convertedIncome`
- `planned` = сумма `convertedAmount` всех статей
- `unallocated` = `convertedIncome − planned` (может быть отрицательным — план перебран)

`isRequired` влияет только на группировку в UI. В проверке порога обязательные и
дополнительные статьи равноправны.

## Уведомления

### Проверка порога

Логика живёт целиком в `BudgetAlertService` — единственном месте, где встречается порог.

Уведомление создаётся, когда одновременно верно:

1. `progress >= threshold`
2. `notifiedThreshold !== threshold`

После создания записывается `notifiedThreshold = threshold`.

Следствия правила: смена порога в плане даёт уведомлению сработать заново; повышение
`curAmount` статьи до состояния `progress < threshold` сбрасывает `notifiedThreshold` в
`null`, и порог снова сможет сработать; в новом месяце статьи создаются с
`notifiedThreshold = null`.

Проверка вызывается из `FinanceService.create` после записи `FinanceItem` — только для
затронутой категории и для общего бюджета. Созданные уведомления возвращаются в ответе
эндпоинта, чтобы фронт показал toast немедленно.

При удалении и изменении траты (`FinanceService.remove` / `update`) выполняется сброс:
если после пересчёта `progress < threshold`, `notifiedThreshold` очищается.

### Шаблонизация

В БД лежат только `type` и `params`. Тексты — в `backend/src/i18n/{en,ru}/notification.json`:

```json
{
  "budget": {
    "item": {
      "threshold": {
        "title": "{label}: {percent}% of the plan spent",
        "text": "Spent {spent} of {planned} {currency}."
      }
    },
    "total": {
      "threshold": {
        "title": "{percent}% of the monthly budget spent",
        "text": "Spent {spent} of {income} {currency}."
      }
    }
  }
}
```

`NotificationSerializer` рендерит `title` и `text` через `I18nService.translate` с
`args: params` на языке текущего запроса. Добавление нового типа уведомления = значение в
`ENotificationType` + два ключа в каждой локали; код сервиса не меняется. Правка
формулировки применяется ко всем уже созданным уведомлениям, смена языка переводит историю.

`ENotificationType`:

```ts
export enum ENotificationType {
  BudgetItemThreshold = "budget.item.threshold",
  BudgetTotalThreshold = "budget.total.threshold",
}
```

Неизвестный `type` при рендере не роняет ответ: сериализатор возвращает `null` для такой
записи и пишет предупреждение в лог.

## Компоненты

### backend/src/notifications/

- `notifications.module.ts`
- `notifications.service.ts` — `create({ userId, type, params })`, `findAll(req)`,
  `markRead(id, req)`, `markAllRead(req)`
- `notifications.controller.ts`
- `serializer/notification.serializer.ts` — рендер `type` + `params` → `title` / `text`
- `types.ts` — `ENotificationType`, `INotificationParams`
- `i18n/{en,ru}/notification.json`

Зависит от: `PrismaService`, `I18nService`.

### backend/src/planner/

- `planner.module.ts`
- `planner.service.ts` — CRUD плана и статей, автосоздание пустого плана текущего месяца,
  конвертация сумм, копирование планов с `isRegular`
- `budget-alert.service.ts` — подсчёт `spent` / `progress`, проверка порогов, создание
  уведомлений, сброс `notifiedThreshold`
- `planner.controller.ts`
- `dto/` — `create-planner.dto.ts`, `update-planner.dto.ts`, `create-budget-item.dto.ts`,
  `update-budget-item.dto.ts`, `find-planner.dto.ts`
- `serializer/planner.serializer.ts`

Зависит от: `PrismaService`, `RatesService`, `NotificationsService`.

`BudgetAlertService` экспортируется из модуля — его импортирует `FinanceModule`.
Границы: `PlannerService` не знает про уведомления, `BudgetAlertService` не знает про HTTP.

### Правки в существующем коде

- `backend/utils/date.ts` — добавить `getMonthRange(year, month): { gte: Date; lt: Date }`
- `backend/src/finance/finance.service.ts` — `create` вызывает
  `BudgetAlertService.checkAfterExpense()` и возвращает уведомления; `remove` и `update`
  вызывают сброс; `getStatistics` переходит на `getMonthRange`
- `backend/src/finance/finance.module.ts` — импорт `PlannerModule`
- `backend/src/app.module.ts` — регистрация `PlannerModule` и `NotificationsModule`
- `backend/prisma/schema.prisma` — модели выше

## API

Все эндпоинты закрыты глобальным `AuthGuard`, пользователь берётся из `req.payload.id`.

```
GET    /api/v2/planner?year=&month=      план месяца; при отсутствии создаётся пустой
POST   /api/v2/planner                   создать план
PATCH  /api/v2/planner/:id               curIncome, currencyFromId, alertThreshold, isRegular
DELETE /api/v2/planner/:id
POST   /api/v2/planner/:id/items         добавить статью
PATCH  /api/v2/planner/items/:itemId
DELETE /api/v2/planner/items/:itemId

GET    /api/v2/notifications             список + счётчик непрочитанных
PATCH  /api/v2/notifications/:id/read
PATCH  /api/v2/notifications/read-all
```

Ответ `GET /planner`:

```json
{
  "id": "...",
  "year": 2026,
  "month": 8,
  "currency": "EUR",
  "alertThreshold": 0.7,
  "isRegular": false,
  "income": { "cur": 5000, "currency": "USD", "converted": 4600 },
  "planned": 3200,
  "totalSpent": 2410,
  "unallocated": 1400,
  "progress": 0.52,
  "required": [
    {
      "id": "...",
      "label": "Аренда",
      "expenseCategory": { "value": "housing", "label": "Housing", "color": "#4ade80" },
      "curAmount": 1200,
      "currency": "EUR",
      "convertedAmount": 1200,
      "spent": 1200,
      "progress": 1.0,
      "isRequired": true
    }
  ],
  "additional": []
}
```

Ответ `POST /finance` дополняется полем `notifications` — массивом сработавших уведомлений
в том же формате, что отдаёт `GET /notifications`.

Ошибки: попытка создать вторую статью на ту же категорию → `409 Conflict`; попытка создать
второй план на тот же месяц → `409 Conflict`; `alertThreshold` вне `(0, 1]` → `400`.

## Frontend

- `shared/types/planner.ts`, `shared/types/notification.ts`
- `lib/api.ts` — секции `planner` и `notifications`
- `app/pages/finance/planner/index.vue` — заполнение заглушки по образцу `pages/goals/index.vue`
- `app/components/planner/Summary.vue` — заработок, распределено, потрачено, общий прогресс
- `app/components/planner/Group.vue` — группа «обязательные» / «дополнительные»
- `app/components/planner/Item.vue` — строка статьи с `UProgress`, цвет по прогрессу
  (`< threshold` — success, `>= threshold` — warning, `>= 1` — error)
- `app/components/modals/AddBudgetItem.vue`, `app/components/modals/EditPlanner.vue` —
  по образцу `AddNewGoal.vue`: `ModalsBaseSlideOver` + `UForm` + zod
- `app/components/layout/NotificationsBell.vue` — в `TheHeader`, `UPopover` со списком и
  бейджем непрочитанных
- `app/stores/notifications.ts` — Pinia
- `app/components/modals/AddNewFinance.vue` — при наличии `notifications` в ответе показать
  toast с `color: "warning"`
- `i18n/locales/{en,ru}.json` — расширение секции `financePlanner`, новая секция
  `notifications`

Страницы профиля во фронте нет (`ERoutes.profile` объявлен, `pages/profile` отсутствует),
поэтому порог редактируется из UI планера. Отдельная страница настроек аккаунта в скоуп не
входит.

## Тестирование

Jest в бэкенде настроен (`rootDir: src`, `testRegex: .*\.spec\.ts$`), но тестов сейчас нет
ни одного. Новый код покрывается юнит-тестами с замоканным `PrismaService`.

- `budget-alert.service.spec.ts` — прогресс 69.9% / ровно 70% / 70.1%; повторная трата не
  создаёт второе уведомление; смена порога даёт сработать заново; рост `curAmount` сбрасывает
  `notifiedThreshold`; удаление траты сбрасывает; отсутствие плана на месяц; статья с
  `convertedAmount = 0`; трата в категории, которой нет в плане; порог общего бюджета
- `planner.service.spec.ts` — уникальность плана на месяц; уникальность категории в плане;
  конвертация при создании и при обновлении; автосоздание пустого плана; копирование по
  `isRegular` не переносит `notifiedThreshold`
- `notification.serializer.spec.ts` — рендер на en и ru с подстановкой параметров;
  неизвестный `type` не роняет ответ
- `utils/date.spec.ts` — границы месяца; переход декабрь → январь; февраль високосного года

## Вне скоупа

- Email- и push-уведомления
- Страница настроек аккаунта
- Периоды кроме календарного месяца
- Переопределение порога на уровне отдельной статьи
- Пересчёт `convertedAmount` при изменении курсов
- Исправление сохранённых `convertedPrice` при смене базовой валюты
