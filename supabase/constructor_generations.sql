-- =============================================================================
-- Журнал успешных генераций STL в Конструкторе (аналитика)
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную в Supabase Dashboard →
-- SQL Editor. Автоматически не выполняется — как и остальные файлы в supabase/.
--
-- Зачем таблица:
--   1. ежедневный отчёт показывает, сколько моделей сгенерировано за сутки и с
--      начала месяца, с разбивкой по типам (вазы, брелоки и т.д.);
--   2. пишется каждая успешная выдача STL — и Free, и Pro. В отличие от
--      constructor_downloads это не лимит, а журнал: Pro-записи не блокируют
--      пользователя после окончания подписки;
--   3. ошибка записи не мешает отдать файл: аналитика не должна ломать экспорт.
--
-- Модель доступа: как у site_visits — только service_role. Клиентским ролям
-- таблица не нужна, персональных данных в ней нет (user_id нужен лишь для
-- возможной сверки и обезличивается при удалении аккаунта).
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'constructor_generations';
-- =============================================================================

create table if not exists public.constructor_generations (
  id uuid primary key default gen_random_uuid(),
  -- on delete set null: удаление аккаунта не должно стирать историю генераций.
  user_id uuid references auth.users (id) on delete set null,
  -- Ключ модели из lib/constructor/params.ts: vase, keychain, box и т.д.
  model_type text not null check (char_length(model_type) between 1 and 64),
  created_at timestamptz not null default now()
);

comment on table public.constructor_generations is
  'Успешные генерации STL: тип модели и время. Источник разбивки в ежедневном отчёте.';

-- Отчёт читает окно «24 часа» и «с начала месяца», иногда с группировкой.
create index if not exists constructor_generations_created_idx
  on public.constructor_generations (created_at desc);
create index if not exists constructor_generations_model_created_idx
  on public.constructor_generations (model_type, created_at desc);

alter table public.constructor_generations enable row level security;

-- Политик нет: журнал ведёт и читает только service_role (он обходит RLS).
revoke all on public.constructor_generations from anon, authenticated;
grant all on public.constructor_generations to service_role;

notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Генерации по моделям за сутки:
--      select model_type, count(*) as generated
--        from public.constructor_generations
--       where created_at >= now() - interval '24 hours'
--       group by model_type
--       order by generated desc;
--
-- 2) Те же цифры за текущий месяц:
--      select model_type, count(*) as generated
--        from public.constructor_generations
--       where created_at >= date_trunc('month', now())
--       group by model_type
--       order by generated desc;
-- =============================================================================
