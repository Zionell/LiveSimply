# Ревью проекта LiveSimply

Дата: 2026-08-22 · Ветка: `feature/budget-planner` · Бэкенд (NestJS + Prisma/MongoDB) + фронтенд (Nuxt 4).

Все 111 юнит-тестов бэкенда проходят (`npx jest`) — перечисленные ниже проблемы тестами не покрыты.

Ссылки на строки соответствуют состоянию рабочей копии на момент ревью.

---

## 🔴 Критично — безопасность

### 1. IDOR: любой пользователь может читать/менять/удалять чужие транзакции
`backend/src/finance/finance.controller.ts:59-70,79-84` → `finance.service.ts:383,394,453`

`GET/PATCH/DELETE /api/v2/finance/:id` принимают только `id` и вообще не получают `req`. Проверки `userId` нет ни в контроллере, ни в сервисе.

```
GET /api/v2/finance/<чужой_id>      → отдаёт чужую транзакцию
PATCH /api/v2/finance/<чужой_id>    → меняет её
DELETE /api/v2/finance/<чужой_id>   → удаляет её
```

Правильный образец есть рядом — `planner.service.ts:74-98` (`loadOwnedPlanner` / `loadOwnedItem`). Нужно применить тот же приём.

### 2. IDOR: то же самое с целями (goals)
`backend/src/goals/goals.controller.ts:37-52` → `goals.service.ts:65,76,91`

`findOne`, `update`, `remove` работают по голому `id`. Через `PATCH /goals/:id` можно поменять чужую цель (в т.ч. `amount`, `isCompleted`).

### 3. Удаление любого аккаунта одним запросом
`backend/src/users/users.controller.ts:66-72` → `users.service.ts:218`

`DELETE /api/v2/users/:id` — нет ни проверки роли админа, ни проверки «это я сам». Любой залогиненный пользователь удаляет любой аккаунт, вместе с ним каскадом улетают планировщики, цели и уведомления.

### 4. Эскалация привилегий и mass-assignment через `PATCH /users`
`backend/src/users/users.controller.ts:60-64` → `users.service.ts:196-216`

`@Body() dto: Partial<UpdateUserDto>` — `Partial<T>` это TS-тип, а не класс. В `design:paramtypes` попадает `Object`, поэтому `ValidationPipe` **пропускает валидацию целиком**. Далее тело запроса напрямую расплющивается в Prisma:

```ts
const data = { updatedAt: new Date(), ...dto };
await this.prismaService.user.update({ where: { id }, data });
```

Последствия:
- `{"role":"ADMIN"}` — самоповышение до админа, следом открывается `GET /users` со списком всех email;
- `{"total": 999999}` — произвольный баланс;
- `{"emailVerified": true}` — обход подтверждения почты;
- `{"password":"123"}` — пароль записывается **без хеширования** (`bcrypt.hash` вызывается только в `create`), после чего вход по нему невозможен, а в БД лежит открытый пароль.

Нужен реальный DTO-класс + `whitelist: true, forbidNonWhitelisted: true` и явный список разрешённых полей.

### 5. Чужая цель через `POST /finance`
`backend/src/finance/finance.service.ts:225-245`

`goalsId` из тела не проверяется на принадлежность. `goalsService.findOne` вернёт чужую цель (её можно накрутить) либо `null` — и тогда `curGoal.exchangeId` упадёт с TypeError → 500.

### 6. OAuth: `state` генерируется, но никогда не проверяется
`backend/src/auth/auth.controller.ts:81` (создание) vs `:88-110` (callback)

`state` кладётся в URL авторизации и на возврате полностью игнорируется. Классический login-CSRF: атакующий может залогинить жертву в свой аккаунт.

### 7. `redirectTo` — глобальная переменная модуля
`backend/src/auth/auth.controller.ts:22,83,108`

```ts
let redirectTo = "";   // одна на весь процесс
```

Два параллельных входа через Google перетирают значение друг друга — пользователя выкинет туда, куда шёл кто-то другой. Значение к тому же нигде не валидируется.

### 8. Рейт-лимит настроен, но не включён
`backend/src/app.module.ts:42-47`

`ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])` есть, а `{ provide: APP_GUARD, useClass: ThrottlerGuard }` — нет (`grep ThrottlerGuard` по `src/` пусто). Ограничение не действует нигде, в том числе на `POST /auth/login` — перебор паролей ничем не сдерживается.

