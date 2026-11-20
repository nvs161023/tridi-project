# Ручная проверка платежей Robokassa

Чек-лист владельца магазина: как убедиться, что оплата выдаёт ровно то, что
обещает витрина, чек уходит в ФНС по 54-ФЗ, а повторное уведомление не выдаёт
товар второй раз.

Автоматическая часть — `npm run check:payments` (`scripts/test-payments.mjs`).
Скрипт подписывает уведомления ResultURL и передаёт их прямо в роут, поэтому
проверяет настоящий код обработки платежей, но не открывает интерфейс оплаты.
Ручная часть ниже нужна, чтобы проверить сам кабинет Robokassa, реальный чек и
возврат денег.

Дата составления: 20 ноября 2026.

---

## 0. Подготовка

### 0.1. SQL-миграции

Примените в Supabase → SQL Editor, если ещё не сделано:

- `supabase/purchases.sql` — таблица `purchases`, уникальный `inv_id`;
- `supabase/user_credits.sql` — `token_purchases`, `user_credits` и функция
  `credit_token_purchase`;
- `supabase/subscriptions_recurring.sql` — `subscriptions.expires_at` и функция
  `apply_pro_subscription_purchase`.

Проверка, что PostgREST видит функцию продления (в SQL Editor):

```sql
select proname, pg_get_function_identity_arguments(oid) as args
  from pg_proc
 where proname in ('credit_token_purchase', 'apply_pro_subscription_purchase');
```

**Важно.** 20 ноября 2026 проверено: `apply_pro_subscription_purchase` и
`credit_token_purchase` видны PostgREST, вебхук продлевает подписку через
функцию, строки «SQL-функция apply_pro_subscription_purchase не найдена» в логе
нет. `npm run check:payments` сам проверяет наличие обеих RPC и падает с
подсказкой, какой файл применить, если функцию убрали или миграцию не выполнили.
После ручного применения SQL выполните `notify pgrst, 'reload schema';` — он уже
есть в конце `subscriptions_recurring.sql`.

### 0.2. Настройки магазина в Robokassa

1. **ResultURL** — `https://tridi-print.ru/api/payments/robokassa/result`,
   метод **POST**. Проверьте, что включена проверка подписи и указан пароль №2.
2. **Тестовый контур** — в кабинете Robokassa включите тестовый режим. Для
   теста используйте **тестовые** пароли №1 и №2 из технических настроек: с
   боевым паролем при `IsTest=1` Robokassa отвечает ошибкой 29.
3. **Переменные окружения** — в `.env.local` (локально) и в окружении Amvera:

   ```text
   ROBOKASSA_LOGIN=...
   ROBOKASSA_PASSWORD1=...   # пароль №1, подпись ссылки на оплату
   ROBOKASSA_PASSWORD2=...   # пароль №2, подпись ResultURL
   ROBOKASSA_IS_TEST=true    # локально; в production — false
   ROBOKASSA_RECURRING=false # автопродление выключено, как в оферте
   ```

4. **Минимальная сумма.** Robokassa принимает от 1 ₽, но у конкретного способа
   оплаты порог может быть выше (у карт часто 10 ₽). Самый дешёвый товар в
   каталоге — пакет Standard за 500 ₽, поэтому для проверки минимума достаточно
   его. Меньше тарифа вебхук всё равно не примет: ответ
   `400 amount does not match plan`.

### 0.3. Автоматический прогон

```powershell
npm run check:payments
```

Скрипт создаёт временного пользователя, отправляет подписанные уведомления,
сверяет `purchases`, `token_purchases`, `user_credits` и `subscriptions`, затем
удаляет пользователя и все его строки. Деньги не списываются.

В CI этот прогон не добавлен: ему нужны живая база и боевые (тестовые) пароли
Robokassa, а `.github/workflows/ci.yml` намеренно работает без секретов. Поэтому
`check:payments` запускается вручную перед выкатом и после правок оплаты.

---

## 1. Что и где должно появиться

| Товар | Цена | `purchases` | Доступ |
| --- | ---: | --- | --- |
| Пакет Standard | 500 ₽ | `course_id = standard-pack`, `expires_at = null` | `token_purchases`: `kind = standard`, `quantity = 10`; `user_credits.standard_tokens + 10` |
| Пакет Ultra | 600 ₽ | `course_id = ultra-pack`, `expires_at = null` | `token_purchases`: `kind = ultra`, `quantity = 5`; `user_credits.ultra_tokens + 5` |
| Подписка Pro | 1 486 ₽ | `course_id = pro-subscription`, `expires_at = сейчас + 30 дней` | `subscriptions.status = active`, тот же `expires_at`; инструменты Pro открыты |
| Курс «Уверенный» | 2 990 ₽ | `course_id = confident`, `expires_at = null` | уроки `confident` открыты, `engineer` и `profit` — нет |
| Курс «Инженер» | 3 990 ₽ | `course_id = engineer`, `expires_at = null` | уроки `engineer` |
| Курс «Заработок» | 4 990 ₽ | `course_id = profit`, `expires_at = null` | уроки `profit` |
| Пакет «Все три курса» | 9 900 ₽ | `course_id = pro`, `expires_at = null` | все три уровня уроков; инструменты Pro пакет больше не открывает |

