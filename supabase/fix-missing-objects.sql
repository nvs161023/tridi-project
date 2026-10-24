-- =============================================================================
-- Ремонтная миграция: объекты, которых не хватало в рабочей базе
-- =============================================================================
-- Зачем отдельный файл. `site_visits.sql` и `course_reviews.sql` описывают свои
-- разделы целиком, и на живой базе их повторный запуск падал: политики
-- `course_reviews_select_public` и `course_reviews_insert_own` уже существуют, а
-- `create policy` не умеет `if not exists`. Здесь ровно то, что нужно донести до
-- базы, — таблица `site_visits` и представление `course_review_authors`, — и все
-- операторы идемпотентны: файл можно запускать сколько угодно раз, на пустой
-- базе и на базе, где половина объектов уже есть.
--
-- Применять вручную: Supabase Dashboard → SQL Editor (или psql/Termius).
-- Ничего не удаляет и не меняет данные: только `create ... if not exists`,
-- `create or replace view`, `drop policy if exists` + `create policy`, гранты.
--
-- Что чинится:
--   1. `public.site_visits` — обезличенный счётчик просмотров для ежедневного
--      отчёта `/api/cron/daily-report`. Без таблицы отчёт отвечал 404 (PGRST205).
--   2. `public.course_review_authors` — имена авторов отзывов для страницы
--      «Центр выпускника». Без представления чтение отзывов падало 404.
--
-- Проверить после применения (все три запроса должны вернуть строки):
--   select to_regclass('public.site_visits') as site_visits,
--          to_regclass('public.course_review_authors') as review_authors,
--          to_regclass('public.course_reviews') as course_reviews;
--   select tablename, policyname, cmd, roles
--     from pg_policies
--    where schemaname = 'public' and tablename in ('site_visits', 'course_reviews');
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name in ('site_visits', 'course_reviews')
--    order by table_name, ordinal_position;
-- =============================================================================

-- 1. Посещения публичных страниц ---------------------------------------------
-- Модель доступа: таблица закрыта полностью. `anon` и `authenticated` не имеют
-- ни одного гранта, RLS включён без политик; пишет и читает только service_role.
create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  -- Путь без query-строки: /, /tools, /forum/kak-pechat-vazy.
  path text not null check (char_length(path) between 1 and 512),
  created_at timestamptz not null default now()
);

comment on table public.site_visits is
  'Обезличенные просмотры публичных страниц: только путь и время, без IP и user_id.';

-- Отчёт считает два окна: последние 24 часа и с начала месяца.
create index if not exists site_visits_created_idx
  on public.site_visits (created_at desc);

alter table public.site_visits enable row level security;

revoke all on public.site_visits from anon, authenticated;
grant all on public.site_visits to service_role;


-- 2. Отзывы о курсах: таблица и политики -------------------------------------
-- На рабочей базе таблица уже есть; блок оставлен, чтобы файл работал и на
-- чистой базе. Политики пересоздаются через `drop policy if exists` — это и
-- есть причина, по которой полный `course_reviews.sql` нельзя было запустить
-- повторно.
create table if not exists public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id text not null
    check (course_id in ('basic', 'confident', 'engineer', 'profit')),
  user_id uuid not null references auth.users (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  text text not null check (char_length(text) between 10 and 1000),
  created_at timestamptz not null default now(),
  constraint course_reviews_one_per_course unique (user_id, course_id)
);

create index if not exists course_reviews_course_created_idx
  on public.course_reviews (course_id, created_at desc);

-- Старая версия миграции держала текст в колонке body.
do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'course_reviews'
       and column_name = 'body'
  ) and not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'course_reviews'
       and column_name = 'text'
  ) then
    alter table public.course_reviews rename column body to text;
  end if;
end
$$;

alter table public.course_reviews enable row level security;

drop policy if exists "course_reviews_select_public" on public.course_reviews;
create policy "course_reviews_select_public" on public.course_reviews
  for select to anon, authenticated using (true);

drop policy if exists "course_reviews_insert_own" on public.course_reviews;
create policy "course_reviews_insert_own" on public.course_reviews
  for insert to authenticated
  with check (user_id = auth.uid());

revoke all on public.course_reviews from anon, authenticated;
grant select on public.course_reviews to anon, authenticated;
grant insert on public.course_reviews to authenticated;
grant all on public.course_reviews to service_role;

-- 3. Публичные имена авторов отзывов -----------------------------------------
-- `profiles` закрыта RLS, поэтому представление выполняется от владельца схемы
-- (security_invoker = false) и отдаёт только пару user_id → display_name.
-- `create or replace` работает и когда представления нет, и когда оно есть.
create or replace view public.course_review_authors
with (security_invoker = false)
as
select
  p.id,
  coalesce(nullif(btrim(p.name), ''), 'Ученик TriDi') as display_name
from public.profiles p;

revoke all on public.course_review_authors from public;
grant select on public.course_review_authors to anon, authenticated, service_role;

-- PostgREST кэширует схему: без этого API ещё некоторое время отвечает
-- PGRST205 на новые таблицу и представление.
notify pgrst, 'reload schema';
