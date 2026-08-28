# Раздел «Здоровье»: вес, параметры тела и КБЖУ

Дата: 2026-08-26
Статус: черновик, на согласовании (код не пишется до утверждения)

## Задача

Новый раздел верхнего уровня «Здоровье» с двумя вкладками:

1. **Вес и параметры тела** — карточки прогресса, ежедневный лог веса, обхваты, графики.
2. **КБЖУ** — лог приёмов пищи на базе справочника продуктов, факт/цель по калориям и БЖУ.

Референс по полям и логике — Excel «Дневник снижения веса» (не по UI).

## Утверждённые решения

| Вопрос | Решение |
|---|---|
| Гранулярность лога КБЖУ | **Строка = приём пищи**. Слайд-овер набирает состав (продукт + граммы, сколько нужно позиций), бэкенд считает КБЖУ всего приёма, в таблице появляется одна запись |
| Справочник продуктов | Отдельная таблица, наполняется **только сидом**: 5 продуктов под расчёты и тесты. Создание продуктов из интерфейса в v1 не делаем |
| Профиль | Пол, дата рождения, рост, стартовый и целевой вес, дефицит вводятся пользователем; уровень активности — селект из четырёх. Из этого считается дневная норма КБЖУ |
| Профиль здоровья | Общий на весь раздел: пол/возраст/рост/активность/дефицит и цель по калориям одни для обеих вкладок |
| История профиля | Цель **вморожена в строку дня** при создании; смена профиля не переписывает прошлое, пересчёт — явной кнопкой |
| Редактирование | Slide-over `ModalsBaseSlideOver`, как везде в проекте; инлайн-правку в `UTable` не вводим |
| Графики КБЖУ | Переключение периода день / неделя / месяц табами, агрегация на бэкенде |
| Импорт из Excel | **Не делаем** — присланный файл пустой шаблон, переносить нечего (см. «Про Excel») |

## Про Excel

Присланный `Дневник_похудения.xlsx` — незаполненный шаблон: колонки веса `B27:B126`,
калорий и все замеры пусты, дата начала равна дате генерации (2026-08-26). Единственные
данные — настройки профиля: старт 75 кг, цель 66 кг, М, 30 лет, 160 см, лёгкая активность
(×1.375), дефицит 500 → BMR 1605, TDEE 2207, цель 1707 ккал. Они вводятся в форму профиля
руками. Формулы листа сверены с расчётным блоком ниже — расхождений нет.

Лист «Параметры тела» в шаблоне дублирует колонки ежедневного лога, отличаясь только
шагом дат (раз в 7 дней). В модели это одна сущность с необязательными обхватами.

## Что реально есть в проекте

**Стек (проверено, а не по описанию).** Backend — NestJS 11, Prisma 6 с провайдером
**MongoDB** (`prisma db push`, миграций нет), префикс `/api/v2`, глобальный `AuthGuard`
кладёт пользователя в `req.payload`, `nestjs-i18n` (en/ru), `@nestjs/schedule`, Swagger.
Frontend — Nuxt 4, Nuxt UI 4, Pinia, `@nuxtjs/i18n` (`strategy: no_prefix`), Tailwind 4.

**Конвенции, которым следует новый модуль:**

| Слой | Как принято |
|---|---|
| Prisma | `id String @id @default(auto()) @map("_id") @db.ObjectId`, `createdAt`/`updatedAt` на каждой модели, связь с `User` через `onDelete: Cascade`, **енумов нет** — `String` + TS-enum |
| Справочники | Глобальная коллекция с уникальным slug-полем `value` + i18n-лейблы в дочерней модели (`ExpenseCategory` / `ExpenseCategoryName`); пользовательские записи создаются на лету через `slugify(label)` с дедупом |
| Родитель-потомок | `FinancePlanner` → `BudgetItem[]`: потомки в отдельной коллекции с `onDelete: Cascade`, денормализованные суммы на родителе |
| Валидация API | `class-validator` DTO в `dto/`, `@ApiProperty`, `@UsePipes(new ValidationPipe({ transform: true }))` |
| Ответ API | Серализатор в `serializer/` (`ISerializedX`), вся арифметика и округления там, покрыт `*.spec.ts` |
| Типы фронта | Ручной интерфейс в `frontend/shared/types/*.ts`, зеркало серализатора, авто-импорт |
| Роуты фронта | Enum `ERoutes` в `shared/types/routes.ts` + пункт в `app/assets/constants/menu.ts` |
| Запросы | `lib/api.ts` — карта URL; `useFetch` на страницах, `$fetch` в обработчиках |
| Формы | Slide-over `ModalsBaseSlideOver` + `UForm` + **Zod-схема прямо в компоненте** (`modals/EditPlanner.vue`) |
| Таблицы | `UTable` + `TableColumn[]` с `cell: ({ row }) => ...` (`finance/Table.vue`), только чтение + меню действий; поддерживает `v-model:expanded` и слот `#expanded` |
| Вкладки | `UTabs` `variant="link"` (`pages/settings/index.vue`) |
| Графики | `nuxt-charts`: `LineChart`, `AreaChart`, `AreaStackedChart`, `BarChart`, `DonutChart` |
| i18n | Плоские неймспейсы в `i18n/locales/{en,ru}.json`; на бэке `src/i18n/{en,ru}` |

