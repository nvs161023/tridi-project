-- =============================================================================
-- Мастерская: склад пластика (катушки)
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную: Supabase Dashboard →
-- SQL Editor (или psql/Termius). Автоматически не выполняется — как и остальные
-- файлы в supabase/.
--
-- Зачем таблица:
--   1. на вкладке «Склад» пользователь ведёт катушки: бренд, тип, цвет, вес,
--      остаток, цену за килограмм и порог «пора докупить»;
--   2. когда остаток падает ниже порога, интерфейс подсвечивает строку красным
--      и превращает ссылку на товар в кнопку «Купить»;
--   3. пластик списывается вручную после печати: `remaining_weight_g`
--      уменьшается на фактический вес модели.
--
-- Одна строка — одна физическая катушка. Поэтому unique user_id здесь нет, в
-- отличие от workshop_settings: катушек у мастера много, и они различаются
-- брендом, цветом и партией.
--
-- Пределы в check повторяют ограничения формы (lib/workshop/filaments.ts):
-- форма не даст ввести число, которое база отклонит, а база не пропустит
-- запрос в обход формы. Вес — целые граммы (integer), цена — numeric(10, 2).
--
-- Проверить после применения:
--   select column_name, data_type, column_default, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'workshop_filaments'
--    order by ordinal_position;
--   select policyname, cmd, roles
--     from pg_policies
--    where schemaname = 'public' and tablename = 'workshop_filaments';
-- =============================================================================

create table if not exists public.workshop_filaments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brand text not null
    check (char_length(btrim(brand)) between 1 and 60),
  type text not null
    check (char_length(btrim(type)) between 1 and 30),
  color text not null
    check (char_length(btrim(color)) between 1 and 40),
  total_weight_g integer not null default 1000
    check (total_weight_g >= 1 and total_weight_g <= 100000),
  remaining_weight_g integer not null
    check (remaining_weight_g >= 0 and remaining_weight_g <= 100000),
  price_per_kg numeric(10, 2) not null default 1500
    check (price_per_kg >= 0 and price_per_kg <= 100000),
  min_threshold_g integer not null default 200
    check (min_threshold_g >= 0 and min_threshold_g <= 100000),
  purchase_url text
    check (
      purchase_url is null
      or (
        char_length(purchase_url) <= 500
        and purchase_url ~* '^https?://'
      )
    ),
  created_at timestamptz not null default now(),
  -- Остаток не может быть больше исходного веса: иначе прогресс-бар уходит
  -- за 100 %, а расчёт «сколько осталось» перестаёт сходиться.
  constraint workshop_filaments_remaining_le_total
    check (remaining_weight_g <= total_weight_g)
);

comment on table public.workshop_filaments is
  'Мастерская: склад пластика, одна строка — одна катушка.';
comment on column public.workshop_filaments.brand is
  'Бренд катушки: Prusament, Bestfilament, REC…';
comment on column public.workshop_filaments.type is
  'Тип пластика: PLA, PETG, ABS, TPU, Nylon…';
comment on column public.workshop_filaments.color is
  'Цвет катушки в свободной форме: «Чёрный», «Galaxy Black».';
comment on column public.workshop_filaments.total_weight_g is
  'Вес новой катушки в граммах (по умолчанию 1000).';
comment on column public.workshop_filaments.remaining_weight_g is
  'Текущий остаток в граммах; уменьшается при списании пластика.';
comment on column public.workshop_filaments.price_per_kg is
  'Цена пластика, ₽ за килограмм (по умолчанию 1500).';
comment on column public.workshop_filaments.min_threshold_g is
  'Порог уведомления в граммах: ниже него строка краснеет и появляется «Купить» (по умолчанию 200).';
comment on column public.workshop_filaments.purchase_url is
  'Ссылка на товар в магазине; null — ссылки нет.';
comment on column public.workshop_filaments.created_at is
  'Когда катушку добавили на склад; по нему сортируется список.';

-- Список склада всегда фильтруется по владельцу и сортируется по дате
-- добавления — под этот запрос и индекс.
create index if not exists workshop_filaments_user_created_idx
  on public.workshop_filaments (user_id, created_at);

-- RLS: пользователь читает и меняет только свои катушки.
alter table public.workshop_filaments enable row level security;

drop policy if exists "workshop_filaments_select_own" on public.workshop_filaments;
create policy "workshop_filaments_select_own" on public.workshop_filaments
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "workshop_filaments_insert_own" on public.workshop_filaments;
create policy "workshop_filaments_insert_own" on public.workshop_filaments
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "workshop_filaments_update_own" on public.workshop_filaments;
create policy "workshop_filaments_update_own" on public.workshop_filaments
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Удаление разрешено только своих строк: пустую или ошибочно добавленную
-- катушку нужно уметь убрать. Корзина на вкладке «Склад» вызывает Server Action
-- deleteFilament, а тот дополнительно фильтрует запрос по user_id.
drop policy if exists "workshop_filaments_delete_own" on public.workshop_filaments;
create policy "workshop_filaments_delete_own" on public.workshop_filaments
  for delete to authenticated using (auth.uid() = user_id);

-- Гранты: Supabase выдаёт их автоматически, но явный grant делает миграцию
-- самодостаточной на чистой базе. delete нужен корзине на вкладке «Склад»;
-- кроме того, катушки уходят вместе с аккаунтом (on delete cascade).
revoke all on public.workshop_filaments from anon, authenticated;
grant select, insert, update, delete on public.workshop_filaments to authenticated;
grant all on public.workshop_filaments to service_role;

-- PostgREST кэширует схему: без перечитывания API ещё некоторое время отвечает
-- PGRST205 на новую таблицу.
notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Пользователь видит только свои катушки:
--      select id, brand, type, color, total_weight_g, remaining_weight_g,
--             price_per_kg, min_threshold_g, purchase_url, created_at
--        from public.workshop_filaments
--       where user_id = '<USER_ID>'
--       order by created_at;
--
-- 2) Списание не уходит в минус и не превышает исходный вес:
--      update public.workshop_filaments
--         set remaining_weight_g = 0
--       where id = '<FILAMENT_ID>' and user_id = '<USER_ID>';
--
-- 3) Порог срабатывает: строка с remaining_weight_g < min_threshold_g
--    подсвечивается в интерфейсе красным, ссылка становится кнопкой «Купить».
--
-- 4) Сбросить склад пользователя целиком:
--      delete from public.workshop_filaments where user_id = '<USER_ID>';
-- =============================================================================

