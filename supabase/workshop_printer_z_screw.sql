-- =============================================================================
-- Мастерская: смазка винта Z у принтеров
-- =============================================================================
-- Обновление для базы, где `workshop_printers` уже создана по
-- `supabase/workshop_printers_orders.sql` до появления винта Z. Применяется
-- вручную: Supabase Dashboard → SQL Editor (или psql/Termius).
--
-- Новым базам этот файл не нужен: колонки уже есть в create table базовой
-- миграции. Здесь `if not exists`, поэтому повторный запуск безопасен.
--
-- Зачем:
--   z_screw_hours    — наработка с последней смазки винта Z; её прибавляет
--                      создание заказа и обнуляет кнопка «Смазать винт Z».
--   z_screw_interval — интервал смазки из справочника PRINTER_PRESETS:
--                      720 ч у большинства моделей, 500 у Prusa, 1000 у Voron.
--                      Ноль не допускается: на интервал делят процент износа,
--                      а винт Z есть у всех моделей справочника.
--
-- Пределы повторяют lib/workshop/printers.ts (PRINTER_INTERVAL_LIMITS,
-- PRINTER_HOURS_MAX), чтобы форма и база не расходились.
-- =============================================================================

alter table public.workshop_printers
  add column if not exists z_screw_hours numeric(12, 2) not null default 0
    check (z_screw_hours >= 0 and z_screw_hours <= 1000000),
  add column if not exists z_screw_interval integer not null default 720
    check (z_screw_interval between 1 and 10000);

comment on column public.workshop_printers.z_screw_hours is
  'Наработка винта Z с последней смазки, ч; сбрасывается кнопкой «Смазать винт Z».';
comment on column public.workshop_printers.z_screw_interval is
  'Интервал смазки винта Z, ч (1…10 000; по умолчанию 720).';

-- PostgREST кэширует схему: без перечитывания API ещё некоторое время не
-- увидит новые колонки.
notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить после применения
-- =============================================================================
-- 1) Колонки и значения по умолчанию:
--      select column_name, data_type, column_default, is_nullable
--        from information_schema.columns
--       where table_schema = 'public'
--         and table_name = 'workshop_printers'
--         and column_name in ('z_screw_hours', 'z_screw_interval')
--       order by column_name;
--    Ожидается numeric(12,2) default 0 и integer default 720, both not null.
--
-- 2) Существующие принтеры получили 0 ч и интервал 720 ч:
--      select id, name, z_screw_hours, z_screw_interval
--        from public.workshop_printers
--       where user_id = '<USER_ID>'
--       order by created_at;
--
-- 3) После заказа на 2,5 ч наработка винта выросла на 2,5:
--      select z_screw_hours from public.workshop_printers
--       where id = '<PRINTER_ID>';
--
-- 4) Сброс кнопкой «Смазать винт Z»:
--      update public.workshop_printers
--         set z_screw_hours = 0, last_maintenance_date = current_date
--       where id = '<PRINTER_ID>' and user_id = '<USER_ID>';
-- =============================================================================