**Профиля здоровья в схеме нет.** `User` содержит только
`name/email/phone/exchange/role/language/total` — ни пола, ни возраста, ни роста.
Дублей не будет; `HealthProfile` — новая сущность.

**Сид-механизма в проекте нет** — ни `prisma/seed.ts`, ни `db seed` в скриптах;
`ExpenseCategory` наполняется на лету пользователем. Под продукты его надо завести.

## Модель данных (Prisma, MongoDB)

Шесть моделей. Обхваты не выносятся в отдельную таблицу: одна запись на дату с
необязательными обхватами покрывает и ежедневный вес, и еженедельные замеры.

```prisma
model HealthProfile {
  id     String @id @default(auto()) @map("_id") @db.ObjectId
  userId String @unique

  // Профиль для расчёта нормы
  sex           String    // "male" | "female"  → EHealthSex
  birthDate     DateTime  // возраст выводится, чтобы не устаревал
  heightCm      Float
  activityLevel String    // "sedentary" | "light" | "moderate" | "high" → EActivityLevel

  // Цель по весу
  startWeightKg  Float
  targetWeightKg Float
  startedAt      DateTime // дата начала дневника

  // Настройки расчёта калорий
  dailyDeficit Int @default(500) // ккал/день

  // Настройки распределения БЖУ (коэффициенты редактируемые, не зашитые)
  proteinPerKg Float  @default(1.8)       // г белка на кг
  proteinBasis String @default("current") // "current" | "target" — от какого веса считать белок
  fatPercent   Float  @default(0.3)       // доля калорий на жиры

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime  @default(now())
  updatedAt DateTime? @default(now())
}

model HealthBodyEntry {
  id     String @id @default(auto()) @map("_id") @db.ObjectId
  userId String

  date     DateTime // startOfUtcDay, как в utils/date.ts
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

model HealthProduct {
  id    String @id @default(auto()) @map("_id") @db.ObjectId
  value String @unique // slug, как у ExpenseCategory

  // КБЖУ на 100 г
  kcalPer100    Float
  proteinPer100 Float
  fatPer100     Float
  carbsPer100   Float

  category String? // "grains" | "meat" | "dairy" | "vegetables" | ... → EProductCategory

  label HealthProductName[]
  items HealthMealItem[]

  createdAt DateTime  @default(now())
  updatedAt DateTime? @default(now())
}

model HealthProductName {
  id        String @id @default(auto()) @map("_id") @db.ObjectId
  label     String
  lang      String
  productId String

  product HealthProduct @relation(fields: [productId], references: [id], onDelete: Cascade)

  createdAt DateTime  @default(now())
  updatedAt DateTime? @default(now())
}

model HealthNutritionEntry {
  id     String @id @default(auto()) @map("_id") @db.ObjectId
  userId String

  date DateTime

  // Денормализованный итог за день — сумма приёмов, пересчитывается сервисом
  kcal     Float @default(0)
  proteinG Float @default(0)
  fatG     Float @default(0)
  carbsG   Float @default(0)

  // Цель, зафиксированная при создании строки дня
  targetKcal     Float
  targetProteinG Float
  targetFatG     Float
  targetCarbsG   Float

  note String?

  meals HealthMeal[]
  user  User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime  @default(now())
  updatedAt DateTime? @default(now())

  @@unique([userId, date])
}

model HealthMeal {
  id      String @id @default(auto()) @map("_id") @db.ObjectId
  entryId String

  mealType String // "breakfast" | "lunch" | "dinner" | "snack" → EMealType

  // Итог приёма — сумма позиций, считает бэкенд
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
  mealId String

  grams     Float
  productId String?
  title     String  // снимок названия: продукт могут переименовать или удалить

  // Снимок КБЖУ позиции на момент записи — правка продукта не переписывает историю
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

В `User` добавляются обратные связи: `healthProfile HealthProfile?`,
`healthBodyEntries HealthBodyEntry[]`, `healthNutritionEntries HealthNutritionEntry[]`.

**Три уровня — день → приём → позиция.** В прошлой версии плана приём пищи был просто
группировкой позиций по `mealType`, без своей записи. Требование «в таблице одна запись
на приём, КБЖУ приёма считает бэкенд» делает приём самостоятельной сущностью со своими
итогами, поэтому `HealthMeal` возвращается. Структура повторяет `FinancePlanner` →
`BudgetItem`: потомки каскадом, денормализованные суммы на родителе.

**Енумы.** Prisma с MongoDB енумы поддерживает, но в проекте их нет ни одного, поэтому
идём по конвенции: `String` в схеме + `EHealthSex` / `EActivityLevel` / `EMealType` /
`EProductCategory` в `backend/types/health.ts` и `frontend/shared/types/health.ts`,
валидация через `@IsEnum`.

**Снимки вместо ссылок.** Цель дня, итог приёма и КБЖУ каждой позиции хранятся
посчитанными. Это то же решение, что вы приняли для целей: правка продукта или профиля
задним числом не должна менять записанную историю. Цена — денормализация; выигрыш —
воспроизводимый дневник и живой приём пищи после удаления продукта.

## Справочник продуктов

Справочник в v1 — **только для чтения**. Создание продуктов из интерфейса не делаем:
записи приходят из сида, пополнение — дописать позицию в файл сида и прогнать его заново.
Поэтому у `HealthProduct` нет `userId`: личных продуктов не существует, все записи
системные. Вернуть их позже — добавить `userId String?` и связь с `User`; на MongoDB это
`db push` без миграции, так что решение обратимо почти бесплатно.

Названия — через дочернюю `HealthProductName`, как у категорий расходов: по одному label
на каждый язык из `SUPPORTED_LANGUAGES`.

**Сид.** Заводим `backend/prisma/seed.ts` + `prisma.seed` в `package.json`, идемпотентный
`upsert` по `value`. Кладём пять продуктов, намеренно разнесённых по профилю
макронутриентов, чтобы на них проверялась вся арифметика:

| value | Название | Ккал/100 г | Б | Ж | У | Что проверяет |
|---|---|---|---|---|---|---|
| `chicken-breast` | Куриная грудка | 113 | 23.6 | 1.9 | 0.4 | Чистый белок |
| `buckwheat` | Гречка (сухая) | 308 | 12.6 | 3.3 | 57.1 | Чистые углеводы |
| `olive-oil` | Оливковое масло | 884 | 0 | 100 | 0 | Верхняя граница ккал, чистый жир |
| `egg` | Яйцо куриное | 157 | 12.7 | 11.5 | 0.7 | Смешанный профиль |
| `cottage-cheese-5` | Творог 5% | 121 | 17 | 5 | 1.8 | Дробные граммы |

Цифры — референсные, для разработки; при наполнении справочника их стоит сверить.

**Следствие, о котором стоит знать заранее.** Пока в справочнике пять позиций, вкладка
КБЖУ годится для проверки логики, но не для ежедневного ведения дневника. Чтобы она
заработала по-настоящему, к релизу в сид нужен список продуктов, которые вы реально
едите. Пришлите его на этапе реализации — положу в тот же файл.

Порции только в граммах. Штучные единицы (1 яйцо, 1 ломтик) — расширение через
`gramsPerPiece` в `HealthProduct`, в v1 не делаем.

## Расчёты (чистые функции, `health.calculator.ts` + unit-тесты)

Всё считается на бэкенде и приезжает готовым, как в `PlannerSerializer`. Фронт ничего
не пересчитывает (кроме предпросмотра в форме, см. «Фронтенд»).

```
age            = полных лет от birthDate на сегодня
currentWeight  = weightKg последней по дате HealthBodyEntry, иначе startWeightKg
BMR (Миффлин—Сан Жеор)
  муж: 10*currentWeight + 6.25*heightCm − 5*age + 5
  жен: 10*currentWeight + 6.25*heightCm − 5*age − 161
