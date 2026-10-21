-- =============================================================================
-- Подписка Pro: срок оплаты и автопродление (Robokassa Recurring)
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную в Supabase Dashboard →
-- SQL Editor (проект wxzwyirrqophfnltsapj). Автоматически не выполняется.
--
-- Зачем это нужно:
--   1. вебхук Robokassa (app/api/payments/robokassa/result/route.ts) после
--      оплаты продлевает подписку: пишет срок в subscriptions.expires_at и
--      ставит статус active. Без этой колонки запрос вернёт 42703;
--   2. продление идёт от текущего срока, а не от «сейчас»: если человек платит
--      заранее, оставшиеся дни не сгорают;
--   3. автопродление приходит тем же уведомлением с новым InvId. Повторный
--      InvId обрабатывается идемпотентно через уникальный purchases.inv_id,
--      поэтому вторая покупка и вторые 30 дней не появляются;
--   4. lib/subscription.ts читает expires_at вместе с trial_ends_at: доступ к
--      Конструктору и Профилям есть, пока дата в будущем.
--
-- Пока миграция не применена, сайт работает по-старому: доступ решает статус
-- подписки и purchases.expires_at, а вебхук отвечает Robokassa OK (иначе
-- Robokassa повторяла бы уведомление, а оно всё равно не записалось бы).
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'subscriptions';
--   select indexname from pg_indexes where tablename = 'subscriptions';
-- =============================================================================

-- 1. Срок оплаченной подписки. null — бессрочного доступа у подписки нет:
--    если дата в прошлом, доступ закрыт.
alter table public.subscriptions
  add column if not exists expires_at timestamptz;

-- 2. Поиск «у кого скоро закончится подписка» — для ручных напоминаний и
--    проверки перед отключением автопродления.
create index if not exists subscriptions_expires_at_idx
  on public.subscriptions (expires_at);

-- 3. Права и RLS менять не нужно (см. grants_and_policies.sql): authenticated
--    читает только свои строки, а пишет подписку service_role из вебхука.
--    Новая колонка политик не требует — RLS работает по строкам.

-- =============================================================================
-- Как проверить оплату и продление без реальных денег
-- =============================================================================
-- а) В личном кабинете Robokassa включите тестовый режим (IsTest=1) и оплатите
--    подписку на /subscription. В логах Vercel будет строка
--    «[Robokassa] Покупка записана» с expiresAt.
--
-- б) Смотрим подписку:
--      select user_id, status, expires_at, trial_ends_at, updated_at
--        from public.subscriptions order by updated_at desc limit 5;
--
-- в) Смотрим покупки — у каждого платежа свой InvId:
--      select inv_id, user_id, course_id, amount, expires_at, created_at
--        from public.purchases where course_id = 'pro-subscription'
--       order by created_at desc limit 5;
--
-- г) Проверяем идемпотентность: пришлите то же уведомление повторно (кнопка
--    «Проверить» в настройках ResultURL или повтор запроса с тем же InvId) —
--    expires_at не должен сдвинуться на вторые 30 дней.
--
-- д) Выключить подписку вручную:
--      update public.subscriptions
--         set status = 'canceled', expires_at = now(), updated_at = now()
--       where user_id = '<UUID>';
-- =============================================================================
