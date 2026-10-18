-- =============================================================================
-- Форум сообщества: категории, темы, ответы и изолированные баны
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную в Supabase Dashboard →
-- SQL Editor. Автоматически не выполняется — как и остальные файлы в supabase/.
--
-- Модель доступа:
--   1. Читать форум может кто угодно, но только ОДОБРЕННЫЕ темы и ответы.
--      Автор дополнительно видит свои темы/ответы на модерации — это нужно
--      странице создания, чтобы не терять только что отправленный текст.
--   2. Создавать темы и ответы может только авторизованный пользователь.
--      RLS принудительно ставит author_id = auth.uid() и status = 'pending':
--      подменить автора или сразу опубликовать материал нельзя даже прямым
--      запросом к PostgREST.
--   3. Менять статусы и выдавать баны может только service_role (админ-панель).
--   4. forum_bans — отдельная таблица. Она НЕ связана с subscriptions и
--      purchases: бан на форуме не должен закрывать курсы или подписку Pro.
--
-- Проверить после применения:
--   select slug, title, "order" from public.forum_categories order by "order";
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name like 'forum_%';
--   select tablename, policyname, cmd, roles
--     from pg_policies where schemaname = 'public' and tablename like 'forum_%';
-- =============================================================================

-- 1. Категории форума ---------------------------------------------------------
-- "order" — зарезервированное слово PostgreSQL, поэтому в SQL оно в кавычках.
-- В TypeScript поле читается как обычное свойство order.
create table if not exists public.forum_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  "order" integer not null default 0
);

-- 2. Темы --------------------------------------------------------------------
create table if not exists public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.forum_categories (id) on delete restrict,
  slug text not null unique,
  title text not null check (char_length(title) between 3 and 180),
  content text not null check (char_length(content) between 1 and 20000),
  author_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  views integer not null default 0 check (views >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected'))
);

-- 3. Ответы ------------------------------------------------------------------
create table if not exists public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 20000),
  author_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected'))
);

-- 4. Баны --------------------------------------------------------------------
-- expires_at = null — бессрочный бан. Запись действует, пока expires_at пуст
-- или лежит в будущем. Причина показывается пользователю в красной плашке.
create table if not exists public.forum_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null default 'Нарушение правил форума',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- 5. Индексы -----------------------------------------------------------------
create index if not exists forum_threads_status_created_idx
  on public.forum_threads (status, created_at desc);

create index if not exists forum_threads_category_status_idx
  on public.forum_threads (category_id, status, created_at desc);

create index if not exists forum_threads_author_idx
  on public.forum_threads (author_id);

create index if not exists forum_bans_user_expires_idx
  on public.forum_bans (user_id, expires_at);

create index if not exists forum_replies_thread_status_idx
  on public.forum_replies (thread_id, status, created_at);

create index if not exists forum_replies_author_idx
  on public.forum_replies (author_id);

-- 6. Права доступа -----------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select on public.forum_categories to anon, authenticated;
grant select on public.forum_threads to anon, authenticated;
grant select on public.forum_replies to anon, authenticated;
grant insert on public.forum_threads to authenticated;
grant insert on public.forum_replies to authenticated;
grant select on public.forum_bans to authenticated;

grant all on public.forum_categories to service_role;
grant all on public.forum_threads to service_role;
grant all on public.forum_replies to service_role;
grant all on public.forum_bans to service_role;

-- 7. Row Level Security ------------------------------------------------------
alter table public.forum_categories enable row level security;
alter table public.forum_threads enable row level security;
alter table public.forum_replies enable row level security;
alter table public.forum_bans enable row level security;

-- Категории видны всем.
drop policy if exists "forum_categories_select_all" on public.forum_categories;
create policy "forum_categories_select_all" on public.forum_categories
  for select to anon, authenticated using (true);

-- Темы: публично только approved. Автор видит свои любые — это не открывает
-- чужие pending-темы и не даёт им попасть в поиск.
drop policy if exists "forum_threads_select_approved" on public.forum_threads;
create policy "forum_threads_select_approved" on public.forum_threads
  for select to anon, authenticated using (status = 'approved');

