-- =============================================================================
-- История генераций 3D-моделей и публичная галерея
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную в Supabase Dashboard →
-- SQL Editor. Автоматически не выполняется — как и остальные файлы в supabase/.
--
-- Зачем таблица:
--   1. строка появляется в момент создания задачи в `/api/generate-3d` —
--      ещё до того, как сеть начнёт считать модель;
--   2. на первом успешном опросе `/api/check-3d-status` кладёт готовый STL в
--      закрытый бакет `generated-models` и записывает путь в `stl_url`:
--      временная папка «мясорубки» живёт до перезапуска контейнера;
--   3. `is_public = false` по умолчанию: модель видит только владелец, а
--      галерею открывает он сам в «Моих моделях»;
--   4. скачивание идёт только через `/api/generations/<id>/stl`, поэтому
--      приватность решает сервер, а не прямая ссылка на файл.
--
-- Модель доступа:
--   * браузер читает только `id, category, created_at, is_public` — без
--     `user_id`, `task_id` и `stl_url`;
--   * списки «Мои модели» и галереи собирает сервер служебным клиентом, поэтому
--     RLS и явный фильтр по `user_id`/`is_public` остаются на сервере;
--   * публикация и смена категории идут через RPC: прямой update колонок из
--     браузера закрыт, а RPC проверяет `auth.uid() = user_id`;
--   * запись и удаление строк — только service_role.
--
-- ВАЖНО: перед этим файлом примените `supabase/generations_category.sql`:
-- гранты ниже перечисляют колонку `category`, и без неё SQL завершится ошибкой.
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'generations';
--   select tablename, policyname, cmd, roles
--     from pg_policies
--    where schemaname = 'public' and tablename = 'generations';
-- =============================================================================

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Номер задачи у сети: по нему опрос находит строку и дописывает STL.
  task_id text not null unique,
  service text not null check (service in ('tripo', 'meshy')),
  -- Путь объекта в бакете `generated-models`, пока файла нет — NULL.
  stl_url text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.generations is
  'История генераций 3D-моделей по фото: задача сети, путь STL и флаг публикации.';
comment on column public.generations.task_id is
  'Номер задачи Tripo или Meshy — по нему /api/check-3d-status находит строку.';
comment on column public.generations.stl_url is
  'Путь STL в закрытом бакете generated-models; NULL, пока модель не готова.';
comment on column public.generations.is_public is
  'true — модель показывает /gallery; скачивание всё равно только после входа.';

-- «Мои модели» и галерея всегда читают последние строки.
create index if not exists generations_user_created_idx
  on public.generations (user_id, created_at desc);

-- Публичная лента не должна перебирать чужие приватные строки.
create index if not exists generations_public_created_idx
  on public.generations (created_at desc)
  where is_public and stl_url is not null;

-- RLS: свои строки — владельцу, публичные — всем.
alter table public.generations enable row level security;

drop policy if exists "generations_select_own" on public.generations;
create policy "generations_select_own" on public.generations
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "generations_select_public" on public.generations;
create policy "generations_select_public" on public.generations
  for select to anon, authenticated
  using (is_public and stl_url is not null);

drop policy if exists "generations_insert_own" on public.generations;
create policy "generations_insert_own" on public.generations
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "generations_update_own" on public.generations;
create policy "generations_update_own" on public.generations
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "generations_delete_own" on public.generations;
create policy "generations_delete_own" on public.generations
  for delete to authenticated using (auth.uid() = user_id);

-- Гранты: браузеру доступны только публичные поля карточки. `task_id` — ключ
-- опроса внешней сети, `stl_url` — путь в закрытом бакете, `user_id` — чужой
-- идентификатор: клиенту они не нужны. Списки читает сервер service_role.
revoke all on public.generations from anon, authenticated;
grant select (id, category, created_at, is_public)
  on public.generations to anon;
grant select (id, category, created_at, is_public)
  on public.generations to authenticated;
grant all on public.generations to service_role;

-- =============================================================================
-- RPC публикации и категории
-- =============================================================================
-- Прямой update из браузера закрыт вместе с грантами. Эти функции работают
-- security definer и сами проверяют владельца по `auth.uid()`: чужой id не
-- изменит строку, даже если пользователь угадает UUID. `stl_url` внутри
-- функции доступен, но наружу колонка не отдаётся.
-- =============================================================================

create or replace function public.set_generation_visibility(
  p_id uuid,
  p_is_public boolean
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  update public.generations
     set is_public = p_is_public
   where id = p_id
     and user_id = auth.uid()
     -- Пока модели нет, публиковать нечего: галерее нечего показать.
     and stl_url is not null;

  return found;
end;
$$;

comment on function public.set_generation_visibility(uuid, boolean) is
  'Публикует или скрывает свою готовую модель; false — строка не найдена или чужая.';

create or replace function public.set_generation_category(
  p_id uuid,
  p_category text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_category not in ('toy', 'figure', 'decor', 'functional', 'other') then
    raise exception 'invalid generation category: %', p_category
      using errcode = '22023';
  end if;

  update public.generations
     set category = p_category
   where id = p_id
     and user_id = auth.uid();

  return found;
end;
$$;

comment on function public.set_generation_category(uuid, text) is
  'Меняет категорию своей модели; false — строка не найдена или чужая.';

revoke all on function public.set_generation_visibility(uuid, boolean)
  from public, anon;
revoke all on function public.set_generation_category(uuid, text)
  from public, anon;
grant execute on function public.set_generation_visibility(uuid, boolean)
  to authenticated;
grant execute on function public.set_generation_category(uuid, text)
  to authenticated;

-- PostgREST кэширует схему: без перечитывания API ещё некоторое время отвечает
-- PGRST205 на новую таблицу.
notify pgrst, 'reload schema';

-- =============================================================================
-- Бакет для STL истории
-- =============================================================================
-- Бакет закрытый: модели пользователей не должны лежать в открытом доступе.
-- Превью и скачивание идут через подписанные ссылки и роут
-- `/api/generations/<id>/stl`, где service_role читает файл после проверки
-- сессии. `file_size_limit` 50 МБ — столько же, сколько у `3d-models`.
--
-- Если бакет уже создан вручную в Dashboard, блок ничего не сломает:
-- `on conflict` только приводит настройки к нужным.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-models',
  'generated-models',
  false,
  52428800,
  array['model/stl', 'application/sla', 'application/octet-stream']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Владелец видит свои модели:
--      select id, service, stl_url, is_public, created_at
--        from public.generations where user_id = '<USER_ID>';
--
-- 2) Публичная лента без входа (роль anon):
--      select id, created_at from public.generations
--       where is_public and stl_url is not null;
--
-- 3) Чужая приватная модель не открывается ни в одном списке:
--      select id from public.generations
--       where id = '<GENERATION_ID>' and user_id <> '<USER_ID>';
--    — вернёт пусто; роут скачивания отвечает 404.
--
-- 4) Бакет закрыт:
--      select id, public from storage.buckets where id = 'generated-models';
--    — `public = false`, файлы отдаются только подписанной ссылкой.
-- =============================================================================