`InvId` — уникальный номер заказа Robokassa. Он же первичный ключ в
`token_purchases` и уникальный индекс в `purchases`, поэтому повтор уведомления
не создаёт вторую покупку.

---

## 2. Пакет Standard: 500 ₽ → 10 генераций

1. Войдите тестовым пользователем, откройте `/pricing`, нажмите покупку
   пакета Standard.
2. Оплатите тестовой картой. После возврата на сайт откройте
   `/3d-generator` — в блоке лимитов должно появиться 10 Standard-генераций.
3. Проверьте базу (подставьте id пользователя из Authentication → Users):

   ```sql
   select inv_id, user_id, course_id, amount, expires_at, created_at
     from public.purchases
    where user_id = '<UUID>'
    order by created_at desc;

   select inv_id, user_id, kind, quantity, created_at
     from public.token_purchases
    where user_id = '<UUID>'
    order by created_at desc;

   select user_id, standard_tokens, ultra_tokens, updated_at
     from public.user_credits
    where user_id = '<UUID>';
   ```

4. Ожидаемо: одна строка `purchases` (`standard-pack`, 500.00,
   `expires_at = null`), одна строка `token_purchases` (`standard`, 10) и
   `standard_tokens = 10`.

## 3. Подписка Pro: 1 486 ₽ → 30 дней

1. На `/pricing` оплатите подписку Pro.
2. Проверьте, что открылись инструменты Pro (Конструктор, Профили), а уроки
   платных курсов остались закрыты — подписка даёт только инструменты.
3. Проверьте базу:

   ```sql
   select inv_id, course_id, amount, expires_at, created_at
     from public.purchases
    where user_id = '<UUID>' and course_id = 'pro-subscription'
    order by created_at desc;

   select id, status, expires_at, trial_ends_at, updated_at
     from public.subscriptions
    where user_id = '<UUID>'
    order by updated_at desc;
   ```

4. Ожидаемо: `purchases.expires_at ≈ сейчас + 30 дней`,
   `subscriptions.status = active` с тем же сроком, одна строка подписки.
5. Оплатите подписку ещё раз (новый `InvId`) — срок должен увеличиться ровно
   на 30 дней от текущего, а не от «сейчас». Если человек платит заранее,
   оставшиеся дни не сгорают.

## 4. Курс «Уверенный»: 2 990 ₽ → доступ навсегда

1. Оплатите курс `confident` со страницы курса.
2. Откройте `/courses/confident` — платные уроки должны быть доступны, а
   `engineer` и `profit` — закрыты.
3. Проверьте базу:

   ```sql
   select inv_id, course_id, amount, expires_at, created_at
     from public.purchases
    where user_id = '<UUID>' and course_id = 'confident'
    order by created_at desc;
   ```

   Ожидаемо: одна строка, `amount = 2990.00`, `expires_at = null`.

4. В `/admin/purchases` покупка должна отображаться с суммой и датой; кнопка
   возврата доступна, пока не отмечен ни один платный урок и не сдан тест
   модуля (оферта: 7 дней).

---

## 5. Повторное уведомление: товар не выдаётся второй раз

Robokassa повторяет ResultURL, если не получила `OK{InvId}`. Проверять повтор
можно кнопкой «Проверить» в настройках ResultURL или вручную с тем же `InvId`.

**Ожидаемо:** ответ `OK{InvId}`, в `purchases` и `token_purchases` по-прежнему
одна строка, `standard_tokens` не вырос, срок подписки не сдвинулся.

Ручной повтор уведомления (PowerShell; `<UUID>` и `InvId` — из предыдущего
платежа, пароль №2 — из окружения):

```powershell
$outSum = "500.00"
$invId = "<InvId>"
$user = "<UUID>"
$p2 = $env:ROBOKASSA_PASSWORD2
$raw = "$outSum`:$invId`:$p2`:Shp_course=standard-pack:Shp_user=$user"
$md5 = [Security.Cryptography.MD5]::Create()
$sig = ([BitConverter]::ToString($md5.ComputeHash([Text.Encoding]::UTF8.GetBytes($raw)))).Replace("-", "").ToLower()

Invoke-WebRequest -Method Post `
  -Uri "https://tridi-print.ru/api/payments/robokassa/result" `
  -Body @{
    OutSum = $outSum
    InvId = $invId
    SignatureValue = $sig
    Shp_course = "standard-pack"
    Shp_user = $user
  } | Select-Object StatusCode, Content