TDEE           = BMR * ACTIVITY[activityLevel]        // 1.2 / 1.375 / 1.55 / 1.725
targetKcal     = max(TDEE − dailyDeficit, SAFE_MIN[sex])   // 1500 муж / 1200 жен
lost           = startWeightKg − currentWeight
remaining      = currentWeight − targetWeightKg
progress       = (startWeightKg − currentWeight) / (startWeightKg − targetWeightKg)
```

`progress` защищаем от деления на ноль (старт == цель) и клампим отображение в 0..100%,
как сделано в `PlannerSerializer` для `progress` статьи.

**БЖУ — доказательная схема, коэффициенты в профиле:**

```
proteinG = proteinPerKg * (proteinBasis === "target" ? targetWeightKg : currentWeight)
fatG     = targetKcal * fatPercent / 9
carbsG   = (targetKcal − proteinG*4 − fatG*9) / 4
```

Дефолты: белок **1.8 г/кг** (коридор 1.6–2.2 г/кг сохраняет мышцы в дефиците), жиры
**30% калорий** (норма 20–35%), углеводы — остаток. Опция `proteinBasis: "target"`
нужна при выраженном ожирении, где расчёт от текущего веса завышает белок.

Крайний случай: если после белка и жира остаток углеводов уходит в минус, серализатор
отдаёт `carbsG: 0` и флаг `isMacroConflict: true` — фронт показывает предупреждение
вместо молчаливого искажения цифр.

**Каскад сумм:** позиция `kcal = kcalPer100 * grams / 100` (и так же по Б/Ж/У) → приём =
сумма позиций → день = сумма приёмов. Округление одно и то же на всех трёх уровнях
(ккал до целых, граммы до 0.1), чтобы итог дня сходился с суммой видимых строк.

**Отклонение по калориям** (цветовая индикация из Excel): `deviation = kcal − targetKcal`,
статус `under` / `onTarget` (±5% цели) / `over` — считает бэкенд, чтобы пороги не
расползлись по компонентам.

**Агрегация для графика:** `granularity=day|week|month`. Неделя — ISO-недели от
понедельника UTC, месяц — календарный, обе точки отдают **средние за период**, а не суммы
(сумма за месяц несопоставима с дневной целью). В точке приходят и факт, и средняя цель.

## API

Один модуль `backend/src/health/` (controller → service → PrismaService, серализаторы
в `serializer/`), зарегистрирован в `AppModule`. Все URL добавляются в `frontend/lib/api.ts`
под ключом `health`.

**Профиль**

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/health/profile` | Профиль + вычисляемое: `age`, `currentWeight`, `bmr`, `tdee`, `targetKcal`, целевые БЖУ, `lost`, `remaining`, `progress`. Профиля ещё нет — `{ isConfigured: false }` |
| `POST` | `/health/profile` | Первичное заполнение профиля |
| `PATCH` | `/health/profile` | Профиль и коэффициенты БЖУ |

