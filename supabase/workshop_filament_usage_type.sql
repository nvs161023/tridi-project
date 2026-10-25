-- =============================================================================
-- Мастерская: тип катушки — складская или заказная
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную: Supabase Dashboard →
-- SQL Editor (или psql/Termius). Автоматически не выполняется — как и остальные
-- файлы в supabase/.
--
-- Порядок применения: после `supabase/workshop_filaments.sql` — колонка
-- добавляется в уже существующую таблицу. Повторный запуск безопасен:
-- `add column if not exists` ничего не меняет, а `notify` лишь сбрасывает кэш.
--
-- Зачем колонка:
--   1. мастер делит пластик на два вида: «Складской» — ходовые цвета, которые
--      докупаются всегда, и «Заказной» — покупается под конкретную задачу;
--   2. тип нужен, чтобы склад показывал, что можно тратить на любые заказы, а
--      что куплено под конкретный и не должно уходить в общий расход;
--   3. тип хранится строкой, а не boolean: значений уже два, и третье
--      («образец», «брак») добавится без переименования колонки.
--
-- Про not null и default 'stock':
--   у всех катушек, созданных до миграции, типа нет, а склад пополнялся
--   заранее — значит, они складские. Придумывать иное значение нельзя, поэтому
--   default 'stock' проставляет его уже существующим строкам и всем вставкам
--   без явного типа. Форма «Добавить катушку» сможет выбрать значение сама.
--
-- Значения повторяют те, что появятся в lib/workshop/filaments.ts на следующем
-- шаге, чтобы форма и база не расходились: форма не даст отправить неизвестный
-- тип, а база не пропустит запрос в обход формы.
--
-- Проверить после применения:
--   select column_name, data_type, column_default, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'workshop_filaments'
--      and column_name = 'usage_type';
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'public.workshop_filaments'::regclass
--      and conname = 'workshop_filaments_usage_type_check';
-- =============================================================================

alter table public.workshop_filaments
  add column if not exists usage_type text not null default 'stock'
    check (usage_type in ('stock', 'ordered'));

comment on column public.workshop_filaments.usage_type is
  'Тип катушки: stock — складской пластик, пополняется всегда; ordered — заказной, покупается под конкретную задачу.';

-- PostgREST кэширует схему: без перечитывания API ещё некоторое время не видит
-- новую колонку и отвечает PGRST204.
notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Колонка и значение по умолчанию:
--      select column_name, data_type, column_default, is_nullable
--        from information_schema.columns
--       where table_schema = 'public' and table_name = 'workshop_filaments'
--         and column_name = 'usage_type';
--    Ожидается: usage_type | text | 'stock'::text | NO.
--
-- 2) Все существующие катушки стали складскими:
--      select id, brand, type, color, remaining_weight_g, usage_type
--        from public.workshop_filaments
--       where user_id = '<USER_ID>'
--       order by created_at;
--
-- 3) Неизвестный тип отклоняется ограничением:
--      update public.workshop_filaments set usage_type = 'free'
--       where id = '<FILAMENT_ID>' and user_id = '<USER_ID>';
--    Ожидается ошибка violates check constraint
--    "workshop_filaments_usage_type_check".
--
-- 4) Заказная катушка сохраняется:
--      update public.workshop_filaments set usage_type = 'ordered'
--       where id = '<FILAMENT_ID>' and user_id = '<USER_ID>';
-- =============================================================================
