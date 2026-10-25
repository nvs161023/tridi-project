-- =============================================================================
-- Мастерская: каталог товаров
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную: Supabase Dashboard →
-- SQL Editor (или psql/Termius). Автоматически не выполняется — как и остальные
-- файлы в supabase/.
--
-- Порядок применения:
--   1. supabase/workshop_settings.sql
--   2. supabase/workshop_filaments.sql
--   3. supabase/workshop_printers_orders.sql
--   4. этот файл
-- Если workshop_orders ещё нет, alter table упадёт с ошибкой 42P01: сначала
-- примените базовую миграцию Мастерской.
--
-- Зачем таблица:
--   1. каталог хранит карточки товаров мастера: артикул, название, описание,
--      цену, старую цену для скидки, характеристики и штрихкод;
--   2. артикул уникален в пределах одного пользователя: у разных мастеров
--      один и тот же SKU допустим;
--   3. заказ может ссылаться на товар каталога через product_id. Удаление
--      товара не стирает заказ, а обнуляет ссылку (on delete set null).
--
-- Цена и старая цена — numeric(10, 2), как стоимость заказа. Старая цена
-- необязательна: null означает, что скидки нет.
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name in ('workshop_products', 'workshop_orders')
--    order by table_name, ordinal_position;
--   select indexname, indexdef
--     from pg_indexes
--    where schemaname = 'public' and tablename = 'workshop_products';
--   select tablename, policyname, cmd, roles
--     from pg_policies
--    where schemaname = 'public' and tablename = 'workshop_products'
--    order by policyname;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Каталог товаров
-- -----------------------------------------------------------------------------

create table if not exists public.workshop_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Артикул продавца хранится как есть, без обрезки: уникальность ниже
  -- считается по точному значению sku.
  sku text not null,
  title text not null,
  description text,
  price numeric(10, 2) not null default 0
    check (price >= 0),
  -- Старая цена нужна только для зачёркнутой цены; null — скидки нет.
  old_price numeric(10, 2)
    check (old_price is null or old_price >= 0),
  brand text,
  color text,
  size text,
  weight_g integer,
  length_mm integer,
  width_mm integer,
  height_mm integer,
  barcode text,
  category text,
  created_at timestamptz not null default now()
);

comment on table public.workshop_products is
  'Мастерская: каталог товаров пользователя с ценами и характеристиками.';
comment on column public.workshop_products.sku is
  'Артикул продавца; уникален в пределах user_id.';
comment on column public.workshop_products.price is
  'Текущая цена товара, ₽ (по умолчанию 0).';
comment on column public.workshop_products.old_price is
  'Старая цена для скидки, ₽; null — скидки нет.';
comment on column public.workshop_products.weight_g is
  'Вес товара в граммах; null — не указан.';
comment on column public.workshop_products.length_mm is
  'Длина в миллиметрах; null — не указана.';
comment on column public.workshop_products.width_mm is
  'Ширина в миллиметрах; null — не указана.';
comment on column public.workshop_products.height_mm is
  'Высота в миллиметрах; null — не указана.';
comment on column public.workshop_products.created_at is
  'Когда товар добавлен в каталог; по нему сортируется список.';

-- Один SKU не может встречаться дважды у одного пользователя. Уникальный
-- индекс (а не primary key) оставляет id суррогатным ключом карточки.
create unique index if not exists workshop_products_user_sku_uidx
  on public.workshop_products (user_id, sku);

-- RLS: пользователь читает и меняет только свои товары.
alter table public.workshop_products enable row level security;

drop policy if exists "workshop_products_select_own" on public.workshop_products;
create policy "workshop_products_select_own" on public.workshop_products
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "workshop_products_insert_own" on public.workshop_products;
create policy "workshop_products_insert_own" on public.workshop_products
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "workshop_products_update_own" on public.workshop_products;
create policy "workshop_products_update_own" on public.workshop_products
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "workshop_products_delete_own" on public.workshop_products;
create policy "workshop_products_delete_own" on public.workshop_products
  for delete to authenticated using (auth.uid() = user_id);

-- Гранты: Supabase выдаёт их автоматически, но явный grant делает миграцию
-- самодостаточной на чистой базе. anon не получает доступ к каталогу.
revoke all on public.workshop_products from anon, authenticated;
grant select, insert, update, delete on public.workshop_products to authenticated;
grant all on public.workshop_products to service_role;

-- -----------------------------------------------------------------------------
-- 2. Связь заказа с товаром
-- -----------------------------------------------------------------------------

-- Существующие заказы получают product_id = null: товар у них ещё не выбран.
-- Повторный запуск безопасен: if not exists пропустит готовую колонку.
alter table public.workshop_orders
  add column if not exists product_id uuid
    references public.workshop_products (id) on delete set null;

comment on column public.workshop_orders.product_id is
  'Товар каталога, из которого создан заказ; null — заказ без товара или товар удалён.';

-- PostgREST кэширует схему: без перечитывания API ещё некоторое время отвечает
-- PGRST205 на новую таблицу и не видит product_id.
notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Структура и уникальный индекс:
--      select column_name, data_type, is_nullable, column_default
--        from information_schema.columns
--       where table_schema = 'public' and table_name = 'workshop_products'
--       order by ordinal_position;
--      select indexname, indexdef
--        from pg_indexes
--       where schemaname = 'public' and tablename = 'workshop_products';
--
-- 2) Внешний ключ заказа на товар:
--      select conname, pg_get_constraintdef(oid)
--        from pg_constraint
--       where conrelid = 'public.workshop_orders'::regclass
--         and contype = 'f';
--
-- 3) Пользователь видит только свои товары:
--      select id, sku, title, price, old_price, category, created_at
--        from public.workshop_products
--       where user_id = '<USER_ID>'
--       order by created_at desc;
--
-- 4) Повторный SKU у того же пользователя отклоняется:
--      insert into public.workshop_products (user_id, sku, title)
--      values ('<USER_ID>', '<SKU>', '<TITLE>');
--    Ожидается ошибка duplicate key value violates unique constraint
--    "workshop_products_user_sku_uidx".
--
-- 5) Удаление товара обнуляет ссылку в заказе, но не удаляет заказ:
--      delete from public.workshop_products
--       where id = '<PRODUCT_ID>' and user_id = '<USER_ID>';
--      select id, title, product_id from public.workshop_orders
--       where id = '<ORDER_ID>';
-- =============================================================================