### 9. Срок жизни JWT — около 82 лет
`backend/src/config/configuration.ts:5`

```ts
JWT_EXPIRES_IN: 30 * 24 * 60 * 60 * 1000,   // это миллисекунды
```

Числовой `expiresIn` в jsonwebtoken трактуется как **секунды**. 2 592 000 000 секунд ≈ 82 года. Токен фактически вечный, механизма отзыва нет — утёкшая кука действует навсегда.

### 10. Ссылка подтверждения почты содержит полноценный токен сессии
`backend/src/users/users.service.ts:88-105` vs `:109`

`sendMagicLink` подписывает токен дефолтным секретом модуля (`JWT_SECRET`), а `verifyEmail` пытается проверять его через `MAGIC_LINK_SECRET`, которого **нет в `.env`** (в `configuration.ts:8` он объявлен, в `.env` отсутствует) — то есть падает обратно на тот же `JWT_SECRET`. Итог: токен из письма — валидная кука авторизации с тем же сроком жизни (см. п.9). Любой, кто увидит URL из письма (пересланное письмо, логи, referrer), получает полный доступ к аккаунту.

### 11. AuthGuard пропускает токен удалённого пользователя
`backend/src/auth/guards/auth.guard.ts:44-59`

Если `user.findUnique` вернул `null`, `request.payload` становится `null`, но `canActivate` всё равно возвращает `true`. Для хендлеров, которые не читают `payload` (а это ровно все IDOR-эндпоинты из пп. 1–3), запрос отработает штатно.

---

## 🟠 Высокий — целостность данных

### 12. `PATCH /finance/:id` не пересчитывает `convertedPrice`
`backend/src/finance/finance.service.ts:405-411`

В `update` тело просто уходит в Prisma. Меняем `curPrice` или `currencyFromId` — `convertedPrice` остаётся старым. На нём завязаны статистика, планировщик и бюджетные алерты, то есть после любого редактирования цифры расходятся.

### 13. `update` и `remove` не корректируют `user.total`
`backend/src/finance/finance.service.ts:394,453`

`create` баланс двигает (`:247-264`), а редактирование и удаление — нет. Баланс постепенно расходится со списком операций. На фронте `app/pages/finance/list/index.vue:27-48` после удаления тоже не обновляет стор пользователя.

### 14. «Очистить все операции» не обнуляет баланс
`backend/src/finance/finance.service.ts:279-316`

`resetAll` удаляет `financeItem`, сбрасывает `notifiedThreshold`, но `user.total` не трогает. После сброса в шапке остаются деньги от удалённых транзакций. Фронт (`app/components/settings/Finance.vue:37-54`) тоже не перезагружает таблицу и профиль.

### 15. Деление на ноль в конвертации валют
`backend/src/rates/rates.service.ts:243-250`

```ts
const toBase = res.find(r => r.value === from)?.rate || 0;
const convertToBase = price / toBase;      // 0 → Infinity
```

Новые валюты создаются с `rate: null` (`:92`), поэтому `|| 0` — реальный сценарий, а не теоретический. `Infinity` затем пишется в `convertedPrice` / `convertedIncome` и отравляет всю статистику и алерты. Нужна явная проверка и осмысленная ошибка.

### 16. Цель никогда не помечается выполненной
`backend/src/finance/finance.service.ts:235-244`

Ограничение — `Math.round(newAmount) > Math.ceil(curGoal.total)`, а завершение — `isCompleted: newAmount === curGoal.total`. Точное равенство float'ов при округлённой до 2 знаков конвертации практически недостижимо: цель можно докинуть «до конца», но `isCompleted` останется `false`. Нужно `>=`.

### 17. Цель пополняется даже если транзакция не сохранилась
`backend/src/finance/finance.service.ts:241-264`

Порядок: обновили цель → создали `financeItem` → обновили баланс. Транзакции нет, поэтому падение на любом следующем шаге оставляет цель накрученной без соответствующей операции.

### 18. Гонка в `copyRegularPlanners`, ломающая копирование для всех остальных
`backend/src/planner/planner.service.ts:494-542`

Схема `findUnique` → `create` не атомарна. Если в 00:05 UTC пользователь одновременно открыл приложение (`getOrCreate` создаёт планировщик сам), `create` упадёт с P2002. В `getOrCreate:216-228` этот код обрабатывается, а здесь — нет: исключение вылетает из цикла, и **все оставшиеся пользователи** остаются без скопированного плана в этом месяце. Нужен `try/catch` на P2002 внутри итерации.

