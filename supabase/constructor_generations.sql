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
-- сверки). Строка принадлежит аккаунту: при его удалении генерации уходят
-- вместе с ним (on delete cascade), обезличенного хвоста не остаётся.
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'constructor_generations';
--   select conname, confdeltype
--     from pg_constraint
--    where conrelid = 'public.constructor_generations'::regclass
--      and contype = 'f';   -- ожидается c: генерации уходят вместе с аккаунтом
-- =============================================================================

create table if not exists public.constructor_generations (
  id uuid primary key default gen_random_uuid(),
  -- on delete cascade: генерация принадлежит аккаунту и уходит вместе с ним,
  -- обезличенной истории не остаётся. `not null` повторяет живую базу.
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Ключ модели из lib/constructor/params.ts: vase, keychain, box и т.д.
  model_type text not null check (char_length(model_type) between 1 and 64),
  created_at timestamptz not null default now()
);

comment on table public.constructor_generations is
  'Успешные генерации STL: тип модели и время. Источник разбивки в ежедневном отчёте.';

-- Синхронизация с базой, созданной до этого файла: колонка user_id там уже
-- `not null`, а ключ мог остаться с прежним правилом. Повторный запуск
-- безопасен: ограничение снимается через `if exists` и создаётся заново.
-- `set not null` требует, чтобы строк без user_id не было; писать их некому —
-- /api/constructor/stl без сессии отвечает 401, и запись всегда идёт с user.id.
alter table public.constructor_generations
  alter column user_id set not null;

alter table public.constructor_generations
  drop constraint if exists constructor_generations_user_id_fkey;

alter table public.constructor_generations
  add constraint constructor_generations_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

-- Подробности генерации: у вазы — силуэт, узор и деформации, по которым видно,
-- какие формы реально скачивают. Колонка необязательная: приложение пишет её,
-- только когда модели есть что записать, и повторяет запись без подробностей,
-- пока этот SQL не применён в живой базе.
alter table public.constructor_generations
  add column if not exists details jsonb;

comment on column public.constructor_generations.details is
  'Параметры модели на момент генерации; у вазы — shape, pattern, twistDeg, flutes, fluteDepthMm, sectionSides, organic, leanDeg, vaseSeed.';

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
--
-- 3) Какие формы вазы качают за месяц:
--      select details->>'shape' as shape,
--             details->>'pattern' as pattern,
--             count(*) as generated
--        from public.constructor_generations
--       where model_type = 'vase'
--         and created_at >= date_trunc('month', now())
--       group by 1, 2
--       order by generated desc;
--
-- 4) Насколько часто включают деформации (0 в details — не включали):
--      select details->>'twistDeg' as twist,
--             details->>'flutes' as flutes,
--             details->>'organic' as organic,
--             count(*) as generated
--        from public.constructor_generations
--       where model_type = 'vase'
--       group by 1, 2, 3
--       order by generated desc;
--
-- 5) Правило удаления ключа: confdeltype = 'c' — строки уходят вместе с
--    аккаунтом, 'n' — история остаётся обезличенной:
--      select conname, confdeltype
--        from pg_constraint
--       where conrelid = 'public.constructor_generations'::regclass
--         and contype = 'f';
-- =============================================================================