`getOrCreate` из планера здесь не подходит: у пола, роста и стартового веса нет разумных
умолчаний, автосозданный профиль считал бы норму по выдуманным числам. Поэтому пустое
состояние явное, а профиль создаётся первым `POST` из формы.

**Вес и параметры тела**

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/health/body?from&to` | Сводка + список записей + точки графиков веса и обхватов |
| `POST` | `/health/body` | Upsert по `(userId, date)` — повторный ввод той же даты не плодит дубли |
| `PATCH` | `/health/body/:id` | Правка записи |
| `DELETE` | `/health/body/:id` | 204 |

**КБЖУ**

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/health/nutrition?from&to&granularity` | Дни с фактом, целью, отклонением и статусом; внутри дня — приёмы пищи с итогами и составом; агрегаты за период; точки графика по выбранной гранулярности |
| `PATCH` | `/health/nutrition/:id` | Правка цели дня и заметки (факт правится через приёмы) |
| `DELETE` | `/health/nutrition/:id` | 204, каскадом уносит приёмы и позиции |
| `POST` | `/health/nutrition/meals` | Создать приём целиком: `{ date, mealType, items: [{ productId, grams }] }`. День создаётся при необходимости, цели берутся из профиля, КБЖУ позиций и итог приёма считает бэкенд |
| `PATCH` | `/health/nutrition/meals/:mealId` | Изменить приём: `mealType` и/или полный новый состав `items` — позиции заменяются целиком |
| `DELETE` | `/health/nutrition/meals/:mealId` | 204 |
| `POST` | `/health/nutrition/apply-targets` | Пересчитать цели по текущему профилю за диапазон дат — явное действие, а не побочный эффект правки профиля |

