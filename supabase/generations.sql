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
--   * владелец читает свои строки при любом флаге публикации;
--   * `is_public = true` дополнительно читает гость — галерея открыта без
--     входа, а скачивание всё равно требует сессию (проверяет роут);
--   * запись и удаление — только свои строки, как у `saved_projects`.
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

-- Гранты: запись в историю делает service_role, переключатель публикации —
-- сам пользователь из Server Action. Гостю хватает чтения публичной ленты.
revoke all on public.generations from anon, authenticated;
grant select on public.generations to anon;
grant select, insert, update, delete on public.generations to authenticated;
grant all on public.generations to service_role;

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

