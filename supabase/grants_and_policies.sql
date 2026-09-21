-- =============================================================================
-- Права доступа и RLS-политики для курса «3D-печать с нуля»
-- =============================================================================
-- Справочная копия SQL, применённого вручную в Supabase Dashboard → SQL Editor
-- (проект wxzwyirrqophfnltsapj). Автоматически не выполняется — это документация
-- того, как настроены таблицы profiles, lesson_progress, subscriptions.
--
-- Проверено запросами к PostgREST:
--   service_role    -> 200 на всех трёх таблицах
--   authenticated   -> 200, RLS отдаёт только строки текущего пользователя
--   anon (без входа)-> 401 42501 permission denied (доступ сознательно закрыт)
-- =============================================================================

-- 1. Доступ к схеме
grant usage on schema public to authenticated, service_role;

-- 2. Привилегии на таблицы (anon намеренно НЕ получает доступ: личные данные)
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.lesson_progress to authenticated;
grant select on public.subscriptions to authenticated;

-- service_role — админский ключ для серверных задач (обходит RLS, но GRANT нужен)
grant all on all tables in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;

-- 3. Row Level Security
alter table public.profiles enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.subscriptions enable row level security;

-- 4. Политики: каждый пользователь видит и меняет только свои данные
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id);

create policy "lesson_progress_select_own" on public.lesson_progress
  for select to authenticated using (auth.uid() = user_id);
create policy "lesson_progress_insert_own" on public.lesson_progress
  for insert to authenticated with check (auth.uid() = user_id);
create policy "lesson_progress_update_own" on public.lesson_progress
  for update to authenticated using (auth.uid() = user_id);

create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated using (auth.uid() = user_id);
-- Изменять статус подписки может только service_role: политик для
-- authenticated на update/insert здесь нет.

-- Схема таблиц (для справки):
--   profiles        (id uuid, email text, name text, created_at timestamptz)
--   lesson_progress (id uuid, user_id uuid, lesson_id integer, completed_at timestamptz)
--   subscriptions   (id uuid, user_id uuid, status text, trial_ends_at timestamptz,
--                    created_at timestamptz, updated_at timestamptz)
