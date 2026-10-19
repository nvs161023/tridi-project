-- =============================================================================
-- Скачивания STL в Конструкторе: бесплатный лимит 3 в календарный месяц
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную в Supabase Dashboard →
-- SQL Editor. Автоматически не выполняется — как и остальные файлы в supabase/.
--
-- Зачем таблица:
--   1. каждая успешная генерация STL бесплатным пользователем оставляет запись;
--   2. сервер считает записи за текущий месяц по UTC и блокирует четвёртую
--      попытку до начала следующего месяца;
--   3. Pro-пользователи не записываются: для них лимита нет.
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'constructor_downloads';
--   select indexname from pg_indexes where tablename = 'constructor_downloads';
-- =============================================================================

create table if not exists public.constructor_downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Быстрый подсчёт за месяц: выборка всегда идёт по пользователю и периоду.
create index if not exists constructor_downloads_user_created_idx
  on public.constructor_downloads (user_id, created_at desc);

-- Row Level Security: пользователь видит только свои скачивания. Записывать
-- их может только service_role из API после успешной генерации STL, поэтому
-- политик insert/update/delete для authenticated намеренно нет.
alter table public.constructor_downloads enable row level security;

drop policy if exists "constructor_downloads_select_own"
  on public.constructor_downloads;

create policy "constructor_downloads_select_own"
  on public.constructor_downloads
  for select to authenticated using (auth.uid() = user_id);

-- Явно убираем права на запись у клиентских ролей: даже при будущей политике
-- INSERT не должна открыться возможность обойти лимит из браузера.
revoke all on public.constructor_downloads from anon, authenticated;
grant select on public.constructor_downloads to authenticated;
grant all on public.constructor_downloads to service_role;

-- Примеры проверки доступа:
--   select count(*) from public.constructor_downloads
--    where user_id = '<UUID>'
--      and created_at >= date_trunc('month', now() at time zone 'utc');
--
-- Удалить тестовые записи пользователя:
--   delete from public.constructor_downloads where user_id = '<UUID>';
-- =============================================================================