Отдельных эндпоинтов на позицию нет: состав приёма всегда приходит целиком, это ровно
то, что делает форма. Одна операция — одна транзакция, частично сохранённых приёмов
не бывает.

**Продукты**

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/health/products?search&category` | Список из сида, i18n-лейбл по текущему языку. Единственный эндпоинт справочника в v1 |

Любая запись или удаление приёма дёргает `recalcDay(userId, date)` — пересчёт
денормализованных итогов дня одной транзакцией с изменением.

DTO: `CreateHealthProfileDto`, `UpdateHealthProfileDto`, `UpsertBodyEntryDto`, `UpdateBodyEntryDto`,
`UpdateNutritionEntryDto`, `CreateMealDto` (с вложенным `MealItemDto[]`, валидация через
`@ValidateNested` + `@Type`), `UpdateMealDto`,
`FindHealthRangeDto` (`from`/`to`, `granularity`; дефолт — последние 90 дней).
Валидация — `class-validator`: `@IsEnum`, `@IsNumber`, `@Min`, `@Max`, `@IsOptional`,
`@IsDateString`, `@ArrayMinSize(1)` на состав приёма. Санитарные границы: вес 20–500 кг,
рост 50–260 см, обхваты 10–300 см, граммы 1–5000, ккал на 100 г 0–900, дефицит 0–1500.

`UpsertBodyEntryDto` требует хотя бы одно заполненное поле (вес или обхват) — проверка
в сервисе, `BadRequestException` с ключом из `nestjs-i18n`.

Владение проверяется по `req.payload.id` перед каждой правкой и удалением
(паттерн `loadOwnedPlanner` из `planner.service.ts`), для приёма — через его день.

Пагинации нет: диапазон дат ограничивает выборку, а графику нужен весь период.

## Фронтенд

**Роуты.** В `ERoutes` добавляются `health = "/health"`, `healthBody = "/health/body"`,
`healthNutrition = "/health/nutrition"`.

```
app/pages/health/
  index.vue              → редирект на /health/body
  body/index.vue         вкладка «Вес и параметры тела»
  nutrition/index.vue    вкладка «КБЖУ»
```

Вкладки — `UTabs variant="link"` в общем компоненте `HealthTabs.vue`, где каждый item
несёт `to`. URL остаётся адресуемым (ссылка сразу на КБЖУ), раздел — один пункт меню,
в отличие от `finance` с двумя отдельными пунктами.

Меню: `{ to: ERoutes.healthBody, key: "health", icon: "i-lucide-heart-pulse" }` в
`app/assets/constants/menu.ts` + ключ `routes.health` в обеих локалях.

**Компоненты** (`app/components/health/`):

| Компонент | Что делает |
|---|---|
| `Tabs.vue` | Переключатель вкладок раздела |
| `RangeSwitcher.vue` | Период выборки (30 / 90 дней / всё), по образцу `planner/MonthSwitcher.vue` |
| `Summary.vue` | Карточки: старт / текущий / цель / сброшено / осталось + `UProgress`, по образцу `planner/Summary.vue` |
| `WeightChart.vue` | `LineChart`: факт веса + линия цели константной серией |
| `MeasurementsChart.vue` | `LineChart`, три серии: грудь / талия / рука |
| `BodyTable.vue` | `UTable`: дата, вес, обхваты, заметка + меню действий |
| `NormCard.vue` | BMR / TDEE / дефицит / цель ккал + целевые БЖУ, кнопка настроек, предупреждение при `isMacroConflict` |
| `NutritionDay.vue` | День: шапка с фактом / целью / отклонением (цвет по `status`) + таблица приёмов внутри |
| `MealsTable.vue` | `UTable`, **строка = приём пищи**: тип, состав одной строкой, ккал, Б/Ж/У, действия; `v-model:expanded` + слот `#expanded` разворачивает позиции |
| `GranularitySwitcher.vue` | Табы день / неделя / месяц над графиком |
| `CaloriesChart.vue` | `BarChart` факт по выбранной гранулярности + линия цели |
| `MacrosDonut.vue` | `DonutChart` фактического распределения Б/Ж/У за период |
| `ProductPicker.vue` | `USelectMenu` с поиском по `/health/products`, `virtualize` (как выбор валюты в `EditPlanner.vue`) |