```

Проверка «чужой» суммы: подпишите `OutSum=1.00` тем же паролем №2 — сервер
должен ответить `400 amount does not match plan` и не записать покупку.

## 6. Чек 54-ФЗ

### 6.1. Что уходит в чек

Параметр `Receipt` в ссылке на оплату — URL-кодированный JSON. Один товар —
одна позиция:

```json
{
  "items": [
    {
      "name": "Пакет Standard: 10 генераций",
      "quantity": 1,
      "sum": 500,
      "payment_method": "full_payment",
      "payment_object": "service",
      "tax": "none"
    }
  ]
}
```

Правила, которые нельзя менять:

- `name` — название из тарифа, до 128 символов; у пакетов указано количество
  генераций;
- `sum` — полная сумма позиции и она же `OutSum`: чек не может расходиться с
  платежом, иначе Robokassa отклонит оплату;
- `payment_method = full_payment` — полный расчёт;
- `payment_object = service` — услуга;
- `tax = none` — магазин самозанятого на НПД, без НДС.

`Receipt` кодируется для ссылки **один раз** (`%20` → `+`), а в подпись входит
**сырой JSON** до кодирования. Двойное кодирование даёт ошибку 29 «Неверный
параметр Signature».

### 6.2. Тестовый и боевой контур

- В тестовом режиме (`IsTest=1`) деньги не списываются, а фискальный чек в
  ОФД, как правило, не уходит. Состав чека проверяйте по параметру `Receipt` и
  логам вебхука.
- Настоящий чек проверяйте после **боевой** оплаты минимального товара:
  раздел «Мои операции» в кабинете Robokassa → чек по операции. Там видны
  фискальный признак, сумма, наименование и признак расчёта.
- В ОФД (например, «Платформа ОФД» или «Такском») чек ищется по номеру
  фискального документа (ФД) или фискальному признаку документа (ФПД) из
  кабинета Robokassa. Сверьте: сумма = `OutSum`, НДС нет, предмет расчёта —
  услуга, способ расчёта — полный расчёт.

## 7. Возврат

1. Верните деньги **в кабинете Robokassa**: «Мои операции» → операция →
   возврат. Robokassa поддерживает полный возврат; частичный возврат оформлять
   нельзя без отдельного товара.
2. Закройте доступ в админке `/admin/purchases` кнопкой возврата (или
   `POST /api/admin/refund` с телом
   `{ "purchaseId": "<uuid purchases>", "reason": "..." }`). Появится запись в
   `refund_audit`.
3. Проверьте, что доступ закрыт:

   ```sql
   select inv_id, course_id, expires_at from public.purchases
    where id = '<purchase uuid>';

   select status, expires_at from public.subscriptions
    where user_id = '<UUID>';
   ```

   У покупки `expires_at` — момент возврата; у подписки `status = cancelled`
   (на старой схеме с ограничением статусов — `canceled`), `expires_at` в
   прошлом.

4. Повторно отправьте то же уведомление Robokassa — доступ **не** должен
   восстановиться: срок возвращённого заказа уже в прошлом.

---

## 8. Очистка тестовых данных

```sql
delete from public.token_purchases where user_id = '<UUID>';
delete from public.purchases where user_id = '<UUID>';
delete from public.subscriptions where user_id = '<UUID>';
delete from public.user_credits where user_id = '<UUID>';
```

Затем удалите тестового пользователя в Supabase → Authentication → Users.
Скрипт `npm run check:payments` делает это сам.

Перед закрытием задачи верните боевые настройки: `ROBOKASSA_IS_TEST=false` в
production-окружении, выключите тестовый режим в кабинете Robokassa.

---

## Чек-лист

- [ ] Применены `purchases.sql`, `user_credits.sql`, `subscriptions_recurring.sql`;
      `apply_pro_subscription_purchase` видна PostgREST.
- [ ] ResultURL — `https://tridi-print.ru/api/payments/robokassa/result`, метод POST.
- [ ] `npm run check:payments` — «Итог: все проверки пройдены».
- [ ] Пакет Standard: чек 500 ₽, +10 `standard_tokens`, запись в
      `token_purchases`; повтор ничего не начислил.
- [ ] Подписка Pro: срок +30 дней, `subscriptions.status = active`; второй
      платёж добавил ещё 30 дней; повтор — нет.
- [ ] Курс `confident`: бессрочная покупка, уроки открыты, соседние уровни — нет.
- [ ] Чек в кабинете/ОФД: сумма = `OutSum`, `tax = none`, «полный расчёт»,
      «услуга», название с количеством генераций.
- [ ] Возврат в Robokassa + закрытие доступа в `/admin/purchases`; повтор
      уведомления доступ не восстановил.
- [ ] Тестовые строки и пользователь удалены; тестовый режим выключен.
