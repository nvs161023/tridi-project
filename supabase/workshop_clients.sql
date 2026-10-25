-- =============================================================================
-- Мастерская: база клиентов
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную: Supabase Dashboard →
-- SQL Editor (или psql/Termius). Автоматически не выполняется — как и остальные
-- файлы в supabase/.
--
-- Порядок применения: после базовых миграций Мастерской
-- (workshop_settings.sql, workshop_filaments.sql, workshop_printers_orders.sql)
-- и каталога workshop_products.sql. База клиентов от них не зависит, но
-- вкладка «Клиенты» живёт в той же рабочей области.
--
-- Зачем таблица:
--   1. мастер сохраняет контакты один раз и подставляет их в заказы, а не
--      вводит имя, телефон и адрес при каждом заказе;
--   2. имя обязательно, остальные поля необязательны: телефон может быть не у
--      всех, а доставка — не у каждого заказа;
--   3. строки принадлежат владельцу: RLS сверяет auth.uid() с user_id, поэтому
--      чужие контакты не видны и не редактируются даже при подделанном запросе.
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'workshop_clients'
--    order by ordinal_position;
--   select indexname, indexdef
--     from pg_indexes
--    where schemaname = 'public' and tablename = 'workshop_clients';
--   select policyname, cmd, roles
--     from pg_policies
--    where schemaname = 'public' and tablename = 'workshop_clients'
--    order by policyname;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Клиенты
-- -----------------------------------------------------------------------------

create table if not exists public.workshop_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Имя или название компании — единственное обязательное поле. Проверка
  -- btrim отсекает строку из пробелов: приложение тоже требует непустое имя.
  name text not null check (btrim(name) <> ''),
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.workshop_clients is
  'Мастерская: база клиентов пользователя — контакты и адрес доставки.';
comment on column public.workshop_clients.name is
  'ФИО или название компании; единственное обязательное поле.';
comment on column public.workshop_clients.phone is
  'Телефон в свободном виде (цифры, пробелы, скобки, дефис, плюс); null — не указан.';
comment on column public.workshop_clients.email is
  'Email клиента; null — не указан.';
comment on column public.workshop_clients.address is
  'Адрес доставки; null — не указан.';
comment on column public.workshop_clients.notes is
  'Заметки о клиенте: скидка, особенности заказа, удобное время; null — нет.';

-- Список всегда читается по владельцу и свежими сверху: этому порядку и служит
-- составной индекс. Отдельный индекс по user_id не нужен — он уже первый.
create index if not exists workshop_clients_user_created_idx
  on public.workshop_clients (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 2. Row Level Security
-- -----------------------------------------------------------------------------

alter table public.workshop_clients enable row level security;

-- Каждый видит, создаёт и меняет только своих клиентов. Проверка идёт по
-- auth.uid(), а не по user_id из запроса: подставить чужой uuid бесполезно.
drop policy if exists "workshop_clients_select_own" on public.workshop_clients;
create policy "workshop_clients_select_own" on public.workshop_clients
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "workshop_clients_insert_own" on public.workshop_clients;
create policy "workshop_clients_insert_own" on public.workshop_clients
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "workshop_clients_update_own" on public.workshop_clients;
create policy "workshop_clients_update_own" on public.workshop_clients
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "workshop_clients_delete_own" on public.workshop_clients;
create policy "workshop_clients_delete_own" on public.workshop_clients
  for delete to authenticated using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. Гранты
-- -----------------------------------------------------------------------------

-- Supabase выдаёт гранты автоматически, но явный grant делает миграцию
-- самодостаточной на чистой базе. anon не получает доступ: это личные данные.
revoke all on public.workshop_clients from anon, authenticated;
grant select, insert, update, delete on public.workshop_clients to authenticated;
grant all on public.workshop_clients to service_role;

-- PostgREST кэширует схему: без перечитывания API ещё некоторое время отвечает
-- PGRST205 на новую таблицу, и вкладка «Клиенты» выглядит пустой.
notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Структура и индекс:
--      select column_name, data_type, is_nullable, column_default
--        from information_schema.columns
--       where table_schema = 'public' and table_name = 'workshop_clients'
--       order by ordinal_position;
--      select indexname, indexdef
--        from pg_indexes
--       where schemaname = 'public' and tablename = 'workshop_clients';
--
-- 2) Политики только для владельца:
--      select policyname, cmd, roles
--        from pg_policies
--       where schemaname = 'public' and tablename = 'workshop_clients'
--       order by policyname;
--
-- 3) Пользователь видит только своих клиентов:
--      select id, name, phone, email, address, created_at
--        from public.workshop_clients
--       where user_id = '<USER_ID>'
--       order by created_at desc;
--
-- 4) Пустое имя отклоняется ограничением check:
--      insert into public.workshop_clients (user_id, name)
--      values ('<USER_ID>', '   ');
--    Ожидается ошибка violates check constraint
--    "workshop_clients_name_check".
-- =============================================================================