### 19. Регулярный план копируется по прошлогоднему курсу
`backend/src/planner/planner.service.ts:511-541`

`convertedIncome` и `convertedAmount` переносятся как есть, без пересчёта по актуальному курсу. Для планов в неевровой валюте расхождение накапливается каждый месяц.

### 20. Уменьшение лимита статьи не поднимает алерт
`backend/src/planner/planner.service.ts:372-380`

При изменении суммы вызывается только `resetAfterChange`. Если урезать план ниже уже потраченного, порог оказывается превышен, но уведомление не создаётся. Симметричный код в `finance.service.ts:428-444` делает и `resetAfterChange`, и `checkAfterExpense` — здесь второго вызова не хватает.

### 21. У `FinanceItem` нет связи с `User` в схеме
`backend/prisma/schema.prisma:111-128`

Есть голое поле `userId`, но нет `user User @relation(..., onDelete: Cascade)` — в отличие от `Notification`, `Goal`, `FinancePlanner`. Удаление пользователя оставляет все его транзакции сиротами навсегда.

Там же: ни одного индекса по `userId` / `createdAt`. Каждый запрос статистики и планировщика (`collectMonthFacts`, `sumExpenses`) — полный скан коллекции.

### 22. `present(null)` после ретрая
`backend/src/planner/planner.service.ts:216-231`

После обработки P2002 повторный `findUnique` теоретически может вернуть `null` (запись успели удалить) — дальше `PlannerSerializer.serialize(null)` упадёт с TypeError. Нужна явная проверка.

---

## 🟡 Средний — логика и UX

### 23. Модалки закрываются при ошибке и теряют введённое
`app/components/modals/EditPlanner.vue:70-73`, `AddBudgetItem.vue:97-100`, `AddNewFinance.vue:112-115`

`slideOverRef.value?.handleClose()` стоит в `finally`. Конфликт 409 «категория уже запланирована» показывает тост об ошибке и одновременно стирает форму — пользователю приходится вводить всё заново. Закрывать надо только в ветке успеха (в `AddNewFinance` закрытие к тому же продублировано: строки 82 и 114).

### 24. `AddNewFinance` отправляет неактуальные `goalsId` / `expenseCategoryId`
`app/components/modals/AddNewFinance.vue:54-83`

Поля скрываются по `v-if` при смене типа операции, но `state` не чистится. Выбрал цель → передумал → выбрал «расход» → в теле всё равно уходит `goalsId`, и бэкенд молча пополняет цель на сумму расхода.

### 25. Кнопка удаления статьи бюджета зависает в загрузке
`app/components/planner/Item.vue:28-31`

`isRemoving = true` без сброса. Родитель ловит ошибку сам (`pages/finance/planner/index.vue:44-47`), компонент не перерисовывается — спиннер остаётся навсегда.

### 26. Редирект после логина ведёт не туда
`app/middleware/auth.global.ts:6,21`

`redirectUrl` собирается из `from.fullPath` — это страница, **откуда** пришёл пользователь, а не `to.path`, куда он шёл. При заходе по прямой ссылке на `/goals` из внешнего источника `from.fullPath` = `/`, и после логина человек попадёт на дашборд. Плюс значение не проходит через `encodeURIComponent`.

### 27. `redirectUrl=undefined`
`app/composables/useAuth.ts:8-12`

Если query-параметра нет, `URLSearchParams` превращает `undefined` в строку `"undefined"`. Бэкенд кладёт её в `redirectTo` и редиректит на `${FRONTEND_URL}undefined` → 404.

### 28. Прокси-middleware Nitro нерабочий
`frontend/server/middleware/proxy.ts:13`

```ts
const proxyURL = new URL(url.href, target);
```

`url.href` абсолютный, поэтому база `target` игнорируется — запрос проксируется сам в себя. Не проявляется только потому, что `/api/v2` перехватывают раньше vite-прокси в дев-режиме (`nuxt.config.ts:28-37`) и rewrite Vercel в проде (`vercel.json`). Мёртвый и опасный код: любое изменение маршрутизации приведёт к рекурсии.

### 29. `throw new Error(e)` вместо проброса исключения
`finance.service.ts` (×7), `goals.service.ts` (×6), `rates.service.ts` (×6), `notifications.service.ts:66,206`

