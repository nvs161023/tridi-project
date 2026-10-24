-- =============================================================================
-- Мастерская: настройки калькулятора себестоимости
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную: Supabase Dashboard →
-- SQL Editor (или psql/Termius). Автоматически не выполняется — как и остальные
-- файлы в supabase/.
--
-- Зачем таблица:
--   1. на вкладке «Калькулятор» пользователь задаёт свои числа: тариф на
--      электричество, мощность принтера, амортизацию и стоимость часа работы;
--   2. по этим числам считается себестоимость заказа и рекомендованная цена;
--   3. строка одна на пользователя (unique user_id), поэтому сохранение —
--      upsert по user_id, а не insert с проверкой «есть ли уже».
--
-- Модель доступа: только свои настройки. Политика select нужна ещё и для
-- upsert: PostgREST отдаёт строку из `insert ... on conflict do update ...
-- returning` только если её можно прочитать.
--
-- Пределы в check повторяют ограничения формы (lib/workshop/settings.ts):
-- форма не даст ввести число, которое база отклонит, а база не пропустит
-- запрос в обход формы.
--
-- Проверить после применения:
--   select column_name, data_type, column_default, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'workshop_settings';
--   select tablename, policyname, cmd, roles
--     from pg_policies
--    where schemaname = 'public' and tablename = 'workshop_settings';
-- =============================================================================

create table if not exists public.workshop_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  electricity_cost_kwh numeric(10, 2) not null default 5.5
    check (electricity_cost_kwh >= 0 and electricity_cost_kwh <= 1000),
  printer_power_w integer not null default 150
    check (printer_power_w >= 0 and printer_power_w <= 10000),
  depreciation_cost_hour numeric(10, 2) not null default 10
    check (depreciation_cost_hour >= 0 and depreciation_cost_hour <= 100000),
  labor_cost_hour numeric(10, 2) not null default 300
    check (labor_cost_hour >= 0 and labor_cost_hour <= 100000),
  updated_at timestamptz not null default now()
);

comment on table public.workshop_settings is
  'Мастерская: настройки калькулятора себестоимости, одна строка на пользователя.';
comment on column public.workshop_settings.electricity_cost_kwh is
  'Цена электричества, ₽ за кВт·ч (по умолчанию 5.5).';
comment on column public.workshop_settings.printer_power_w is
  'Средняя мощность принтера при печати, Вт (по умолчанию 150).';
comment on column public.workshop_settings.depreciation_cost_hour is
  'Амортизация принтера, ₽ за час печати (по умолчанию 10).';
comment on column public.workshop_settings.labor_cost_hour is
  'Стоимость часа работы, ₽ за час (по умолчанию 300).';
comment on column public.workshop_settings.updated_at is
  'Момент последнего сохранения; выставляется триггером при каждом update.';

-- updated_at не должен зависеть от клиента: триггер перезаписывает его при
-- любом обновлении строки, даже если приложение забыло передать поле.
create or replace function public.workshop_settings_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workshop_settings_touch_updated_at on public.workshop_settings;
create trigger workshop_settings_touch_updated_at
  before update on public.workshop_settings
  for each row execute function public.workshop_settings_touch_updated_at();

-- RLS: пользователь читает и меняет только свою строку.
alter table public.workshop_settings enable row level security;

drop policy if exists "workshop_settings_select_own" on public.workshop_settings;
create policy "workshop_settings_select_own" on public.workshop_settings
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "workshop_settings_insert_own" on public.workshop_settings;
create policy "workshop_settings_insert_own" on public.workshop_settings
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "workshop_settings_update_own" on public.workshop_settings;
create policy "workshop_settings_update_own" on public.workshop_settings
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Гранты: Supabase выдаёт их автоматически, но явный grant делает миграцию
-- самодостаточной на чистой базе. Удаление строки через API не нужно:
-- настройки удаляются вместе с аккаунтом (on delete cascade).
revoke all on public.workshop_settings from anon, authenticated;
grant select, insert, update on public.workshop_settings to authenticated;
grant all on public.workshop_settings to service_role;

-- PostgREST кэширует схему: без перечитывания API ещё некоторое время отвечает
-- PGRST205 на новую таблицу.
notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Пользователь видит только свои настройки:
--      select user_id, electricity_cost_kwh, printer_power_w,
--             depreciation_cost_hour, labor_cost_hour, updated_at
--        from public.workshop_settings where user_id = '<USER_ID>';
--
-- 2) Строка одна на пользователя: повторный upsert по user_id обновляет её,
--    а не создаёт вторую.
--
-- 3) Сбросить настройки пользователя к значениям по умолчанию:
--      delete from public.workshop_settings where user_id = '<USER_ID>';
-- =============================================================================
