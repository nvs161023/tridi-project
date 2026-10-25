-- =============================================================================
-- Мастерская: связь заказа с клиентом из базы
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную: Supabase Dashboard →
-- SQL Editor (или psql/Termius). Автоматически не выполняется — как и остальные
-- файлы в supabase/.
--
-- Порядок применения:
--   1. supabase/workshop_printers_orders.sql — таблица workshop_orders;
--   2. supabase/workshop_clients.sql — таблица workshop_clients;
--   3. этот файл.
-- Если workshop_clients ещё нет, alter table упадёт с ошибкой 42P01: сначала
-- примените базу клиентов.
--
-- Зачем колонка:
--   1. заказ, созданный с выбранным клиентом из базы, хранит ссылку на него;
--   2. накладная берёт из workshop_clients телефон и адрес доставки;
--   3. старые заказы и заказы с клиентом, введённым вручную, получают null —
--      накладная оставляет поля «[ ]» для заполнения при отгрузке;
--   4. удаление клиента не стирает заказ: on delete set null обнуляет ссылку,
--      а client_name остаётся снимком имени на момент заказа.
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'workshop_orders'
--      and column_name = 'client_id';
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'public.workshop_orders'::regclass
--      and conname = 'workshop_orders_client_id_fkey';
-- =============================================================================

alter table public.workshop_orders
  add column if not exists client_id uuid
    references public.workshop_clients (id) on delete set null;

comment on column public.workshop_orders.client_id is
  'Клиент из базы; null — заказ без ссылки (старый заказ или ручной ввод).';

-- PostgREST кэширует схему: без перечитывания API ещё некоторое время не видит
-- новую колонку и отвечает PGRST204.
notify pgrst, 'reload schema';
