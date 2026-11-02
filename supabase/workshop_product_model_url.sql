-- =============================================================================
-- Мастерская: исходник модели (STL) отдельно от файла печати
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную: Supabase Dashboard →
-- SQL Editor (или psql/Termius). Автоматически не выполняется — как и остальные
-- файлы в supabase/.
--
-- Порядок применения:
--   1. supabase/workshop_products.sql — таблица workshop_products;
--   2. supabase/workshop_farm_and_shop.sql — колонки gcode_url и
--      sliced_for_printer;
--   3. этот файл (повторный запуск безопасен).
-- Если workshop_products ещё нет, alter table упадёт с ошибкой 42P01: сначала
-- примените миграции выше.
--
-- Зачем колонка:
--   1. у товара два разных файла: исходник (STL) нужен, чтобы нарезать изделие
--      заново под другой принтер, а файл печати (3MF или G-code) уходит агенту
--      фермы. Одна колонка `gcode_url` смешивала их, и STL ломал очередь печати:
--      агенту нечего отправлять на принтер;
--   2. пустая строка запрещена: «исходника нет» — это null, как и у gcode_url;
--   3. старые ссылки переносятся: до разделения файлов STL прикладывали в
--      `gcode_url`, поэтому такие значения уезжают в `model_url`, а `gcode_url`
--      обнуляется. Повторный запуск ничего не меняет.
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'workshop_products'
--      and column_name = 'model_url';
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'public.workshop_products'::regclass
--      and conname = 'workshop_products_model_url_check';
-- =============================================================================

-- model_url — ссылка на исходник модели (Supabase Storage, локальный сервер или
-- https-хранилище). Пустая строка запрещена: «нет исходника» — это null.
alter table public.workshop_products
  add column if not exists model_url text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.workshop_products'::regclass
       and conname = 'workshop_products_model_url_check'
  ) then
    alter table public.workshop_products
      add constraint workshop_products_model_url_check
      check (
        model_url is null
        or char_length(btrim(model_url)) between 1 and 2048
      );
  end if;
end;
$$;

comment on column public.workshop_products.model_url is
  'Ссылка на исходник модели (STL) для повторной нарезки; null — исходника нет.';

-- Перенос старых значений: STL из gcode_url становится исходником, а файл
-- печати остаётся пустым. `coalesce` нужен на случай, когда model_url уже
-- заполнен: тогда ссылка на файл печати всё равно очищается, но исходник,
-- выбранный мастером, не затирается. Условие по расширению делает повторный
-- запуск безопасным: после переноса gcode_url равен null, и строка не находится.
update public.workshop_products
   set model_url = coalesce(model_url, btrim(gcode_url)),
       gcode_url = null
 where gcode_url is not null
   and gcode_url ~* '\.stl([?#].*)?$';

-- PostgREST кэширует схему: без перечитывания API ещё некоторое время не видит
-- новую колонку и отвечает PGRST204.
notify pgrst, 'reload schema';