drop policy if exists "forum_threads_select_own" on public.forum_threads;
create policy "forum_threads_select_own" on public.forum_threads
  for select to authenticated using (author_id = auth.uid());

-- Создание темы: только от своего имени и только на модерацию.
drop policy if exists "forum_threads_insert_own_pending" on public.forum_threads;
create policy "forum_threads_insert_own_pending" on public.forum_threads
  for insert to authenticated
  with check (author_id = auth.uid() and status = 'pending');

-- Ответы: та же схема, что у тем.
drop policy if exists "forum_replies_select_approved" on public.forum_replies;
create policy "forum_replies_select_approved" on public.forum_replies
  for select to anon, authenticated using (status = 'approved');

drop policy if exists "forum_replies_select_own" on public.forum_replies;
create policy "forum_replies_select_own" on public.forum_replies
  for select to authenticated using (author_id = auth.uid());

drop policy if exists "forum_replies_insert_own_pending" on public.forum_replies;
create policy "forum_replies_insert_own_pending" on public.forum_replies
  for insert to authenticated
  with check (author_id = auth.uid() and status = 'pending');

-- Баны: пользователь видит только свой бан. Создавать и снимать их может
-- service_role из админ-панели; политик insert/update/delete для пользователей
-- намеренно нет.
drop policy if exists "forum_bans_select_own" on public.forum_bans;
create policy "forum_bans_select_own" on public.forum_bans
  for select to authenticated using (user_id = auth.uid());

-- 8. Публичные имена авторов ------------------------------------------------
-- profiles закрыта RLS: чужое имя из неё не прочитать. Для форума нужна только
-- пара id → имя, без email и других полей. Представление выполняется от
-- владельца схемы (postgres), поэтому обходит RLS profiles, но отдаёт только
-- display_name. Если имени нет, показываем нейтральное «Участник».
create or replace view public.forum_authors
with (security_invoker = false)
as
select
  p.id,
  coalesce(nullif(btrim(p.name), ''), 'Участник') as display_name
from public.profiles p;

revoke all on public.forum_authors from public;
grant select on public.forum_authors to anon, authenticated, service_role;

-- 9. Категории ---------------------------------------------------------------
-- Структура готова, наполнение добавляется отдельно: категории зависят от
-- контента проекта и не должны «зашиваться» в миграцию. Пример:
--
--   insert into public.forum_categories (slug, title, description, "order")
--   values ('general', 'Общее', 'Разговоры на свободные темы', 1)
--   on conflict (slug) do update
--   set title = excluded.title,
--       description = excluded.description,
--       "order" = excluded."order";
--
-- Пока категорий нет, страница форума показывает пустое состояние, а форма
-- создания темы сообщает, что разделы ещё не настроены.

-- PostgREST кэширует схему. После создания таблиц и представления просим
-- перечитать её, иначе API ещё некоторое время будет отвечать PGRST205.
notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Категории:
--      select slug, title, "order" from public.forum_categories order by "order";
--
-- 2) Гость видит только approved:
--      curl "<SUPABASE_URL>/rest/v1/forum_threads?select=title,status" \
--        -H "apikey: <ANON_KEY>"
--
-- 3) Автор видит свою pending-тему, чужую — нет (подставьте JWT пользователя):
--      curl "<SUPABASE_URL>/rest/v1/forum_threads?select=title,status" \
--        -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <USER_JWT>"
--
-- 4) Прямая попытка опубликовать тему (status=approved) должна упасть:
--      insert into public.forum_threads (category_id, slug, title, content, author_id, status)
--      values ('<CATEGORY_ID>', 'test', 'Тест', 'Текст', '<USER_ID>', 'approved');
--      -- new row violates row-level security policy
--
-- 5) Бан не влияет на курсы: проверка доступа к уроку идёт по purchases /
--    subscriptions и таблицу forum_bans не читает вообще.
-- =============================================================================
