-- =============================================================================
-- Категория модели в истории генераций 3D по фото
-- =============================================================================
-- Зачем колонка:
--   1. генератор спрашивает категорию ещё до отправки фото, и она приходит в
--      теле `/api/generate-3d` вместе с `quality` и `isPublic`;
--   2. строка истории создаётся там же (`rememberGenerationTask`), поэтому
--      категория сохраняется сразу вместе с задачей, а не догоняет модель;
--   3. галерея фильтрует ленту по `category`, а «Мои модели» позволяют
--      поменять её, если пользователь ошибся при выборе.
--
-- Значения: toy (игрушки), figure (фигурки), decor (декор), functional
-- (функциональные детали) и other — по умолчанию, чтобы строки, созданные до
-- миграции и старым клиентом, не остались без категории.
--
-- Применение: Supabase Dashboard → SQL Editor (как и остальные файлы
-- в supabase/). Повторный запуск безопасен: колонка и индекс создаются через
-- `if not exists`, а ограничение проверяется по каталогу.
--
-- Проверить после применения:
--   select column_name, data_type, column_default, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'generations'
--      and column_name = 'category';
--   select indexname, indexdef from pg_indexes
--    where schemaname = 'public' and tablename = 'generations'
--      and indexname = 'generations_category_created_idx';
-- =============================================================================

alter table public.generations
  add column if not exists category text not null default 'other';

comment on column public.generations.category is
  'Категория модели: toy, figure, decor, functional или other. Фильтр галереи и подпись на карточке.';

-- Ограничение ставим отдельно: у `add constraint` нет `if not exists`, а
-- повторный запуск файла не должен падать.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.generations'::regclass
       and conname = 'generations_category_check'
  ) then
    alter table public.generations
      add constraint generations_category_check
      check (category in ('toy', 'figure', 'decor', 'functional', 'other'));
  end if;
end
$$;

-- Фильтр не должен перебирать всю таблицу: индекс начинается с категории, а
-- `created_at` внутри категории совпадает с порядком ленты — сортировка тоже
-- идёт по индексу.
create index if not exists generations_category_created_idx
  on public.generations (category, created_at desc);

-- PostgREST кэширует схему: без перечитывания API ещё некоторое время отвечает
-- PGRST204 на новую колонку.
notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Колонка есть и заполнена у старых строк:
--      select category, count(*) from public.generations group by 1;
--
-- 2) Фильтр галереи отдаёт только свою категорию:
--      select id, category from public.generations
--       where is_public and stl_url is not null and category = 'toy';
-- =============================================================================
