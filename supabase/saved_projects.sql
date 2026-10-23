-- =============================================================================
-- Сохранённые проекты Конструктора 3D
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную в Supabase Dashboard →
-- SQL Editor. Автоматически не выполняется — как и остальные файлы в supabase/.
--
-- Зачем таблица:
--   1. пользователь сохраняет настройки модели из конструктора под своим
--      названием и возвращается к ним позже;
--   2. кабинет показывает список «Мои 3D-проекты» и открывает проект ссылкой
--      /constructor?project=<id>;
--   3. параметры лежат объектом params_json (ConstructorParams), поэтому новые
--      модели и поля не требуют миграции: панель нормализует объект при чтении.
--
-- Модель доступа: только свои строки. Политика select нужна ещё и для
-- `insert ... returning id`: PostgREST отдаёт строку только если её можно
-- прочитать, иначе сохранение вернуло бы пустой ответ.
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'saved_projects';
--   select tablename, policyname, cmd, roles
--     from pg_policies
--    where schemaname = 'public' and tablename = 'saved_projects';
-- =============================================================================

create table if not exists public.saved_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  model_type text not null,
  params_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.saved_projects is
  'Сохранённые проекты Конструктора 3D: параметры модели в params_json.';

-- Кабинет всегда читает последние проекты одного пользователя.
create index if not exists saved_projects_user_created_idx
  on public.saved_projects (user_id, created_at desc);

-- RLS: пользователь видит и меняет только свои проекты.
alter table public.saved_projects enable row level security;

drop policy if exists "saved_projects_select_own" on public.saved_projects;
create policy "saved_projects_select_own" on public.saved_projects
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "saved_projects_insert_own" on public.saved_projects;
create policy "saved_projects_insert_own" on public.saved_projects
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "saved_projects_update_own" on public.saved_projects;
create policy "saved_projects_update_own" on public.saved_projects
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "saved_projects_delete_own" on public.saved_projects;
create policy "saved_projects_delete_own" on public.saved_projects
  for delete to authenticated using (auth.uid() = user_id);

-- Гранты: Supabase выдаёт их автоматически, но явный grant делает миграцию
-- самодостаточной на чистой базе.
revoke all on public.saved_projects from anon, authenticated;
grant select, insert, update, delete on public.saved_projects to authenticated;
grant all on public.saved_projects to service_role;

-- PostgREST кэширует схему: без перечитывания API ещё некоторое время отвечает
-- PGRST205 на новую таблицу.
notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Пользователь видит только свои проекты:
--      select id, title, model_type, created_at
--        from public.saved_projects where user_id = '<USER_ID>';
--
-- 2) Чужой project_id из адреса не открывается: запрос с eq('user_id', …)
--    вернёт пусто, а Server Action ответит «Проект не найден».
--
-- 3) Удалить проекты пользователя:
--      delete from public.saved_projects where user_id = '<USER_ID>';
-- =============================================================================
