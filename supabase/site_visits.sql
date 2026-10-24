-- =============================================================================
-- Посещения публичных страниц (обезличенная статистика)
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную в Supabase Dashboard →
-- SQL Editor. Автоматически не выполняется — как и остальные файлы в supabase/.
--
-- Зачем таблица:
--   1. ежедневный отчёт (/api/cron/daily-report) показывает трафик за сутки и
--      с начала месяца;
--   2. хранится только путь страницы и время — ни IP, ни cookies, ни user_id:
--      это счётчик просмотров, а не профилирование посетителей;
--   3. запись делает middleware service-role ключом, поэтому RLS-политик для
--      клиентских ролей нет вовсе.
--
-- Модель доступа: таблица закрыта полностью. `anon` и `authenticated` не имеют
-- ни одного гранта, а включённый RLS без политик не отдаёт им строки даже при
-- случайно выданном праве. `service_role` обходит RLS — он и пишет, и читает.
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'site_visits';
--   select tablename, policyname, cmd, roles
--     from pg_policies
--    where schemaname = 'public' and tablename = 'site_visits';
-- =============================================================================

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

-- Политик нет: читать и писать может только service_role (он обходит RLS).
revoke all on public.site_visits from anon, authenticated;
grant all on public.site_visits to service_role;

-- PostgREST кэширует схему: после создания таблицы просим перечитать её,
-- иначе API ещё некоторое время будет отвечать PGRST205.
notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Гость не видит строк (0 строк или ошибка прав):
--      curl "<SUPABASE_URL>/rest/v1/site_visits?select=path" \
--        -H "apikey: <ANON_KEY>"
--
-- 2) service_role видит и пишет:
--      curl "<SUPABASE_URL>/rest/v1/site_visits?select=path,created_at&limit=5" \
--        -H "apikey: <SERVICE_ROLE_KEY>"
--
-- 3) Трафик за сутки и с начала месяца:
--      select
--        count(*) filter (where created_at >= now() - interval '24 hours') as day,
--        count(*) filter (where created_at >= date_trunc('month', now())) as month
--      from public.site_visits;
-- =============================================================================
