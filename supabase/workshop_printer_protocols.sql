-- =============================================================================
-- Мастерская: восемь протоколов принтеров и секреты протокола
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную: Supabase Dashboard →
-- SQL Editor (или psql/Termius). Автоматически не выполняется — как и остальные
-- файлы в supabase/.
--
-- Порядок применения: после supabase/workshop_farm_and_shop.sql (этот файл
-- расширяет созданные там колонки и пересоздаёт её ограничения). Повторный
-- запуск безопасен: колонка добавляется через `add column if not exists`,
-- ограничения — через `drop constraint if exists` и повторную сборку.
--
-- Что делает файл:
--   1. расширяет справочник протоколов в workshop_printers и
--      workshop_discovered_printers до восьми значений: прежние три
--      (moonraker, octoprint, bambu) плюс prusa, creality, anycubic,
--      flashforge, elegoo. Список — зеркало PRINTER_PROTOCOLS
--      (lib/db/workshop-types.ts) и PROTOCOLS (agent/adapters/registry.py);
--   2. добавляет workshop_printers.printer_secrets jsonb — секреты и параметры
--      протокола, для которых не завели колонку: checkCode FlashForge,
--      логин-пароль и deviceId/modeId Anycubic, mainboardId Elegoo, storage
--      PrusaLink;
--   3. обновляет комментарии колонок и просит PostgREST перечитать схему — без
--      этого новая колонка отвечает PGRST204 «could not find column».
--
-- Почему секреты в jsonb, а не пятью колонками: набор полей у каждого протокола
-- свой (FlashForge — один checkCode, Anycubic — четыре), и каждая новая модель
-- добавляла бы миграцию с пустыми колонками. Общий api_key остаётся отдельной
-- колонкой: он первичный секрет любого протокола и уже заполнен у заведённых
-- принтеров, переносить его в jsonb значило бы ломать работающий агент.
--
-- Про типы значений внутри jsonb: проверяется только форма — объект и размер до
-- 4 КБ. Перечислять ключи в check нельзя: список ключей живёт в registry.py, и
-- новая модель протокола потребовала бы правки базы. Типы значений (только
-- строки) проверяет приложение до записи.
-- =============================================================================

alter table public.workshop_printers
  add column if not exists printer_secrets jsonb;

comment on column public.workshop_printers.printer_secrets is
  'Секреты и параметры протокола без отдельной колонки (jsonb-объект строк): checkCode FlashForge, username/password/deviceId/modeId Anycubic, mainboardId Elegoo, storage PrusaLink. Секрет: только для агента, в интерфейс не возвращается.';

-- Форма секретов: объект и не больше 4 КБ. null — секретов нет (так у
-- Moonraker, OctoPrint и Bambu: им хватает api_key).
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.workshop_printers'::regclass
       and conname = 'workshop_printers_printer_secrets_check'
  ) then
    alter table public.workshop_printers
      add constraint workshop_printers_printer_secrets_check
      check (
        printer_secrets is null
        or (
          jsonb_typeof(printer_secrets) = 'object'
          and pg_column_size(printer_secrets) <= 4096
        )
      );
  end if;
end;
$$;
-- -----------------------------------------------------------------------------
-- 1. Справочник протоколов: workshop_printers
-- -----------------------------------------------------------------------------

-- workshop_printers_farm_fields_check собирает пять условий сразу: протокол,
-- состояние, прогресс, остаток, адрес и ключ. Postgres не умеет менять одно
-- условие внутри check, поэтому ограничение пересобирается целиком. Условия
-- кроме протокола — те же, что в workshop_farm_and_shop.sql: иначе база начала
-- бы принимать то, что форма не пропускает.
alter table public.workshop_printers
  drop constraint if exists workshop_printers_farm_fields_check;

alter table public.workshop_printers
  add constraint workshop_printers_farm_fields_check
  check (
    protocol_type in (
      'moonraker',
      'octoprint',
      'bambu',
      'prusa',
      'creality',
      'anycubic',
      'flashforge',
      'elegoo'
    )
    and status in ('idle', 'printing', 'paused', 'error', 'offline')
    and progress between 0 and 100
    and remaining_time >= 0
    and (
      ip_address is null
      or char_length(btrim(ip_address)) between 1 and 253
    )
    and (api_key is null or char_length(api_key) between 1 and 512)
  );

comment on column public.workshop_printers.protocol_type is
  'Протокол управления: moonraker (Klipper), octoprint, bambu (MQTT), prusa (PrusaLink), creality, anycubic, flashforge или elegoo (SDCP).';

-- -----------------------------------------------------------------------------
-- 2. Справочник протоколов: workshop_discovered_printers
-- -----------------------------------------------------------------------------

-- Найденный принтер подтверждают тем же протоколом, что прислал агент, поэтому
-- справочник черновиков должен знать те же восемь значений. `if exists` у
-- таблицы и у ограничения — потому что таблицу создаёт
-- workshop_farm_and_shop.sql: на базе без него расширять нечего, и файл не
-- должен падать.
alter table if exists public.workshop_discovered_printers
  drop constraint if exists workshop_discovered_printers_protocol_check;

alter table if exists public.workshop_discovered_printers
  add constraint workshop_discovered_printers_protocol_check
  check (
    protocol_type is null
    or protocol_type in (
      'moonraker',
      'octoprint',
      'bambu',
      'prusa',
      'creality',
      'anycubic',
      'flashforge',
      'elegoo'
    )
  );

comment on column public.workshop_discovered_printers.protocol_type is
  'Протокол, которым ответил принтер: moonraker, octoprint, bambu, prusa, creality, anycubic, flashforge или elegoo.';

-- PostgREST кеширует схему: без этого запроса новая колонка отвечает PGRST204
-- «could not find column», а приложение считает, что миграция не применена.
notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Проверка после применения
-- -----------------------------------------------------------------------------
-- 1. Колонка на месте:
--      select column_name, data_type
--        from information_schema.columns
--       where table_schema = 'public'
--         and table_name = 'workshop_printers'
--         and column_name = 'printer_secrets';
--    Ожидание: printer_secrets | jsonb.
-- 2. Ограничения знают новые протоколы:
--      select conname, pg_get_constraintdef(oid)
--        from pg_constraint
--       where conrelid in ('public.workshop_printers'::regclass,
--                          'public.workshop_discovered_printers'::regclass)
--         and conname in ('workshop_printers_farm_fields_check',
--                         'workshop_discovered_printers_protocol_check');
--    В обоих определениях должно быть восемь значений протокола.
-- 3. Секрет записывается и читается:
--      update public.workshop_printers
--         set printer_secrets = '{"checkCode": "abcd1234"}'::jsonb
--       where id = '<id принтера FlashForge>';
-- 4. Мусор отклоняется (ожидание: ошибка check):
--      update public.workshop_printers
--         set printer_secrets = '["не объект"]'::jsonb
--       where id = '<id принтера>';

