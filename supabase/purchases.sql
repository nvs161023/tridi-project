-- =============================================================================
-- Покупки курсов и подписки Pro (Robokassa)
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную в Supabase Dashboard →
-- SQL Editor. Автоматически не выполняется — как и остальные файлы в supabase/.
--
-- Зачем таблица:
--   1. разовая покупка курса или пакета даёт доступ навсегда (expires_at = null);
--   2. подписка Pro даёт доступ на 30 дней (expires_at = now() + 30 дней);
--   3. inv_id — номер заказа Robokassa. Он уникален, поэтому повторное
--      уведомление ResultURL не создаёт вторую покупку.
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'purchases';
--   select indexname from pg_indexes where tablename = 'purchases';
-- =============================================================================

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  inv_id bigint not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null check (
    course_id in (
      'confident',
      'engineer',
      'profit',
      'pro',
      'pro-subscription'
    )
  ),
  amount numeric(10, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- Если таблица уже существовала без inv_id, `create table if not exists` её не
-- изменит. Добавляем колонку отдельно: она нужна вебхуку Robokassa, а
-- уникальный индекс защищает от повторной выдачи доступа по тому же заказу.
alter table public.purchases
  add column if not exists inv_id bigint;

create unique index if not exists purchases_inv_id_key
  on public.purchases (inv_id);

-- Быстрый поиск доступа: «есть ли у пользователя покупка этого курса».
create index if not exists purchases_user_course_idx
  on public.purchases (user_id, course_id);

-- Row Level Security: пользователь видит только свои покупки. Записывать
-- покупки может только service_role из вебхука, поэтому политик insert/update
-- для authenticated нет.
alter table public.purchases enable row level security;

drop policy if exists "purchases_select_own" on public.purchases;

create policy "purchases_select_own" on public.purchases
  for select to authenticated using (auth.uid() = user_id);

grant select on public.purchases to authenticated;
grant all on public.purchases to service_role;

-- Примеры проверки доступа:
--   select course_id, amount, created_at, expires_at
--     from public.purchases where user_id = '<UUID>';
--
-- Выдать доступ вручную (например, для теста):
--   insert into public.purchases
--     (inv_id, user_id, course_id, amount, expires_at)
--   values
--     (900000000001, '<UUID>', 'confident', 2990, null);
-- =============================================================================