Оборачивание объекта ошибки в `Error` превращает любые `BadRequestException` / `NotFoundException` в 500, теряет стек и даёт сообщение вида `Error: [object Object]`. Фронт при этом рассчитывает на `e.data.message` (`assets/utils/common.ts:54`) и показывает пользователю общий «error» вместо конкретики. Нужен просто `throw e`.

### 30. Категории расходов — общий на всех справочник
`backend/src/finance/finance.service.ts:93-140`, `finance.controller.ts:47-52`

`POST /finance/expense-categories` не привязывает категорию к пользователю: созданное одним человеком видят все. Метка сохраняется одним и тем же текстом во все языки (`:126-129`), а при совпадении слага возвращается чужая категория с чужим названием. Плюс на эндпоинте нет никаких ограничений — можно засорить общий справочник.

### 31. Email-уведомления по умолчанию выключены и молча не отправляются
`backend/src/notifications/notifications.service.ts:100-110`

У нового пользователя `emailNotifications` = `null`, а проверка — `!== true`. То есть письма не уходят никому, пока человек сам не найдёт настройки и не включит каждую группу. Если это задумано — стоит явно проговорить в UI; если нет — нужны дефолты.

### 32. Колокольчик уведомлений не обновляется
`app/components/layout/NotificationsBell.vue:5-7`

`fetchNotifications()` только в `onMounted`. Уведомления от крона (напоминание спланировать месяц) появятся лишь после полной перезагрузки страницы. Нужен polling или обновление при открытии поповера.

### 33. Logout: кука гасится другими атрибутами и по GET
`backend/src/auth/auth.controller.ts:49-57`

`response.cookie("token", "")` без `httpOnly/secure/sameSite`, которыми кука ставилась при логине. Метод GET — выход можно спровоцировать любой картинкой на стороннем сайте. `catch` возвращает объект ошибки как тело ответа.

### 34. Несогласованный `sameSite` у куки
`auth.controller.ts:41` (`"lax"`) vs `users.controller.ts:48` (`"none"`) — одна и та же кука ставится с разными политиками в зависимости от того, каким путём пользователь вошёл.

---

## 🔵 Мелочи

| # | Где | Что |
|---|-----|-----|
| 35 | `app/assets/utils/numbers.ts:8-25` | `shortThousands` не округляет: 1234 → `"1.234K"` на оси графика |
| 36 | `app/assets/utils/numbers.ts:44` | `countPercentage(x, 0)` → `Infinity` |
| 37 | `app/assets/utils/common.ts:19` | `document.execCommand("copy")` — устаревший API, есть `navigator.clipboard` |
| 38 | `frontend/i18n/locales/ru.json` | 7 ключей `signInAndSignUp.*` есть в `ru`, но отсутствуют в `en`; используется только `signInAndSignUp.login` — остальное мёртвый код |
| 39 | `app/components/finance/Table.vue:95` | Захардкоженный лейбл `"Delete"` мимо i18n |
| 40 | `finance.controller.ts:76,83`, `notifications.controller.ts:44,51`, `goals.controller.ts:29,51` | `return HttpStatus.NO_CONTENT` под `@HttpCode(204)` — тело всё равно отбрасывается |
| 41 | `app/stores/notifications.ts:41-54` | `markRead` шлёт PATCH даже для уже прочитанного уведомления |
| 42 | `app/assets/utils/colors.ts:4` | Паддинг из строки `"00000"` (5 символов) при нужде в 6 — работает только благодаря маске, ломкий код |
| 43 | `finance.service.ts:144` | `const userId: ERole = req?.payload?.id` — неверный тип |
| 44 | `backend/src/main.ts:33-39` | Swagger UI открыт на `/api/v2/docs` без условия на окружение |

---

## Что чинить в первую очередь

1. **пп. 1–5** — проверки владения (`userId`) на всех эндпоинтах finance/goals/users и настоящий DTO с `whitelist` на `PATCH /users`. Это прямая утечка и порча чужих данных.
2. **пп. 8, 9** — включить `ThrottlerGuard`, перевести `JWT_EXPIRES_IN` в секунды (`30 * 24 * 60 * 60`).
3. **пп. 12–15** — пересчёт `convertedPrice`, корректировка `user.total` при update/remove/reset, защита от деления на ноль.
4. **пп. 6, 7, 10** — проверка `state`, вынос `redirectTo` из глобальной переменной, отдельный секрет и короткий TTL для ссылки подтверждения почты.
5. **п. 18** — обработка P2002 в кроне, иначе одна коллизия ломает копирование планов всем остальным.
