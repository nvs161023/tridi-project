-- =============================================================================
-- Отзывы о курсах: одна оценка на ученика и курс, публичное чтение
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную в Supabase Dashboard →
-- SQL Editor. Автоматически не выполняется — как и остальные файлы в supabase/.
--
-- Модель доступа:
--   1. Читать отзывы может кто угодно — они показываются выпускникам на
--      странице «Центр выпускника».
--   2. Оставить отзыв может только авторизованный пользователь и только от
--      своего имени: RLS требует user_id = auth.uid(). Ученик не может
--      подписать отзыв другим человеком.
--   3. Один отзыв на курс: повторная отправка возвращает ошибку уникальности.
--      Обновлять и удалять отзывы из браузера нельзя — политик update/delete
--      намеренно нет.
--   4. Имена авторов отдаёт отдельное представление course_review_authors.
--      profiles закрыта RLS, поэтому представление выполняется от владельца
--      схемы и отдаёт только пару user_id → display_name, без email.
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'course_reviews';
--   select tablename, policyname, cmd, roles
--     from pg_policies
--    where schemaname = 'public' and tablename = 'course_reviews';
-- =============================================================================

-- 1. Отзывы ------------------------------------------------------------------
create table if not exists public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id text not null
    check (course_id in ('basic', 'confident', 'engineer', 'profit')),
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 10 and 1000),
  created_at timestamptz not null default now(),
  constraint course_reviews_one_per_course unique (user_id, course_id)
);

-- Свежие отзывы одного курса читаются чаще всего.
create index if not exists course_reviews_course_created_idx
  on public.course_reviews (course_id, created_at desc);

-- 2. RLS ---------------------------------------------------------------------
alter table public.course_reviews enable row level security;

drop policy if exists "course_reviews_select_public" on public.course_reviews;
create policy "course_reviews_select_public" on public.course_reviews
  for select to anon, authenticated using (true);

drop policy if exists "course_reviews_insert_own" on public.course_reviews;
create policy "course_reviews_insert_own" on public.course_reviews
  for insert to authenticated
  with check (user_id = auth.uid());

-- 3. Гранты ------------------------------------------------------------------
-- Supabase выдаёт гранты на новые таблицы автоматически, но явный grant делает
-- миграцию самодостаточной при запуске на чистой базе.
revoke all on public.course_reviews from anon, authenticated;
grant select on public.course_reviews to anon, authenticated;
grant insert on public.course_reviews to authenticated;
grant all on public.course_reviews to service_role;

-- 4. Публичные имена авторов ------------------------------------------------
-- Как forum_authors: только имя, без почты и остальных полей профиля.
create or replace view public.course_review_authors
with (security_invoker = false)
as
select
  p.id,
  coalesce(nullif(btrim(p.name), ''), 'Ученик TriDi') as display_name
from public.profiles p;

revoke all on public.course_review_authors from public;
grant select on public.course_review_authors to anon, authenticated, service_role;

-- PostgREST кэширует схему. После создания таблицы и представления просим
-- перечитать её, иначе API ещё некоторое время будет отвечать PGRST205.
notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Гость видит отзывы, но не может вставить строку:
--      curl "<SUPABASE_URL>/rest/v1/course_reviews?select=course_id,rating,body" \
--        -H "apikey: <ANON_KEY>"
--      -- POST с anon-ключом должен вернуть 401 / row-level security.
--
-- 2) Вошедший видит имена авторов:
--      curl "<SUPABASE_URL>/rest/v1/course_review_authors?select=display_name" \
--        -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <USER_JWT>"
--
-- 3) Второй отзыв по тому же курсу должен упасть с кодом 23505:
--      insert into public.course_reviews (course_id, user_id, rating, body)
--      values ('basic', '<USER_ID>', 5, 'Повторный отзыв по тому же курсу');
-- =============================================================================
