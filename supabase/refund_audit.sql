-- =============================================================================
-- Журнал возвратов (refund_audit)
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную в Supabase Dashboard →
-- SQL Editor (проект wxzwyirrqophfnltsapj). Автоматически не выполняется.
--
-- Зачем таблица:
--   1. возврат оставляет след в базе, а не только в console.log сервера:
--      кто оформил, какую покупку и когда вернул;
--   2. одна покупка возвращается один раз — уникальный purchase_id защищает от
--      двух записей при гонке двух администраторов;
--   3. причина необязательна: админка её не спрашивает, поэтому по умолчанию
--      пишется «Возврат по запросу администратора».
--
-- Пишет журнал только service_role из lib/refund.ts (route handler
-- POST /api/admin/refund). Пользователи и гости таблицу не читают: это
-- внутренние данные о платежах и возвратах.
--
-- Структура:
--   id          uuid        primary key default gen_random_uuid()
--   purchase_id uuid        not null, unique — строка purchases, по которой вернули деньги
--   user_id     uuid        not null — покупатель
--   course_id   text        not null — что именно вернули (confident…, pro-subscription)
--   refunded_at timestamptz not null — момент возврата (тот же, что purchases.expires_at)
--   reason      text        not null — причина; по умолчанию формулировка админки
--   refunded_by uuid        null — id администратора из сессии (кто вернул)
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'refund_audit'
--    order by ordinal_position;
--   select indexname from pg_indexes where tablename = 'refund_audit';
-- =============================================================================

create table if not exists public.refund_audit (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null,
  user_id uuid not null,
  course_id text not null,
  refunded_at timestamptz not null default now(),
  reason text not null default 'Возврат по запросу администратора',
  refunded_by uuid
);

-- Повторный возврат той же покупки не создаёт вторую запись. Индекс, а не
-- отдельное ограничение: имя одинаковое при повторном запуске файла.
create unique index if not exists refund_audit_purchase_id_key
  on public.refund_audit (purchase_id);

-- Свежие возвраты первыми: по этому индексу читается история в админке.
create index if not exists refund_audit_refunded_at_idx
  on public.refund_audit (refunded_at desc);

-- Пользовательские выборки «мои возвраты» тоже возможны без полного скана.
create index if not exists refund_audit_user_id_idx
  on public.refund_audit (user_id);

alter table public.refund_audit enable row level security;

-- Политик select/insert/update/delete нет: журнал ведёт только service_role.
-- Явные revoke/grant делают миграцию самодостаточной и закрывают anon.
revoke all on public.refund_audit from public, anon, authenticated;
grant all on public.refund_audit to service_role;

-- PostgREST кэширует схему: после создания таблицы просим перечитать её,
-- иначе lib/refund.ts получит PGRST205 и вернёт auditSaved: false.
notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) service_role видит таблицу (пустой массив — таблица есть):
--      curl "<SUPABASE_URL>/rest/v1/refund_audit?select=id&limit=1" \
--        -H "apikey: <SERVICE_ROLE_KEY>" \
--        -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
--
-- 2) anon получает 401/403 (доступа нет):
--      curl "<SUPABASE_URL>/rest/v1/refund_audit?select=id&limit=1" \
--        -H "apikey: <ANON_KEY>"
--
-- 3) Последние возвраты:
--      select purchase_id, user_id, course_id, refunded_at, reason, refunded_by
--        from public.refund_audit
--       order by refunded_at desc
--       limit 20;
--
-- 4) Одна покупка — одна запись:
--      select purchase_id, count(*)
--        from public.refund_audit
--       group by purchase_id
--      having count(*) > 1;
-- =============================================================================