Модалки (`app/components/modals/`, по образцу `EditPlanner.vue` — `BaseSlideOver` +
`UForm` + Zod прямо в компоненте): `EditHealthProfile.vue`, `AddBodyEntry.vue`,
`AddMeal.vue`.

**`EditHealthProfile.vue` — форма, с которой начинается раздел.** Поля: пол
(`URadioGroup`), дата рождения, рост, стартовый и целевой вес, дата начала дневника,
дефицит ккал/день, уровень активности (`USelect` из четырёх вариантов с подписанными
коэффициентами ×1.2 / ×1.375 / ×1.55 / ×1.725) и коэффициенты БЖУ (белок г/кг, база
белка, доля жиров). Всё вводится руками; из этого набора бэкенд считает BMR → TDEE →
дневную норму калорий и целевые БЖУ, и они сразу видны в `NormCard`.

Пока профиля нет, считать нечего: обе вкладки показывают пустое состояние с кнопкой,
открывающей эту форму.

**`AddMeal.vue` — центральная форма вкладки.** Внутри: дата, тип приёма и список строк
состава, каждая — `ProductPicker` + граммы + кнопка удаления, плюс «добавить продукт».
Под списком — предпросмотр итога приёма. Сохранение — один `POST /health/nutrition/meals`
со всем составом, после чего в таблице появляется одна запись.

Предпросмотр считается на фронте из `kcalPer100` уже загруженных продуктов и нужен
только чтобы не сохранять вслепую. Сохранённые числа приходят с бэкенда — на них же
перерисовывается таблица, так что расхождение округлений увидеть невозможно.

**Редактирование — slide-over, как везде.** Инлайн-правку ячеек `UTable` не вводим:
все таблицы проекта на чтение, правка идёт через `ModalsBaseSlideOver`. Правка приёма
открывает ту же форму с заполненным составом.

**Графики — существующая библиотека.** `nuxt-charts` уже подключена в `nuxt.config.ts`;
вторую не добавляем. Ограничение: горизонтальной reference-линии в ней нет, поэтому цель
приходит с бэкенда отдельной серией с константным значением в каждой точке.

## Порядок работ

1. Схема Prisma + `prisma db push` + типы-енумы на обеих сторонах.
2. `health.calculator.ts` с unit-тестами (BMR/TDEE/цель/БЖУ/прогресс/каскад сумм/крайние случаи).
3. Модуль профиля: `GET`/`POST`/`PATCH` + серализатор + тесты, форма и пустое состояние —
   с них начинается работающий раздел.
4. Вкладка «Вес и параметры тела» целиком: API → типы → страница → графики.
5. Справочник продуктов: модель, `prisma/seed.ts` с пятью продуктами, `GET`, `ProductPicker`.
6. Лог КБЖУ: приёмы и позиции, `recalcDay`, агрегация по гранулярности, страница.
7. i18n en/ru на обе вкладки.

Пункты 4 и 5–6 независимы после 1–3; вкладка веса может уехать в прод раньше КБЖУ.

## Что отложено

Уведомления («не вносил вес N дней», «третий день превышение цели») — точка расширения
готова: `ENotificationGroup.Health` + `HealthCron` по образцу `goals.cron.ts`. Виджет
здоровья на `/dashboard`. Штучные порции. Создание и правка продуктов из интерфейса — личные продукты и админский
ввод системных. Внешняя база продуктов по штрихкоду.
Повторение вчерашнего приёма одной кнопкой — очевидное продолжение, но после релиза.

## Открытые вопросы

Блокирующих не осталось — у каждого есть рабочее умолчание, любой можно поменять по ходу.

1. **Единицы измерения.** Кг/см жёстко или переключение на фунты/дюймы?
   *(Предлагаю кг/см жёстко: хранение всё равно в СИ, конверсия — слой представления,
   добавляется позже без миграции.)*
2. **Период по умолчанию** на обеих вкладках — 90 дней? 100, как в Excel? Всё время?
   *(Предлагаю 90 дней с переключателем.)*
3. **Приёмы пищи** — фиксированный набор (завтрак / обед / ужин / перекус) или
   пользовательский? *(Предлагаю фиксированный: набор универсален, а произвольные
   названия ломают группировку в отчётах.)*
4. **Несколько приёмов одного типа за день** — разрешаем два перекуса или объединяем в
   один? *(Предлагаю разрешать: модель это уже позволяет, ограничение только раздражало бы.)*
